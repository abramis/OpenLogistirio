import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DeclarationWorkpaperStatus,
  DeclarationWorkpaperPeriodKind,
  DeclarationWorkpaperType,
  DeclarationReturnType,
  DocumentType,
  ObligationStatus,
  ObligationType,
  PeriodCloseKind,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { GenerateVatWorkpaperDto } from './dto/generate-vat-workpaper.dto';
import {
  PayDeclarationTaxPaymentDto,
  SubmitDeclarationWorkpaperDto,
  VatDeclarationResultDto,
} from './dto/submit-declaration-workpaper.dto';
import { defaultVatSubmissionDeadline, isVatActionLate } from './vat-compliance';

@Injectable()
export class DeclarationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findWorkpapers(tenant: TenantContext, clientCompanyId?: string) {
    return this.prisma.declarationWorkpaper.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
      },
      include: {
        clientCompany: {
          select: { id: true, legalName: true, vatNumber: true },
        },
        taxPayments: { orderBy: { installmentNumber: 'asc' } },
      },
      orderBy: [
        { periodYear: 'desc' },
        { periodEndMonth: 'desc' },
        { revision: 'desc' },
        { generatedAt: 'desc' },
      ],
    });
  }

  async generateVatWorkpaper(tenant: TenantContext, dto: GenerateVatWorkpaperDto) {
    const company = await this.prisma.clientCompany.findFirst({
      where: {
        id: dto.clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundException('Client company was not found.');
    }

    const period = resolveWorkpaperPeriod(dto);
    const totals = await this.calculateVatTotals(
      tenant,
      dto.clientCompanyId,
      dto.year,
      period,
      company.vatNumber,
    );
    const title = workpaperTitle(dto.year, period);

    const existing = await this.prisma.declarationWorkpaper.findFirst({
      where: {
        clientCompanyId: dto.clientCompanyId,
        type: DeclarationWorkpaperType.VAT_RETURN,
        periodYear: dto.year,
        periodKind: period.kind,
        periodEndMonth: period.endMonth,
      },
      orderBy: { revision: 'desc' },
    });

    if (existing?.status === DeclarationWorkpaperStatus.DRAFT) {
      return this.prisma.declarationWorkpaper.update({
        where: { id: existing.id },
        data: {
          title,
          totals,
          status: DeclarationWorkpaperStatus.DRAFT,
          generatedAt: new Date(),
          submittedAt: null,
          submissionReference: null,
          submissionDate: null,
          submissionAttachments: Prisma.JsonNull,
          approvedById: null,
          approvedAt: null,
          periodStartMonth: period.startMonth,
          periodEndMonth: period.endMonth,
          periodMonth:
            period.kind === DeclarationWorkpaperPeriodKind.ANNUAL ? null : period.endMonth,
          periodCloseReviewId: null,
          submissionDeadline: defaultVatSubmissionDeadline(dto.year, period.endMonth),
          lateSubmission: null,
          vatPayableAmount: 0,
          vatCreditCarryForward: 0,
          vatRefundClaim: 0,
          vatDebtId: null,
          taxPayments: { deleteMany: {} },
        },
        include: { taxPayments: { orderBy: { installmentNumber: 'asc' } } },
      });
    }
    if (existing && !dto.createAmending) {
      throw new BadRequestException(
        existing.status === DeclarationWorkpaperStatus.SUBMITTED ||
          existing.status === DeclarationWorkpaperStatus.ARCHIVED
          ? 'Η δήλωση ΦΠΑ έχει ήδη υποβληθεί. Δημιουργήστε τροποποιητική.'
          : 'Το workpaper έχει φύγει από το πρόχειρο και δεν μπορεί να ξαναγραφτεί.',
      );
    }
    if (
      existing &&
      existing.status !== DeclarationWorkpaperStatus.SUBMITTED &&
      existing.status !== DeclarationWorkpaperStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Τροποποιητική ΦΠΑ δημιουργείται μόνο μετά την καταχώριση της επίσημης υποβολής.',
      );
    }
    const revision = existing ? existing.revision + 1 : 0;

    return this.prisma.declarationWorkpaper.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        type: DeclarationWorkpaperType.VAT_RETURN,
        title,
        periodYear: dto.year,
        periodMonth: period.kind === DeclarationWorkpaperPeriodKind.ANNUAL ? null : period.endMonth,
        periodKind: period.kind,
        periodStartMonth: period.startMonth,
        periodEndMonth: period.endMonth,
        returnType:
          revision === 0 ? DeclarationReturnType.INITIAL : DeclarationReturnType.AMENDING,
        revision,
        submissionDeadline: defaultVatSubmissionDeadline(dto.year, period.endMonth),
        totals,
      },
      include: { taxPayments: { orderBy: { installmentNumber: 'asc' } } },
    });
  }

  async markReady(tenant: TenantContext, id: string) {
    const workpaper = await this.getTenantWorkpaper(tenant, id);
    if (workpaper.status !== DeclarationWorkpaperStatus.DRAFT) {
      throw new BadRequestException('Only a draft workpaper can be submitted for approval.');
    }
    return this.prisma.declarationWorkpaper.update({
      where: { id: workpaper.id },
      data: { status: DeclarationWorkpaperStatus.READY },
    });
  }

  async approve(tenant: TenantContext, id: string) {
    const workpaper = await this.getTenantWorkpaper(tenant, id);
    if (workpaper.status !== DeclarationWorkpaperStatus.READY) {
      throw new BadRequestException('Mark the workpaper ready before accountant approval.');
    }
    if (workpaper.periodKind === DeclarationWorkpaperPeriodKind.ANNUAL) {
      throw new BadRequestException('Approval currently requires a monthly or quarterly period.');
    }
    const approvedClose = await this.prisma.periodCloseReview.findFirst({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: workpaper.clientCompanyId,
        periodYear: workpaper.periodYear,
        kind:
          workpaper.periodKind === DeclarationWorkpaperPeriodKind.QUARTERLY
            ? PeriodCloseKind.QUARTERLY
            : PeriodCloseKind.MONTHLY,
        status: 'APPROVED',
        startMonth: { lte: workpaper.periodStartMonth },
        endMonth: { gte: workpaper.periodEndMonth },
      },
      select: { id: true },
    });
    if (!approvedClose) {
      throw new BadRequestException(
        'Approve the related period close review before approving this declaration workpaper.',
      );
    }

    const updated = await this.prisma.declarationWorkpaper.update({
      where: { id: workpaper.id },
      data: {
        status: DeclarationWorkpaperStatus.APPROVED,
        approvedById: await this.resolveTenantUserId(tenant),
        approvedAt: new Date(),
        periodCloseReviewId: approvedClose.id,
      },
    });
    await this.recordAudit(tenant, workpaper.id, 'DECLARATION_WORKPAPER_APPROVED', {
      periodCloseReviewId: approvedClose.id,
    });
    return updated;
  }

  async submit(tenant: TenantContext, id: string, dto: SubmitDeclarationWorkpaperDto) {
    const workpaper = await this.getTenantWorkpaper(tenant, id);
    if (workpaper.status !== DeclarationWorkpaperStatus.APPROVED) {
      throw new BadRequestException('Only an approved workpaper can be recorded as submitted.');
    }
    const submissionDate = new Date(dto.submissionDate);
    if (Number.isNaN(submissionDate.getTime())) {
      throw new BadRequestException('Submission date is invalid.');
    }
    if (workpaper.type === DeclarationWorkpaperType.VAT_RETURN) {
      return this.submitVatWorkpaper(tenant, workpaper, dto, submissionDate);
    }

    const attachments = dto.attachments?.map((attachment) => ({
      name: attachment.name.trim(),
      url: attachment.url.trim(),
    }));
    const updated = await this.prisma.declarationWorkpaper.update({
      where: { id: workpaper.id },
      data: {
        status: DeclarationWorkpaperStatus.SUBMITTED,
        submittedAt: new Date(),
        submissionReference: dto.submissionReference.trim(),
        submissionDate,
        submissionAttachments:
          attachments === undefined
            ? Prisma.JsonNull
            : (attachments as unknown as Prisma.InputJsonValue),
        notes: dto.notes === undefined ? undefined : dto.notes.trim() || null,
      },
    });
    await this.recordAudit(tenant, workpaper.id, 'DECLARATION_WORKPAPER_SUBMITTED', {
      submissionReference: updated.submissionReference,
      submissionDate: updated.submissionDate,
      attachmentCount: attachments?.length ?? 0,
    });
    return updated;
  }

  async reopen(tenant: TenantContext, id: string) {
    const workpaper = await this.getTenantWorkpaper(tenant, id);
    if (
      workpaper.status !== DeclarationWorkpaperStatus.READY &&
      workpaper.status !== DeclarationWorkpaperStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Only a ready or approved workpaper can be returned to draft.',
      );
    }
    const updated = await this.prisma.declarationWorkpaper.update({
      where: { id },
      data: {
        status: DeclarationWorkpaperStatus.DRAFT,
        approvedById: null,
        approvedAt: null,
        periodCloseReviewId: null,
      },
    });
    await this.recordAudit(tenant, id, 'DECLARATION_WORKPAPER_REOPENED', {});
    return updated;
  }

  async payTaxPayment(
    tenant: TenantContext,
    paymentId: string,
    dto: PayDeclarationTaxPaymentDto,
  ) {
    const payment = await this.prisma.declarationTaxPayment.findFirst({
      where: {
        id: paymentId,
        declarationWorkpaper: {
          accountingOfficeId: tenant.accountingOfficeId,
          type: DeclarationWorkpaperType.VAT_RETURN,
          status: DeclarationWorkpaperStatus.SUBMITTED,
        },
      },
    });
    if (!payment) {
      throw new NotFoundException('VAT payment installment was not found.');
    }
    if (payment.paidAt) {
      throw new BadRequestException('This VAT installment is already recorded as paid.');
    }
    const paidAt = new Date(dto.paidAt);
    const updated = await this.prisma.declarationTaxPayment.update({
      where: { id: payment.id },
      data: {
        paidAt,
        paymentReference: dto.paymentReference.trim(),
        latePayment: isVatActionLate(paidAt, payment.dueDate),
        notes: dto.notes?.trim() || null,
      },
    });
    await this.recordAudit(
      tenant,
      payment.declarationWorkpaperId,
      'VAT_INSTALLMENT_PAID',
      {
        installmentNumber: payment.installmentNumber,
        paidAt,
        paymentReference: updated.paymentReference,
        latePayment: updated.latePayment,
      },
    );
    return updated;
  }

  async archive(tenant: TenantContext, id: string) {
    const workpaper = await this.getTenantWorkpaper(tenant, id);
    if (workpaper.status !== DeclarationWorkpaperStatus.SUBMITTED) {
      throw new BadRequestException('Only a submitted workpaper can be archived.');
    }
    const updated = await this.prisma.declarationWorkpaper.update({
      where: { id: workpaper.id },
      data: { status: DeclarationWorkpaperStatus.ARCHIVED },
    });
    await this.recordAudit(tenant, workpaper.id, 'DECLARATION_WORKPAPER_ARCHIVED', {
      submissionReference: workpaper.submissionReference,
    });
    return updated;
  }

  private async recordAudit(
    tenant: TenantContext,
    entityId: string,
    event: string,
    details: object,
  ) {
    await this.audit.record({
      tenant,
      action: 'UPDATE',
      entityType: 'DeclarationWorkpaper',
      entityId,
      newValue: { event, ...details } as Prisma.InputJsonValue,
    });
  }

  private async submitVatWorkpaper(
    tenant: TenantContext,
    workpaper: Awaited<ReturnType<DeclarationsService['getTenantWorkpaper']>>,
    dto: SubmitDeclarationWorkpaperDto,
    submissionDate: Date,
  ) {
    if (!dto.vatResult) {
      throw new BadRequestException(
        'VAT result, debt identity and payment schedule are required.',
      );
    }
    const deadline = dto.submissionDeadline
      ? new Date(dto.submissionDeadline)
      : workpaper.submissionDeadline ??
        defaultVatSubmissionDeadline(workpaper.periodYear, workpaper.periodEndMonth);
    const lateSubmission = isVatActionLate(submissionDate, deadline);
    validateVatResult(dto.vatResult, lateSubmission);

    const currentTotals = await this.calculateVatTotals(
      tenant,
      workpaper.clientCompanyId,
      workpaper.periodYear,
      {
        kind: workpaper.periodKind,
        startMonth: workpaper.periodStartMonth,
        endMonth: workpaper.periodEndMonth,
      },
    );
    if (!sameVatTotals(workpaper.totals, currentTotals)) {
      throw new BadRequestException(
        'Τα δεδομένα ΦΠΑ ή myDATA άλλαξαν μετά την έγκριση. Επιστρέψτε το workpaper σε πρόχειρο, ανανεώστε και εγκρίνετε ξανά.',
      );
    }

    const attachments = dto.attachments?.map((attachment) => ({
      name: attachment.name.trim(),
      url: attachment.url.trim(),
    }));
    const result = dto.vatResult;
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.declarationTaxPayment.deleteMany({
        where: { declarationWorkpaperId: workpaper.id },
      });
      const saved = await tx.declarationWorkpaper.update({
        where: { id: workpaper.id },
        data: {
          status: DeclarationWorkpaperStatus.SUBMITTED,
          submittedAt: new Date(),
          submissionReference: dto.submissionReference.trim(),
          submissionDate,
          submissionDeadline: deadline,
          lateSubmission,
          submissionAttachments:
            attachments === undefined
              ? Prisma.JsonNull
              : (attachments as unknown as Prisma.InputJsonValue),
          notes: dto.notes === undefined ? undefined : dto.notes.trim() || null,
          vatPayableAmount: result.payableAmount,
          vatCreditCarryForward: result.creditCarryForward,
          vatRefundClaim: result.refundClaim,
          vatDebtId: result.debtId?.trim() || null,
          taxPayments: {
            create: result.payments.map((payment) => ({
              installmentNumber: payment.installmentNumber,
              dueDate: new Date(payment.dueDate),
              amount: payment.amount,
            })),
          },
        },
        include: { taxPayments: { orderBy: { installmentNumber: 'asc' } } },
      });
      const obligation = await tx.officeObligation.findFirst({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: workpaper.clientCompanyId,
          type: ObligationType.VAT_RETURN,
          periodYear: workpaper.periodYear,
          periodMonth: workpaper.periodEndMonth,
        },
      });
      if (obligation) {
        await tx.officeObligation.update({
          where: { id: obligation.id },
          data: { status: ObligationStatus.SUBMITTED, completedAt: submissionDate },
        });
      }
      return saved;
    });
    await this.recordAudit(tenant, workpaper.id, 'VAT_RETURN_SUBMITTED', {
      submissionReference: updated.submissionReference,
      submissionDate: updated.submissionDate,
      lateSubmission: updated.lateSubmission,
      payableAmount: Number(updated.vatPayableAmount),
      creditCarryForward: Number(updated.vatCreditCarryForward),
      refundClaim: Number(updated.vatRefundClaim),
      paymentCount: updated.taxPayments.length,
    });
    return updated;
  }

  private async calculateVatTotals(
    tenant: TenantContext,
    clientCompanyId: string,
    year: number,
    period: WorkpaperPeriod,
    knownCompanyVatNumber?: string,
  ) {
    const dateFilter = toPeriodDateFilter(year, period.startMonth, period.endMonth);
    const [documents, snapshots, company] = await Promise.all([
      this.prisma.document.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          deletedAt: null,
          issueDate: dateFilter,
        },
      }),
      this.prisma.myDataSnapshot.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          issueDate: dateFilter,
        },
        orderBy: { fetchedAt: 'desc' },
      }),
      knownCompanyVatNumber
        ? Promise.resolve(undefined)
        : this.prisma.clientCompany.findFirst({
            where: {
              id: clientCompanyId,
              accountingOfficeId: tenant.accountingOfficeId,
              deletedAt: null,
            },
            select: { vatNumber: true },
          }),
    ]);
    if (!knownCompanyVatNumber && !company) {
      throw new NotFoundException('Client company was not found.');
    }
    return toVatTotals(
      documents,
      snapshots,
      knownCompanyVatNumber ?? company?.vatNumber ?? '',
    );
  }

  private async getTenantWorkpaper(tenant: TenantContext, id: string) {
    const workpaper = await this.prisma.declarationWorkpaper.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!workpaper) {
      throw new NotFoundException('Declaration workpaper was not found.');
    }
    return workpaper;
  }

  private async resolveTenantUserId(tenant: TenantContext): Promise<string | undefined> {
    if (!tenant.userId) {
      return undefined;
    }
    const user = await this.prisma.user.findFirst({
      where: { id: tenant.userId, accountingOfficeId: tenant.accountingOfficeId },
      select: { id: true },
    });
    return user?.id;
  }
}

