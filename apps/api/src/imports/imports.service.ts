import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CounterpartyType,
  DocumentType,
  ImportBatchStatus,
  ImportBatchType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { ImportDocumentsCsvDto } from './dto/import-documents-csv.dto';

interface ParsedRow {
  rowNumber: number;
  values: Record<string, string>;
}

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  history(tenant: TenantContext) {
    return this.prisma.importBatch.findMany({
      where: { accountingOfficeId: tenant.accountingOfficeId },
      include: {
        clientCompany: {
          select: { id: true, legalName: true, vatNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async importDocumentsCsv(tenant: TenantContext, dto: ImportDocumentsCsvDto) {
    await this.ensureTenantCompany(tenant, dto.clientCompanyId);

    const parsedRows = parseCsv(dto.csvText);
    const errors: Array<{ rowNumber: number; message: string }> = [];
    const documents: Prisma.DocumentUncheckedCreateInput[] = [];

    for (const row of parsedRows) {
      try {
        documents.push(this.toDocumentData(tenant, dto.clientCompanyId, row));
      } catch (error) {
        errors.push({
          rowNumber: row.rowNumber,
          message: error instanceof Error ? error.message : 'Invalid row.',
        });
      }
    }

    const dryRun = dto.dryRun ?? true;

    if (!dryRun && errors.length === 0) {
      await this.prisma.document.createMany({
        data: documents,
        skipDuplicates: false,
      });
      await this.syncCounterpartiesFromRows(tenant, dto.clientCompanyId, parsedRows);
    }

    const batch = await this.prisma.importBatch.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        type: ImportBatchType.DOCUMENTS_CSV,
        status: dryRun
          ? ImportBatchStatus.PREVIEW
          : errors.length > 0
            ? ImportBatchStatus.FAILED
            : ImportBatchStatus.COMPLETED,
        fileName: dto.fileName,
        totalRows: parsedRows.length,
        successfulRows: errors.length > 0 ? 0 : documents.length,
        failedRows: errors.length,
        errorReport: errors as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      batch,
      dryRun,
      totalRows: parsedRows.length,
      validRows: documents.length,
      failedRows: errors.length,
      errors,
      preview: documents.slice(0, 10),
    };
  }

  private async ensureTenantCompany(tenant: TenantContext, clientCompanyId: string) {
    const company = await this.prisma.clientCompany.findFirst({
      where: {
        id: clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundException('Client company was not found.');
    }
  }

  private toDocumentData(
    tenant: TenantContext,
    clientCompanyId: string,
    row: ParsedRow,
  ): Prisma.DocumentUncheckedCreateInput {
    const documentType = parseDocumentType(row.values.documentType);
    const documentNumber = row.values.documentNumber?.trim();
    const issueDate = row.values.issueDate?.trim();
    const netAmount = parseNumber(row.values.netAmount);
    const vatAmount = parseNumber(row.values.vatAmount);
    const totalAmount = parseNumber(row.values.totalAmount);

    if (!documentNumber) {
      throw new BadRequestException('documentNumber is required.');
    }
    if (!issueDate || Number.isNaN(Date.parse(issueDate))) {
      throw new BadRequestException('issueDate must be a valid date.');
    }
    if (roundMoney(netAmount + vatAmount) !== roundMoney(totalAmount)) {
      throw new BadRequestException('totalAmount must equal netAmount plus vatAmount.');
    }

    return {
      accountingOfficeId: tenant.accountingOfficeId,
      clientCompanyId,
      documentType,
      series: emptyToUndefined(row.values.series),
      documentNumber,
      issueDate: new Date(issueDate),
      counterpartyName: emptyToUndefined(row.values.counterpartyName),
      counterpartyVatNumber: emptyToUndefined(row.values.counterpartyVatNumber),
      movementCode: emptyToUndefined(row.values.movementCode) ?? defaultMovementCode(documentType),
      journalCode: emptyToUndefined(row.values.journalCode) ?? defaultJournalCode(documentType),
      netAmount,
      vatAmount,
      totalAmount,
      vatCategory: row.values.vatCategory?.trim() || 'VAT_24',
    };
  }

  private async syncCounterpartiesFromRows(
    tenant: TenantContext,
    clientCompanyId: string,
    rows: ParsedRow[],
  ) {
    const candidates = new Map<
      string,
      {
        name: string;
        vatNumber?: string;
        type: CounterpartyType;
      }
    >();

    for (const row of rows) {
      const name = emptyToUndefined(row.values.counterpartyName);
      const vatNumber = emptyToUndefined(row.values.counterpartyVatNumber);
      if (!name && !vatNumber) {
        continue;
      }

      const documentType = parseDocumentType(row.values.documentType);
      const key = vatNumber ? `vat:${vatNumber}` : `name:${name}`;
      const existing = candidates.get(key);
      const type = counterpartyTypeForDocument(documentType);
      candidates.set(key, {
        name: name ?? vatNumber ?? 'Αντισυμβαλλόμενος',
        vatNumber,
        type: existing ? mergeCounterpartyTypes(existing.type, type) : type,
      });
    }

    for (const candidate of candidates.values()) {
      const existing = await this.prisma.counterparty.findFirst({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          deletedAt: null,
          OR: [
            candidate.vatNumber ? { vatNumber: candidate.vatNumber } : undefined,
            { name: candidate.name },
          ].filter(Boolean) as Prisma.CounterpartyWhereInput[],
        },
      });

      if (existing) {
        await this.prisma.counterparty.update({
          where: { id: existing.id },
          data: {
            name: candidate.name,
            vatNumber: candidate.vatNumber ?? existing.vatNumber,
            type: mergeCounterpartyTypes(existing.type, candidate.type),
          },
        });
        continue;
      }

      await this.prisma.counterparty.create({
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          name: candidate.name,
          vatNumber: candidate.vatNumber,
          type: candidate.type,
          country: 'GR',
        },
      });
    }
  }
}

function parseCsv(csvText: string): ParsedRow[] {
  const rows = csvText
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);

  if (rows.length < 2) {
    throw new BadRequestException('CSV must include a header row and at least one data row.');
  }

  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((values, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(
      headers.map((header, headerIndex) => [header, values[headerIndex] ?? '']),
    ),
  }));
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseDocumentType(value: string | undefined): DocumentType {
  const normalized = value?.trim() as DocumentType;

  if (Object.values(DocumentType).includes(normalized)) {
    return normalized;
  }

  throw new BadRequestException('documentType is invalid.');
}

function parseNumber(value: string | undefined): number {
  const number = Number(String(value ?? '').replace(',', '.'));

  if (!Number.isFinite(number) || number < 0) {
    throw new BadRequestException('Amounts must be positive numbers.');
  }

  return number;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function defaultMovementCode(documentType: DocumentType): string {
  const defaults: Record<DocumentType, string> = {
    SALES_INVOICE: 'SALE_INVOICE',
    PURCHASE_INVOICE: 'PURCHASE_INVOICE',
    CREDIT_NOTE: 'CREDIT_NOTE',
    RETAIL_RECEIPT: 'SALE_INVOICE',
  };

  return defaults[documentType];
}

function defaultJournalCode(documentType: DocumentType): string {
  const defaults: Record<DocumentType, string> = {
    SALES_INVOICE: 'SALES',
    PURCHASE_INVOICE: 'PURCHASES',
    CREDIT_NOTE: 'SALES',
    RETAIL_RECEIPT: 'SALES',
  };

  return defaults[documentType];
}

function counterpartyTypeForDocument(documentType: DocumentType): CounterpartyType {
  return documentType === DocumentType.PURCHASE_INVOICE
    ? CounterpartyType.SUPPLIER
    : CounterpartyType.CUSTOMER;
}

function mergeCounterpartyTypes(
  first: CounterpartyType,
  second: CounterpartyType,
): CounterpartyType {
  return first === second ? first : CounterpartyType.BOTH;
}
