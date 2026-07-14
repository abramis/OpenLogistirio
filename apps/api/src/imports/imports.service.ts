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

interface ImportedDocument {
  data: Prisma.DocumentUncheckedCreateInput;
  lines: Prisma.DocumentLineCreateWithoutDocumentInput[];
  payments: Prisma.DocumentPaymentCreateWithoutDocumentInput[];
  rowCount: number;
  firstRowNumber: number;
}

interface ImportIssue {
  rowNumber: number;
  field?: string;
  code: 'VALIDATION' | 'DUPLICATE' | 'PERSISTENCE';
  message: string;
}

class ImportRowError extends Error {
  constructor(
    readonly rowNumber: number,
    readonly field: string | undefined,
    message: string,
  ) {
    super(message);
  }
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
    const errors: ImportIssue[] = [];
    const documents: ImportedDocument[] = [];

    for (const rows of groupDocumentRows(parsedRows)) {
      try {
        documents.push(this.toDocumentData(tenant, dto.clientCompanyId, rows));
      } catch (error) {
        const rowError = asImportRowError(rows[0], error);
        errors.push({
          rowNumber: rowError.rowNumber,
          field: rowError.field,
          code: 'VALIDATION',
          message: rowError.message,
        });
      }
    }

    errors.push(...(await this.findDuplicates(tenant, dto.clientCompanyId, documents)));