function toPeriodDateFilter(
  year: number,
  startMonth: number,
  endMonth: number,
): Prisma.DateTimeFilter {
  return {
    gte: new Date(Date.UTC(year, startMonth - 1, 1)),
    lt: new Date(Date.UTC(year, endMonth, 1)),
  };
}

interface WorkpaperPeriod {
  kind: DeclarationWorkpaperPeriodKind;
  startMonth: number;
  endMonth: number;
}

function resolveWorkpaperPeriod(dto: GenerateVatWorkpaperDto): WorkpaperPeriod {
  const kind =
    dto.periodKind ??
    (dto.month ? DeclarationWorkpaperPeriodKind.MONTHLY : DeclarationWorkpaperPeriodKind.ANNUAL);
  if (kind === DeclarationWorkpaperPeriodKind.ANNUAL) {
    return { kind, startMonth: 1, endMonth: 12 };
  }
  if (!dto.month) {
    throw new BadRequestException('month is required for monthly and quarterly workpapers.');
  }
  if (kind === DeclarationWorkpaperPeriodKind.QUARTERLY) {
    if (![3, 6, 9, 12].includes(dto.month)) {
      throw new BadRequestException('Quarterly workpapers require month 3, 6, 9, or 12.');
    }
    return { kind, startMonth: dto.month - 2, endMonth: dto.month };
  }
  return { kind, startMonth: dto.month, endMonth: dto.month };
}

