import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType, ImportBatchStatus, ImportBatchType, Prisma } from '@prisma/client';
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
      netAmount,
      vatAmount,
      totalAmount,
      vatCategory: row.values.vatCategory?.trim() || 'VAT_24',
    };
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