    const dryRun = dto.dryRun ?? true;
    const batch = await this.prisma.importBatch.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        type: ImportBatchType.DOCUMENTS_CSV,
        status: dryRun ? ImportBatchStatus.PREVIEW : ImportBatchStatus.FAILED,
        fileName: dto.fileName,
        totalRows: parsedRows.length,
        successfulRows: dryRun
          ? documents.reduce((sum, document) => sum + document.rowCount, 0)
          : 0,
        failedRows: errors.length,
        errorReport: errors as unknown as Prisma.InputJsonValue,
      },
    });

    if (!dryRun && errors.length === 0) {
      try {
        await this.persistDocuments(batch.id, documents);
        await this.syncCounterpartiesFromRows(tenant, dto.clientCompanyId, parsedRows);
        await this.prisma.importBatch.update({
          where: { id: batch.id },
          data: {
            status: ImportBatchStatus.COMPLETED,
            successfulRows: parsedRows.length,
            errorReport: Prisma.JsonNull,
          },
        });
        batch.status = ImportBatchStatus.COMPLETED;
        batch.successfulRows = parsedRows.length;
      } catch (error) {
        const issue: ImportIssue = {
          rowNumber: 0,
          code: 'PERSISTENCE',
          message: error instanceof Error ? error.message : 'Import persistence failed.',
        };
        errors.push(issue);
        await this.prisma.importBatch.update({
          where: { id: batch.id },
          data: {
            status: ImportBatchStatus.FAILED,
            failedRows: parsedRows.length,
            errorReport: [issue] as unknown as Prisma.InputJsonValue,
          },
        });
        batch.status = ImportBatchStatus.FAILED;
        batch.failedRows = parsedRows.length;
      }
    } else if (!dryRun && errors.length > 0) {
      await this.prisma.importBatch.update({
        where: { id: batch.id },
        data: { status: ImportBatchStatus.FAILED },
      });
      batch.status = ImportBatchStatus.FAILED;
    }

    return {
      batch,
      dryRun,
      totalRows: parsedRows.length,
      validRows: documents.reduce((sum, document) => sum + document.rowCount, 0),
      failedRows: errors.length,
      errors,
      preview: documents.slice(0, 10).map((document) => ({
        ...document.data,
        lines: document.lines,
      })),
    };
  }

  async errorReportCsv(tenant: TenantContext, batchId: string): Promise<string> {
    const batch = await this.getTenantBatch(tenant, batchId);
    const issues = readImportIssues(batch.errorReport);
    return [
      'rowNumber,field,code,message',
      ...issues.map((issue) =>
        [issue.rowNumber || '', issue.field ?? '', issue.code ?? '', issue.message]
          .map(csvCell)
          .join(','),
      ),
    ].join('\n');
  }

  async rollback(tenant: TenantContext, batchId: string) {
    const batch = await this.getTenantBatch(tenant, batchId);
    if (batch.status !== ImportBatchStatus.COMPLETED) {
      throw new BadRequestException('Only a completed import can be rolled back.');
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.document.updateMany({
        where: { importBatchId: batch.id, accountingOfficeId: tenant.accountingOfficeId },
        data: { deletedAt: new Date() },
      });
      await transaction.importBatch.update({
        where: { id: batch.id },
        data: { status: ImportBatchStatus.ROLLED_BACK, rolledBackAt: new Date() },
      });
    });
    return this.getTenantBatch(tenant, batchId);
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

  private async persistDocuments(batchId: string, documents: ImportedDocument[]): Promise<void> {
    await this.prisma.$transaction((transaction) =>
      Promise.all(
        documents.map((document) =>
          transaction.document.create({
            data: {
              ...document.data,
              importBatchId: batchId,
              ...(document.lines.length > 0 ? { lines: { create: document.lines } } : {}),
              ...(document.payments.length > 0 ? { payments: { create: document.payments } } : {}),
            },
          }),
        ),
      ),
    );
  }

  private async findDuplicates(
    tenant: TenantContext,
    clientCompanyId: string,
    documents: ImportedDocument[],
  ): Promise<ImportIssue[]> {
    const issues: ImportIssue[] = [];
    const seen = new Map<string, ImportedDocument>();
    for (const document of documents) {
      const key = documentKey(document.data);
      const previous = seen.get(key);
      if (previous) {
        issues.push({
          rowNumber: document.firstRowNumber,
          field: 'documentNumber',
          code: 'DUPLICATE',
          message: `Duplicate document in CSV: ${String(document.data.series ?? '')}/${document.data.documentNumber}.`,
        });
      } else {
        seen.set(key, document);
      }
    }
    if (documents.length === 0) {
      return issues;
    }
    const existing = await this.prisma.document.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
        deletedAt: null,
        OR: documents.map((document) => ({
          documentType: document.data.documentType,
          series: document.data.series ?? null,
          documentNumber: document.data.documentNumber,
        })),
      },
      select: { documentType: true, series: true, documentNumber: true },
    });
    const existingKeys = new Set(existing.map(documentKey));
    for (const document of documents) {
      if (existingKeys.has(documentKey(document.data))) {
        issues.push({
          rowNumber: document.firstRowNumber,
          field: 'documentNumber',
          code: 'DUPLICATE',
          message: `Document already exists: ${String(document.data.series ?? '')}/${document.data.documentNumber}.`,
        });
      }
    }
    return issues;
  }

  private async getTenantBatch(tenant: TenantContext, id: string) {
    const batch = await this.prisma.importBatch.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!batch) {
      throw new NotFoundException('Import batch was not found.');
    }
    return batch;
  }

  private toDocumentData(
    tenant: TenantContext,
    clientCompanyId: string,
    rows: ParsedRow[],
  ): ImportedDocument {
    const row = rows[0];
    try {
      const documentType = parseDocumentType(row.values.documentType);
      const documentNumber = row.values.documentNumber?.trim();
      const issueDate = row.values.issueDate?.trim();
      const lines = rows.some((entry) => hasLineData(entry.values))
        ? rows.map((entry, index) => {
            try {
              return {
                ...this.toDocumentLineData(entry),
                lineNumber: index + 1,
              };
            } catch (error) {
              throw asImportRowError(entry, error);
            }
          })
        : [];
      const aggregated = aggregateLineAmounts(lines);
      const netAmount = lines.length > 0 ? aggregated.netAmount : parseNumber(row.values.netAmount);
      const vatAmount = lines.length > 0 ? aggregated.vatAmount : parseNumber(row.values.vatAmount);
      const totalAmount =
        lines.length > 0 ? aggregated.totalAmount : parseNumber(row.values.totalAmount);
      const payments = parsePayments(rows, totalAmount);

      if (!documentNumber) {
        throw new BadRequestException('documentNumber is required.');
      }
      if (!issueDate || Number.isNaN(Date.parse(issueDate))) {
        throw new BadRequestException('issueDate must be a valid date.');
      }
      if (!lines.length && roundMoney(netAmount + vatAmount) !== roundMoney(totalAmount)) {
        throw new BadRequestException('totalAmount must equal netAmount plus vatAmount.');
      }
      if (lines.length > 0) {
        verifyHeaderTotals(row, aggregated);
      }

      return {
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          documentType,
          series: emptyToUndefined(row.values.series),
          documentNumber,
          issueDate: new Date(issueDate),
          counterpartyName: emptyToUndefined(row.values.counterpartyName),
          counterpartyVatNumber: emptyToUndefined(row.values.counterpartyVatNumber),
          movementCode:
            emptyToUndefined(row.values.movementCode) ?? defaultMovementCode(documentType),
          journalCode: emptyToUndefined(row.values.journalCode) ?? defaultJournalCode(documentType),
          netAmount,
          vatAmount,
          totalAmount,
          vatCategory:
            lines.length > 0
              ? new Set(lines.map((line) => line.vatCategory)).size === 1
                ? lines[0].vatCategory
                : 'MULTIPLE'
              : row.values.vatCategory?.trim() || 'VAT_24',
          paymentMethodType: parseOptionalInteger(row.values.paymentMethodType) ?? 3,
          vatExemptionCategory: parseOptionalInteger(row.values.vatExemptionCategory),
          withheldAmount: parseOptionalNumber(row.values.withheldAmount) ?? 0,
          withheldCategory: parseOptionalInteger(row.values.withheldCategory),
          feesAmount: parseOptionalNumber(row.values.feesAmount) ?? 0,
          feesCategory: parseOptionalInteger(row.values.feesCategory),
          stampDutyAmount: parseOptionalNumber(row.values.stampDutyAmount) ?? 0,
          stampDutyCategory: parseOptionalInteger(row.values.stampDutyCategory),
          otherTaxesAmount: parseOptionalNumber(row.values.otherTaxesAmount) ?? 0,
          otherTaxesCategory: parseOptionalInteger(row.values.otherTaxesCategory),
          deductionsAmount: parseOptionalNumber(row.values.deductionsAmount) ?? 0,
        },
        lines,
        payments,
        rowCount: rows.length,
        firstRowNumber: row.rowNumber,
      };
    } catch (error) {
      throw asImportRowError(row, error);
    }
  }

  private toDocumentLineData(row: ParsedRow): Prisma.DocumentLineCreateWithoutDocumentInput {
    const values = row.values;
    const netAmount = parseNumber(values.lineNetAmount);
    const vatAmount = parseNumber(values.lineVatAmount);
    const quantity = parseOptionalPositiveNumber(values.lineQuantity);
    const measurementUnit = parseOptionalInteger(values.lineMeasurementUnit);
    if ((quantity === undefined) !== (measurementUnit === undefined)) {
      throw new BadRequestException(
        'lineQuantity and lineMeasurementUnit must be supplied together.',
      );
    }
    const vatCategory = emptyToUndefined(values.lineVatCategory) ?? 'VAT_24';
    const vatExemptionCategory = parseOptionalInteger(values.lineVatExemptionCategory);
    if (vatCategory === 'VAT_0' && vatExemptionCategory === undefined) {
      throw new BadRequestException('lineVatExemptionCategory is required for VAT_0.');
    }
    if (vatCategory !== 'VAT_0' && vatExemptionCategory !== undefined) {
      throw new BadRequestException('lineVatExemptionCategory is valid only for VAT_0.');
    }
    validateClassificationPair(
      'lineIncomeClassification',
      values.lineIncomeClassificationType,
      values.lineIncomeClassificationCategory,
    );
    validateClassificationPair(
      'lineExpenseClassification',
      values.lineExpenseClassificationType,
      values.lineExpenseClassificationCategory,
    );
    return {
      lineNumber: row.rowNumber,
      itemCode: emptyToUndefined(values.lineItemCode),
      description: emptyToUndefined(values.lineDescription),
      quantity,
      measurementUnit,
      unitPrice: parseOptionalNumber(values.lineUnitPrice),
      discountAmount: parseOptionalNumber(values.lineDiscountAmount) ?? 0,
      discountOption: parseOptionalBoolean(values.lineDiscountOption),
      netAmount,
      vatAmount,
      vatCategory,
      vatExemptionCategory,
      withheldAmount: parseOptionalNumber(values.lineWithheldAmount) ?? 0,
      withheldCategory: parseOptionalInteger(values.lineWithheldCategory),
      feesAmount: parseOptionalNumber(values.lineFeesAmount) ?? 0,
      feesCategory: parseOptionalInteger(values.lineFeesCategory),
      stampDutyAmount: parseOptionalNumber(values.lineStampDutyAmount) ?? 0,
      stampDutyCategory: parseOptionalInteger(values.lineStampDutyCategory),
      otherTaxesAmount: parseOptionalNumber(values.lineOtherTaxesAmount) ?? 0,
      otherTaxesCategory: parseOptionalInteger(values.lineOtherTaxesCategory),
      deductionsAmount: parseOptionalNumber(values.lineDeductionsAmount) ?? 0,
      incomeClassificationType: emptyToUndefined(values.lineIncomeClassificationType),
      incomeClassificationCategory: emptyToUndefined(values.lineIncomeClassificationCategory),
      expenseClassificationType: emptyToUndefined(values.lineExpenseClassificationType),
      expenseClassificationCategory: emptyToUndefined(values.lineExpenseClassificationCategory),
      vatClassificationType: emptyToUndefined(values.lineVatClassificationType),
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

function groupDocumentRows(rows: ParsedRow[]): ParsedRow[][] {
  const groups = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const values = row.values;
    const key = [
      values.documentType?.trim(),
      values.series?.trim(),
      values.documentNumber?.trim(),
      values.issueDate?.trim(),
    ].join('|');
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function hasLineData(values: Record<string, string>): boolean {
  return Object.keys(values).some((key) => key.startsWith('line') && values[key].trim().length > 0);
}

function aggregateLineAmounts(lines: Prisma.DocumentLineCreateWithoutDocumentInput[]) {
  const netAmount = roundMoney(lines.reduce((sum, line) => sum + Number(line.netAmount), 0));
  const vatAmount = roundMoney(lines.reduce((sum, line) => sum + Number(line.vatAmount), 0));
  return { netAmount, vatAmount, totalAmount: roundMoney(netAmount + vatAmount) };
}

function verifyHeaderTotals(
  row: ParsedRow,
  aggregated: { netAmount: number; vatAmount: number; totalAmount: number },
): void {
  for (const [field, calculated] of [
    ['netAmount', aggregated.netAmount],
    ['vatAmount', aggregated.vatAmount],
    ['totalAmount', aggregated.totalAmount],
  ] as const) {
    const supplied = parseOptionalNumber(row.values[field]);
    if (supplied !== undefined && roundMoney(supplied) !== calculated) {
      throw new BadRequestException(`${field} must equal the aggregation of document lines.`);
    }
  }
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

function parsePayments(
  rows: ParsedRow[],
  totalAmount: number,
): Prisma.DocumentPaymentCreateWithoutDocumentInput[] {
  const payments = new Map<string, Prisma.DocumentPaymentCreateWithoutDocumentInput>();
  for (const row of rows) {
    try {
      const values = row.values;
      if (!emptyToUndefined(values.paymentType) && !emptyToUndefined(values.paymentAmount)) {
        continue;
      }
      const paymentNumber = parseOptionalInteger(values.paymentNumber) ?? payments.size + 1;
      const type = parseOptionalInteger(values.paymentType);
      const amount = parseOptionalNumber(values.paymentAmount);
      if (type === undefined || amount === undefined) {
        throw new BadRequestException('paymentType and paymentAmount must be supplied together.');
      }
      const payment = {
        paymentNumber,
        type,
        amount,
        paymentMethodInfo: emptyToUndefined(values.paymentMethodInfo),
        transactionId: emptyToUndefined(values.paymentTransactionId),
        tid: emptyToUndefined(values.paymentTid),
        providerSigningAuthor: emptyToUndefined(values.paymentProviderSigningAuthor),
        providerSignature: emptyToUndefined(values.paymentProviderSignature),
        ecrSigningAuthor: emptyToUndefined(values.paymentEcrSigningAuthor),
        ecrSessionNumber: emptyToUndefined(values.paymentEcrSessionNumber),
      } satisfies Prisma.DocumentPaymentCreateWithoutDocumentInput;
      const key = `${payment.paymentNumber}|${payment.type}|${payment.amount}|${payment.transactionId ?? ''}`;
      payments.set(key, payment);
    } catch (error) {
      throw asImportRowError(row, error);
    }
  }
  const values = [...payments.values()].sort(
    (first, second) => first.paymentNumber - second.paymentNumber,
  );
  if (
    values.length > 0 &&
    roundMoney(values.reduce((sum, payment) => sum + Number(payment.amount), 0)) !== totalAmount
  ) {
    throw new BadRequestException('The sum of paymentAmount values must equal totalAmount.');
  }
  return values;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!emptyToUndefined(value)) {
    return undefined;
  }
  return parseNumber(value);
}

function parseOptionalPositiveNumber(value: string | undefined): number | undefined {
  const number = parseOptionalNumber(value);
  if (number !== undefined && number <= 0) {
    throw new BadRequestException('Quantity must be a positive number.');
  }
  return number;
}

function parseOptionalInteger(value: string | undefined): number | undefined {
  const number = parseOptionalNumber(value);
  if (number !== undefined && !Number.isInteger(number)) {
    throw new BadRequestException('Measurement unit must be an integer.');
  }
  return number;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  const normalized = emptyToUndefined(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (['true', '1', 'yes', 'ναι'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'όχι'].includes(normalized)) {
    return false;
  }
  throw new BadRequestException('lineDiscountOption must be true or false.');
}

function validateClassificationPair(label: string, type?: string, category?: string): void {
  if (Boolean(emptyToUndefined(type)) !== Boolean(emptyToUndefined(category))) {
    throw new BadRequestException(`${label} type and category must be supplied together.`);
  }
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function documentKey(document: {
  documentType: DocumentType;
  series?: string | null;
  documentNumber: string;
}): string {
  return [document.documentType, document.series ?? '', document.documentNumber].join('|');
}

function importErrorField(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : '';
  const match = message.match(/^([A-Za-z][A-Za-z0-9]*)\b/);
  return match?.[1];
}

function asImportRowError(row: ParsedRow, error: unknown): ImportRowError {
  if (error instanceof ImportRowError) {
    return error;
  }
  return new ImportRowError(
    row.rowNumber,
    importErrorField(error),
    error instanceof Error ? error.message : 'Invalid row.',
  );
}

function readImportIssues(value: Prisma.JsonValue | null | undefined): ImportIssue[] {
  return Array.isArray(value) ? (value as unknown as ImportIssue[]) : [];
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