function workpaperTitle(year: number, period: WorkpaperPeriod): string {
  if (period.kind === DeclarationWorkpaperPeriodKind.ANNUAL) {
    return `Workpaper ΦΠΑ ${year}`;
  }
  if (period.kind === DeclarationWorkpaperPeriodKind.QUARTERLY) {
    return `Workpaper ΦΠΑ τριμήνου ${String(period.startMonth).padStart(2, '0')}-${String(period.endMonth).padStart(2, '0')}/${year}`;
  }
  return `Workpaper ΦΠΑ ${String(period.endMonth).padStart(2, '0')}/${year}`;
}

function validateVatResult(result: VatDeclarationResultDto, lateSubmission: boolean) {
  if (result.payableAmount > 0 && (result.creditCarryForward > 0 || result.refundClaim > 0)) {
    throw new BadRequestException(
      'A VAT return cannot be both payable and credit/refund at the same time.',
    );
  }
  if (result.payableAmount <= 0) {
    if (result.payments.length > 0 || result.debtId?.trim()) {
      throw new BadRequestException(
        'A zero or credit VAT return must not contain debt identity or payment installments.',
      );
    }
    return;
  }
  if (!result.debtId?.trim()) {
    throw new BadRequestException('Debt identity is required for a payable VAT return.');
  }
  if (result.payments.length < 1 || result.payments.length > 2) {
    throw new BadRequestException('A payable VAT return requires one or two installments.');
  }
  if (result.payableAmount <= 100 && result.payments.length !== 1) {
    throw new BadRequestException(
      'Two VAT installments are available only when the payable amount exceeds 100 euros.',
    );
  }
  if (lateSubmission && result.payments.length === 2) {
    throw new BadRequestException(
      'Two VAT installments are available only for a timely declaration.',
    );
  }
  const numbers = result.payments.map((payment) => payment.installmentNumber).sort();
  if (
    new Set(numbers).size !== numbers.length ||
    numbers.some((number, index) => number !== index + 1)
  ) {
    throw new BadRequestException('VAT installment numbers must be consecutive and unique.');
  }
  const paymentTotal = roundMoney(
    result.payments.reduce((sum, payment) => sum + payment.amount, 0),
  );
  if (paymentTotal !== roundMoney(result.payableAmount)) {
    throw new BadRequestException(
      'VAT installment total does not agree with the payable declaration amount.',
    );
  }
}

