import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateDocumentLineDto } from './dto/create-document-line.dto';
import { CreateDocumentPaymentDto } from './dto/create-document-payment.dto';
import { FindDocumentsQueryDto } from './dto/find-documents-query.dto';
import { UpdateDocumentCounterpartyDto } from './dto/update-document-counterparty.dto';

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenant: TenantContext, query: FindDocumentsQueryDto = {}) {
    return this.prisma.document.findMany({
      where: this.toWhereInput(tenant, query),
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        payments: { orderBy: { paymentNumber: 'asc' } },
        replacesDocument: { select: { id: true, documentNumber: true, series: true } },
        correctsDocument: {
          select: { id: true, documentNumber: true, series: true, myDataMark: true },
        },
        replacedByDocuments: { select: { id: true, documentNumber: true, series: true } },
        correctedByDocuments: { select: { id: true, documentNumber: true, series: true } },
        clientCompany: {
          select: {
            id: true,
            legalName: true,
            vatNumber: true,
            entityType: true,
            myDataMode: true,
            myDataAuthorized: true,
            myDataCredentialRef: true,
          },
        },
      },
      orderBy: [{ issueDate: 'desc' }, { documentNumber: 'desc' }],
    });
  }

  async create(tenant: TenantContext, dto: CreateDocumentDto) {
    const clientCompany = await this.prisma.clientCompany.findFirst({
      where: {
        id: dto.clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });

    if (!clientCompany) {
      throw new NotFoundException('Client company was not found.');
    }

    const setupCodes = await this.resolveSetupCodes(tenant, dto);
    this.validateDocumentFields(dto);
    const relationships = await this.resolveDocumentRelationships(tenant, dto);
    const classifiedDto = await this.applyClassificationProfiles(
      tenant,
      dto,
      setupCodes.movementCode,
    );
    const aggregation = this.aggregateLines(classifiedDto);
    const payments = this.preparePayments(dto, aggregation.totalAmount);

    return this.prisma.document.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        documentType: dto.documentType,
        series: dto.series,
        documentNumber: dto.documentNumber,
        issueDate: new Date(dto.issueDate),
        counterpartyName: dto.counterpartyName,
        counterpartyVatNumber: dto.counterpartyVatNumber,
        movementCode: setupCodes.movementCode,
        journalCode: setupCodes.journalCode,
        netAmount: aggregation.netAmount,
        vatAmount: aggregation.vatAmount,
        totalAmount: aggregation.totalAmount,
        vatCategory: aggregation.vatCategory,
        paymentMethodType: payments[0].type,
        vatExemptionCategory: aggregation.vatExemptionCategory,
        correlatedInvoiceMark: relationships.correlatedInvoiceMark,
        replacesDocumentId: relationships.replacesDocumentId,
        correctsDocumentId: relationships.correctsDocumentId,
        withheldAmount: aggregation.withheldAmount,
        withheldCategory: aggregation.withheldCategory,
        feesAmount: aggregation.feesAmount,
        feesCategory: aggregation.feesCategory,
        stampDutyAmount: aggregation.stampDutyAmount,
        stampDutyCategory: aggregation.stampDutyCategory,
        otherTaxesAmount: aggregation.otherTaxesAmount,
        otherTaxesCategory: aggregation.otherTaxesCategory,
        deductionsAmount: aggregation.deductionsAmount,
        lines: { create: aggregation.lines },
        payments: { create: payments },
      },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        payments: { orderBy: { paymentNumber: 'asc' } },
        replacesDocument: { select: { id: true, documentNumber: true, series: true } },
        correctsDocument: {
          select: { id: true, documentNumber: true, series: true, myDataMark: true },
        },
        replacedByDocuments: { select: { id: true, documentNumber: true, series: true } },
        correctedByDocuments: { select: { id: true, documentNumber: true, series: true } },
        clientCompany: {
          select: {
            id: true,
            legalName: true,
            vatNumber: true,
            entityType: true,
            myDataMode: true,
            myDataAuthorized: true,
            myDataCredentialRef: true,
          },
        },
      },
    });
  }

  async updateCounterparty(
    tenant: TenantContext,
    documentId: string,
    dto: UpdateDocumentCounterpartyDto,
  ) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, accountingOfficeId: tenant.accountingOfficeId, deletedAt: null },
    });
    if (!document) {
      throw new NotFoundException('Document was not found.');
    }
    if (!['DRAFT', 'FAILED'].includes(document.myDataStatus)) {
      throw new BadRequestException('Only a draft or failed document can change its counterparty.');
    }
    return this.prisma.document.update({
      where: { id: document.id },
      data: {
        counterpartyName: dto.counterpartyName?.trim() || null,
        counterpartyVatNumber: dto.counterpartyVatNumber.trim(),
        myDataXmlPreview: null,
      },
    });
  }

  private validateDocumentFields(dto: CreateDocumentDto): void {
    if (dto.documentType !== DocumentType.CREDIT_NOTE && dto.correlatedInvoiceMark) {
      throw new BadRequestException('A correlated invoice MARK is allowed only for credit notes.');
    }
    if (dto.replacesDocumentId && dto.correctsDocumentId) {
      throw new BadRequestException(
        'A document cannot be both a replacement and a credit correction.',
      );
    }
  }

  async correctionChain(tenant: TenantContext, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, accountingOfficeId: tenant.accountingOfficeId, deletedAt: null },
    });
    if (!document) {
      throw new NotFoundException('Document was not found.');
    }
    const rootId = document.replacesDocumentId ?? document.correctsDocumentId ?? document.id;
    return this.prisma.document.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
        OR: [{ id: rootId }, { replacesDocumentId: rootId }, { correctsDocumentId: rootId }],
      },
      select: {
        id: true,
        documentType: true,
        series: true,
        documentNumber: true,
        issueDate: true,
        totalAmount: true,
        myDataStatus: true,
        myDataMark: true,
        myDataCancellationMark: true,
        replacesDocumentId: true,
        correctsDocumentId: true,
      },
      orderBy: [{ issueDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  private async resolveDocumentRelationships(tenant: TenantContext, dto: CreateDocumentDto) {
    const relationshipId = dto.replacesDocumentId ?? dto.correctsDocumentId;
    if (!relationshipId) {
      return {
        replacesDocumentId: undefined,
        correctsDocumentId: undefined,
        correlatedInvoiceMark: dto.correlatedInvoiceMark,
      };
    }
    const relatedDocument = await this.prisma.document.findFirst({
      where: {
        id: relationshipId,
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        deletedAt: null,
      },
    });
    if (!relatedDocument) {
      throw new BadRequestException('The related original document was not found for this client.');
    }
    if (dto.replacesDocumentId) {
      if (relatedDocument.myDataStatus !== 'CANCELLED') {
        throw new BadRequestException(
          'A replacement invoice requires a cancelled original document.',
        );
      }
      return {
        replacesDocumentId: relatedDocument.id,
        correctsDocumentId: undefined,
        correlatedInvoiceMark: dto.correlatedInvoiceMark,
      };
    }
    if (dto.documentType !== DocumentType.CREDIT_NOTE) {
      throw new BadRequestException('Only a credit note can correct an original document.');
    }
    if (!relatedDocument.myDataMark) {
      throw new BadRequestException('The corrected document requires an AADE MARK.');
    }
    if (dto.correlatedInvoiceMark && dto.correlatedInvoiceMark !== relatedDocument.myDataMark) {
      throw new BadRequestException(
        'The correlated MARK must match the selected original document.',
      );
    }
    return {
      replacesDocumentId: undefined,
      correctsDocumentId: relatedDocument.id,
      correlatedInvoiceMark: relatedDocument.myDataMark,
    };
  }

  private async applyClassificationProfiles(
    tenant: TenantContext,
    dto: CreateDocumentDto,
    movementCode?: string,
  ): Promise<CreateDocumentDto> {
    const profiles = await this.prisma.clientSetupItem.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        kind: 'MYDATA_CLASSIFICATION_PROFILE',
      },
    });
    const rules = profiles
      .map((profile) => parseClassificationProfile(profile.metadata))
      .filter(
        (profile): profile is ClassificationProfile => profile !== undefined && profile.isActive,
      )
      .sort((first, second) => {
        const priority = second.priority - first.priority;
        return priority !== 0 ? priority : profileSpecificity(second) - profileSpecificity(first);
      });
    const sourceLines = dto.lines?.length ? dto.lines : [this.legacyLine(dto)];

    return {
      ...dto,
      lines: sourceLines.map((line) => {
        const matchingRules = rules.filter((rule) =>
          profileMatches(rule, dto.documentType, movementCode, line),
        );
        const profileValue = (field: keyof ClassificationProfile) =>
          matchingRules.map((rule) => rule[field]).find((value) => typeof value === 'string') as
            string | undefined;
        return {
          ...line,
          incomeClassificationType:
            line.incomeClassificationType ?? profileValue('incomeClassificationType'),
          incomeClassificationCategory:
            line.incomeClassificationCategory ?? profileValue('incomeClassificationCategory'),
          expenseClassificationType:
            line.expenseClassificationType ?? profileValue('expenseClassificationType'),
          expenseClassificationCategory:
            line.expenseClassificationCategory ?? profileValue('expenseClassificationCategory'),
          vatClassificationType:
            line.vatClassificationType ?? profileValue('vatClassificationType'),
        };
      }),
    };
  }

  private aggregateLines(dto: CreateDocumentDto) {
    const lines = dto.lines?.length ? dto.lines : [this.legacyLine(dto)];
    const preparedLines = lines.map((line, index) => {
      this.validateLine(line, index + 1);
      return {
        lineNumber: index + 1,
        itemCode: line.itemCode,
        description: line.description,
        quantity: line.quantity,
        measurementUnit: line.measurementUnit,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount ?? 0,
        discountOption: line.discountOption,
        netAmount: line.netAmount,
        vatAmount: line.vatAmount,
        vatCategory: line.vatCategory,
        vatExemptionCategory: line.vatExemptionCategory,
        withheldAmount: line.withheldAmount ?? 0,
        withheldCategory: line.withheldCategory,
        feesAmount: line.feesAmount ?? 0,
        feesCategory: line.feesCategory,
        stampDutyAmount: line.stampDutyAmount ?? 0,
        stampDutyCategory: line.stampDutyCategory,
        otherTaxesAmount: line.otherTaxesAmount ?? 0,
        otherTaxesCategory: line.otherTaxesCategory,
        deductionsAmount: line.deductionsAmount ?? 0,
        incomeClassificationType: line.incomeClassificationType,
        incomeClassificationCategory: line.incomeClassificationCategory,
        expenseClassificationType: line.expenseClassificationType,
        expenseClassificationCategory: line.expenseClassificationCategory,
        vatClassificationType: line.vatClassificationType,
      };
    });
    const sum = (field: keyof (typeof preparedLines)[number]) =>
      roundMoney(preparedLines.reduce((total, line) => total + Number(line[field] ?? 0), 0));
    const aggregation = {
      lines: preparedLines,
      netAmount: sum('netAmount'),
      vatAmount: sum('vatAmount'),
      withheldAmount: sum('withheldAmount'),
      feesAmount: sum('feesAmount'),
      stampDutyAmount: sum('stampDutyAmount'),
      otherTaxesAmount: sum('otherTaxesAmount'),
      deductionsAmount: sum('deductionsAmount'),
      vatCategory:
        new Set(preparedLines.map((line) => line.vatCategory)).size === 1
          ? preparedLines[0].vatCategory
          : 'MULTIPLE',
      vatExemptionCategory: singleCategory(preparedLines, 'vatExemptionCategory'),
      withheldCategory: singleCategory(preparedLines, 'withheldCategory'),
      feesCategory: singleCategory(preparedLines, 'feesCategory'),
      stampDutyCategory: singleCategory(preparedLines, 'stampDutyCategory'),
      otherTaxesCategory: singleCategory(preparedLines, 'otherTaxesCategory'),
    };
    const totalAmount = roundMoney(
      aggregation.netAmount +
        aggregation.vatAmount -
        aggregation.withheldAmount +
        aggregation.feesAmount +
        aggregation.stampDutyAmount +
        aggregation.otherTaxesAmount -
        aggregation.deductionsAmount,
    );

    for (const [label, supplied, calculated] of [
      ['netAmount', dto.netAmount, aggregation.netAmount],
      ['vatAmount', dto.vatAmount, aggregation.vatAmount],
      ['totalAmount', dto.totalAmount, totalAmount],
    ] as const) {
      if (supplied !== undefined && roundMoney(supplied) !== calculated) {
        throw new BadRequestException(
          `${label === 'totalAmount' ? 'Total amount' : label} must equal the aggregation of document lines.`,
        );
      }
    }

    return { ...aggregation, totalAmount };
  }

  private preparePayments(dto: CreateDocumentDto, totalAmount: number) {
    const payments = dto.payments?.length
      ? dto.payments
      : [{ type: dto.paymentMethodType ?? 3, amount: totalAmount }];
    const paymentTotal = roundMoney(payments.reduce((sum, payment) => sum + payment.amount, 0));
    if (paymentTotal !== totalAmount) {
      throw new BadRequestException('Payment amounts must equal the document total amount.');
    }
    return payments.map((payment, index) => {
      this.validatePayment(payment, index + 1);
      return {
        paymentNumber: index + 1,
        type: payment.type,
        amount: payment.amount,
        paymentMethodInfo: payment.paymentMethodInfo,
        transactionId: payment.transactionId,
        tid: payment.tid,
        providerSigningAuthor: payment.providerSigningAuthor,
        providerSignature: payment.providerSignature,
        ecrSigningAuthor: payment.ecrSigningAuthor,
        ecrSessionNumber: payment.ecrSessionNumber,
      };
    });
  }

  private validatePayment(payment: CreateDocumentPaymentDto, paymentNumber: number): void {
    if (Boolean(payment.providerSigningAuthor) !== Boolean(payment.providerSignature)) {
      throw new BadRequestException(
        `Payment ${paymentNumber}: provider signing author and signature are required together.`,
      );
    }
    if (Boolean(payment.ecrSigningAuthor) !== Boolean(payment.ecrSessionNumber)) {
      throw new BadRequestException(
        `Payment ${paymentNumber}: ECR signing author and session number are required together.`,
      );
    }
  }

  private legacyLine(dto: CreateDocumentDto): CreateDocumentLineDto {
    if (dto.netAmount === undefined || dto.vatAmount === undefined || !dto.vatCategory) {
      throw new BadRequestException('At least one document line is required.');
    }
    return {
      netAmount: dto.netAmount,
      vatAmount: dto.vatAmount,
      vatCategory: dto.vatCategory,
      vatExemptionCategory: dto.vatExemptionCategory,
      withheldAmount: dto.withheldAmount,
      withheldCategory: dto.withheldCategory,
      feesAmount: dto.feesAmount,
      feesCategory: dto.feesCategory,
      stampDutyAmount: dto.stampDutyAmount,
      stampDutyCategory: dto.stampDutyCategory,
      otherTaxesAmount: dto.otherTaxesAmount,
      otherTaxesCategory: dto.otherTaxesCategory,
      deductionsAmount: dto.deductionsAmount,
    };
  }

  private validateLine(line: CreateDocumentLineDto, lineNumber: number): void {
    if ((line.quantity === undefined) !== (line.measurementUnit === undefined)) {
      throw new BadRequestException(
        `Line ${lineNumber}: quantity and measurement unit must be supplied together.`,
      );
    }
    if (line.vatCategory === 'VAT_0' && line.vatExemptionCategory === undefined) {
      throw new BadRequestException(`Line ${lineNumber}: VAT exemption category is required.`);
    }
    if (line.vatCategory !== 'VAT_0' && line.vatExemptionCategory !== undefined) {
      throw new BadRequestException(`Line ${lineNumber}: VAT exemption applies only to 0% VAT.`);
    }
    this.requireTaxCategory(
      `Line ${lineNumber} Withholding`,
      line.withheldAmount,
      line.withheldCategory,
    );
    this.requireTaxCategory(`Line ${lineNumber} Fees`, line.feesAmount, line.feesCategory);
    this.requireTaxCategory(
      `Line ${lineNumber} Digital transaction duty`,
      line.stampDutyAmount,
      line.stampDutyCategory,
    );
    this.requireTaxCategory(
      `Line ${lineNumber} Other taxes`,
      line.otherTaxesAmount,
      line.otherTaxesCategory,
    );
    if (
      Boolean(line.incomeClassificationType) !== Boolean(line.incomeClassificationCategory) ||
      Boolean(line.expenseClassificationType) !== Boolean(line.expenseClassificationCategory)
    ) {
      throw new BadRequestException(
        `Line ${lineNumber}: classification type and category are required together.`,
      );
    }
  }

  private requireTaxCategory(label: string, amount?: number, category?: number): void {
    if ((amount ?? 0) > 0 && category === undefined) {
      throw new BadRequestException(`${label} category is required when its amount is positive.`);
    }

    if ((amount ?? 0) === 0 && category !== undefined) {
      throw new BadRequestException(`${label} category requires a positive amount.`);
    }
  }

  private toWhereInput(tenant: TenantContext, query: FindDocumentsQueryDto) {
    const where = {
      accountingOfficeId: tenant.accountingOfficeId,
      deletedAt: null,
      clientCompanyId: query.clientCompanyId,
      documentType: query.documentType,
      myDataStatus: query.myDataStatus,
      movementCode: query.movementCode,
      journalCode: query.journalCode,
      issueDate:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
              lte: query.dateTo ? new Date(query.dateTo) : undefined,
            }
          : undefined,
      OR: query.search
        ? [
            { documentNumber: { contains: query.search } },
            { series: { contains: query.search } },
            { counterpartyName: { contains: query.search } },
            { counterpartyVatNumber: { contains: query.search } },
          ]
        : undefined,
    };

    return where;
  }

  private async resolveSetupCodes(tenant: TenantContext, dto: CreateDocumentDto) {
    const movementCode = dto.movementCode ?? defaultMovementCode(dto.documentType);
    const journalCode = dto.journalCode ?? defaultJournalCode(dto.documentType);

    return {
      movementCode: movementCode
        ? await this.resolveClientSetupCode(
            tenant,
            dto.clientCompanyId,
            'MOVEMENT_CODE',
            movementCode,
          )
        : undefined,
      journalCode: journalCode
        ? await this.resolveClientSetupCode(tenant, dto.clientCompanyId, 'JOURNAL', journalCode)
        : undefined,
    };
  }

  private async resolveClientSetupCode(
    tenant: TenantContext,
    clientCompanyId: string,
    kind: string,
    code: string,
  ): Promise<string | undefined> {
    const setupItem = await this.prisma.clientSetupItem.findFirst({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
        kind,
        code,
      },
    });

    if (setupItem) {
      return setupItem.code;
    }

    if (isBuiltInFallbackSetupCode(kind, code)) {
      return code;
    }

    throw new BadRequestException(`${kind} ${code} is not configured for this client.`);
  }
}