function sameVatTotals(previous: Prisma.JsonValue, current: Prisma.InputJsonValue): boolean {
  const summary = (value: Prisma.JsonValue | Prisma.InputJsonValue) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    const item = value as Record<string, unknown>;
    const reconciliation =
      item['myDataReconciliation'] &&
      typeof item['myDataReconciliation'] === 'object' &&
      !Array.isArray(item['myDataReconciliation'])
        ? (item['myDataReconciliation'] as Record<string, unknown>)
        : {};
    return {
      salesNet: Number(item['salesNet'] ?? 0),
      salesVat: Number(item['salesVat'] ?? 0),
      purchasesNet: Number(item['purchasesNet'] ?? 0),
      purchasesVat: Number(item['purchasesVat'] ?? 0),
      payableVat: Number(item['payableVat'] ?? 0),
      documentCount: Number(item['documentCount'] ?? 0),
      failedMyData: Number(item['failedMyData'] ?? 0),
      reconciliationMismatches: Number(reconciliation['mismatches'] ?? 0),
      aadeSalesNet: Number(reconciliation['aadeSalesNet'] ?? 0),
      aadeSalesVat: Number(reconciliation['aadeSalesVat'] ?? 0),
      aadePurchasesNet: Number(reconciliation['aadePurchasesNet'] ?? 0),
      aadePurchasesVat: Number(reconciliation['aadePurchasesVat'] ?? 0),
      salesNetDelta: Number(reconciliation['salesNetDelta'] ?? 0),
      salesVatDelta: Number(reconciliation['salesVatDelta'] ?? 0),
      purchasesNetDelta: Number(reconciliation['purchasesNetDelta'] ?? 0),
      purchasesVatDelta: Number(reconciliation['purchasesVatDelta'] ?? 0),
    };
  };
  return JSON.stringify(summary(previous)) === JSON.stringify(summary(current));
}