function defaultMovementCode(documentType: DocumentType): string | undefined {
  const defaults: Record<DocumentType, string> = {
    SALES_INVOICE: 'SALE_INVOICE',
    PURCHASE_INVOICE: 'PURCHASE_INVOICE',
    CREDIT_NOTE: 'CREDIT_NOTE',
    RETAIL_RECEIPT: 'SALE_INVOICE',
  };

  return defaults[documentType];
}

function defaultJournalCode(documentType: DocumentType): string | undefined {
  const defaults: Record<DocumentType, string> = {
    SALES_INVOICE: 'SALES',
    PURCHASE_INVOICE: 'PURCHASES',
    CREDIT_NOTE: 'SALES',
    RETAIL_RECEIPT: 'SALES',
  };

  return defaults[documentType];
}

function isBuiltInFallbackSetupCode(kind: string, code: string): boolean {
  if (kind === 'MOVEMENT_CODE') {
    return ['SALE_INVOICE', 'PURCHASE_INVOICE', 'CREDIT_NOTE'].includes(code);
  }

  if (kind === 'JOURNAL') {
    return ['SALES', 'PURCHASES', 'CASH_BANK'].includes(code);
  }

  return false;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function singleCategory(lines: Array<Record<string, unknown>>, field: string): number | undefined {
  const categories = [
    ...new Set(lines.map((line) => line[field]).filter((value) => value !== undefined)),
  ];
  return categories.length === 1 ? Number(categories[0]) : undefined;
}

interface ClassificationProfile {
  documentType?: DocumentType;
  movementCode?: string;
  vatCategory?: string;
  itemCode?: string;
  incomeClassificationType?: string;
  incomeClassificationCategory?: string;
  expenseClassificationType?: string;
  expenseClassificationCategory?: string;
  vatClassificationType?: string;
  priority: number;
  isActive: boolean;
}

function parseClassificationProfile(metadata: unknown): ClassificationProfile | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }
  const value = metadata as Record<string, unknown>;
  const stringValue = (field: string) =>
    typeof value[field] === 'string' && value[field].trim() ? value[field].trim() : undefined;
  const documentType = stringValue('documentType');
  if (documentType && !Object.values(DocumentType).includes(documentType as DocumentType)) {
    return undefined;
  }
  return {
    documentType: documentType as DocumentType | undefined,
    movementCode: stringValue('movementCode'),
    vatCategory: stringValue('vatCategory'),
    itemCode: stringValue('itemCode'),
    incomeClassificationType: stringValue('incomeClassificationType'),
    incomeClassificationCategory: stringValue('incomeClassificationCategory'),
    expenseClassificationType: stringValue('expenseClassificationType'),
    expenseClassificationCategory: stringValue('expenseClassificationCategory'),
    vatClassificationType: stringValue('vatClassificationType'),
    priority: typeof value.priority === 'number' ? value.priority : 0,
    isActive: value.isActive !== false,
  };
}

function profileMatches(
  profile: ClassificationProfile,
  documentType: DocumentType,
  movementCode: string | undefined,
  line: CreateDocumentLineDto,
): boolean {
  return (
    (!profile.documentType || profile.documentType === documentType) &&
    (!profile.movementCode || profile.movementCode === movementCode) &&
    (!profile.vatCategory || profile.vatCategory === line.vatCategory) &&
    (!profile.itemCode || profile.itemCode === line.itemCode)
  );
}

function profileSpecificity(profile: ClassificationProfile): number {
  return [profile.documentType, profile.movementCode, profile.vatCategory, profile.itemCode].filter(
    Boolean,
  ).length;
}