interface VatBreakdownRow {
  vatCategory: string;
  salesNet: number;
  salesVat: number;
  purchasesNet: number;
  purchasesVat: number;
  payableVat: number;
  documents: number;
}

interface DocumentTypeBreakdownRow {
  documentType: string;
  net: number;
  vat: number;
  total: number;
  documents: number;
}

function toVatTotals(
  documents: Array<{
    documentType: DocumentType;
    movementCode?: string | null;
    vatCategory: string;
    netAmount: Prisma.Decimal;
    vatAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    myDataStatus: string;
  }>,
  snapshots: Array<{
    mark: string;
    issuerVatNumber?: string | null;
    invoiceType?: string | null;
    netAmount?: Prisma.Decimal | null;
    vatAmount?: Prisma.Decimal | null;
    reconciliationStatus: string;
  }> = [],
  companyVatNumber = '',
): Prisma.InputJsonValue {
  const uniqueSnapshots = [
    ...new Map(snapshots.map((snapshot) => [snapshot.mark, snapshot])).values(),
  ];
  const totals = {
    salesNet: 0,
    salesVat: 0,
    purchasesNet: 0,
    purchasesVat: 0,
    payableVat: 0,
    documentCount: documents.length,
    failedMyData: documents.filter((document) => document.myDataStatus === 'FAILED').length,
    vatBreakdown: [] as VatBreakdownRow[],
    documentTypeBreakdown: [] as DocumentTypeBreakdownRow[],
    myDataReconciliation: {
      snapshotCount: uniqueSnapshots.length,
      mismatches: uniqueSnapshots.filter((snapshot) => snapshot.reconciliationStatus !== 'MATCHED')
        .length,
      erpSalesNet: 0,
      erpSalesVat: 0,
      erpPurchasesNet: 0,
      erpPurchasesVat: 0,
      aadeSalesNet: 0,
      aadeSalesVat: 0,
      aadePurchasesNet: 0,
      aadePurchasesVat: 0,
      salesNetDelta: 0,
      salesVatDelta: 0,
      purchasesNetDelta: 0,
      purchasesVatDelta: 0,
    },
  };
  const vatBreakdown = new Map<string, (typeof totals.vatBreakdown)[number]>();
  const documentTypeBreakdown = new Map<string, (typeof totals.documentTypeBreakdown)[number]>();

  for (const document of documents) {
    const sign =
      document.documentType === DocumentType.CREDIT_NOTE ||
      document.documentType === DocumentType.PURCHASE_CREDIT_NOTE
      ? -1
      : 1;
    const net = roundMoney(Number(document.netAmount) * sign);
    const vat = roundMoney(Number(document.vatAmount) * sign);
    const total = roundMoney(Number(document.totalAmount) * sign);
    const vatRow = getVatBreakdownRow(vatBreakdown, document.vatCategory);
    const typeRow = getDocumentTypeBreakdownRow(documentTypeBreakdown, document.documentType);

    if (isPurchaseDocument(document)) {
      totals.purchasesNet += net;
      totals.purchasesVat += vat;
      vatRow.purchasesNet += net;
      vatRow.purchasesVat += vat;
    } else {
      totals.salesNet += net;
      totals.salesVat += vat;
      vatRow.salesNet += net;
      vatRow.salesVat += vat;
    }

    vatRow.payableVat = roundMoney(vatRow.salesVat - vatRow.purchasesVat);
    vatRow.documents += 1;
    typeRow.net += net;
    typeRow.vat += vat;
    typeRow.total += total;
    typeRow.documents += 1;
  }

  totals.payableVat = roundMoney(totals.salesVat - totals.purchasesVat);
  totals.salesNet = roundMoney(totals.salesNet);
  totals.salesVat = roundMoney(totals.salesVat);
  totals.purchasesNet = roundMoney(totals.purchasesNet);
  totals.purchasesVat = roundMoney(totals.purchasesVat);
  totals.vatBreakdown = [...vatBreakdown.values()].map((row) => ({
    ...row,
    salesNet: roundMoney(row.salesNet),
    salesVat: roundMoney(row.salesVat),
    purchasesNet: roundMoney(row.purchasesNet),
    purchasesVat: roundMoney(row.purchasesVat),
    payableVat: roundMoney(row.payableVat),
  }));
  totals.documentTypeBreakdown = [...documentTypeBreakdown.values()].map((row) => ({
    ...row,
    net: roundMoney(row.net),
    vat: roundMoney(row.vat),
    total: roundMoney(row.total),
  }));

  const reconciliation = totals.myDataReconciliation;
  reconciliation.erpSalesNet = totals.salesNet;
  reconciliation.erpSalesVat = totals.salesVat;
  reconciliation.erpPurchasesNet = totals.purchasesNet;
  reconciliation.erpPurchasesVat = totals.purchasesVat;
  for (const snapshot of uniqueSnapshots) {
    const sign = snapshot.invoiceType?.startsWith('5.') ? -1 : 1;
    const net = Number(snapshot.netAmount ?? 0) * sign;
    const vat = Number(snapshot.vatAmount ?? 0) * sign;
    if (snapshot.issuerVatNumber === companyVatNumber) {
      reconciliation.aadeSalesNet += net;
      reconciliation.aadeSalesVat += vat;
    } else {
      reconciliation.aadePurchasesNet += net;
      reconciliation.aadePurchasesVat += vat;
    }
  }
  reconciliation.aadeSalesNet = roundMoney(reconciliation.aadeSalesNet);
  reconciliation.aadeSalesVat = roundMoney(reconciliation.aadeSalesVat);
  reconciliation.aadePurchasesNet = roundMoney(reconciliation.aadePurchasesNet);
  reconciliation.aadePurchasesVat = roundMoney(reconciliation.aadePurchasesVat);
  reconciliation.salesNetDelta = roundMoney(
    reconciliation.erpSalesNet - reconciliation.aadeSalesNet,
  );
  reconciliation.salesVatDelta = roundMoney(
    reconciliation.erpSalesVat - reconciliation.aadeSalesVat,
  );
  reconciliation.purchasesNetDelta = roundMoney(
    reconciliation.erpPurchasesNet - reconciliation.aadePurchasesNet,
  );
  reconciliation.purchasesVatDelta = roundMoney(
    reconciliation.erpPurchasesVat - reconciliation.aadePurchasesVat,
  );

  return totals as unknown as Prisma.InputJsonValue;
}

function isPurchaseDocument(document: {
  documentType: DocumentType;
  movementCode?: string | null;
}): boolean {
  return (
    document.documentType === DocumentType.PURCHASE_INVOICE ||
    document.documentType === DocumentType.PURCHASE_CREDIT_NOTE ||
    ['PURCHASE_INVOICE', 'PURCHASE_CREDIT_NOTE'].includes(document.movementCode ?? '')
  );
}

function getVatBreakdownRow(rows: Map<string, VatBreakdownRow>, vatCategory: string) {
  const existing = rows.get(vatCategory);
  if (existing) {
    return existing;
  }

  const row = {
    vatCategory,
    salesNet: 0,
    salesVat: 0,
    purchasesNet: 0,
    purchasesVat: 0,
    payableVat: 0,
    documents: 0,
  };
  rows.set(vatCategory, row);
  return row;
}

function getDocumentTypeBreakdownRow(
  rows: Map<string, DocumentTypeBreakdownRow>,
  documentType: DocumentType,
) {
  const existing = rows.get(documentType);
  if (existing) {
    return existing;
  }

  const row = {
    documentType,
    net: 0,
    vat: 0,
    total: 0,
    documents: 0,
  };
  rows.set(documentType, row);
  return row;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
