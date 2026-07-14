import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DeclarationWorkpaperStatus,
  DeclarationWorkpaperPeriodKind,
  DeclarationWorkpaperType,
  DocumentType,
  PeriodCloseKind,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { GenerateVatWorkpaperDto } from './dto/generate-vat-workpaper.dto';
import { SubmitDeclarationWorkpaperDto } from './dto/submit-declaration-workpaper.dto';

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
      },
      orderBy: [{ periodYear: 'desc' }, { periodEndMonth: 'desc' }, { generatedAt: 'desc' }],
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
    const dateFilter = toPeriodDateFilter(dto.year, period.startMonth, period.endMonth);
    const [documents, snapshots] = await Promise.all([
      this.prisma.document.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: dto.clientCompanyId,
          deletedAt: null,
          issueDate: dateFilter,
        },
      }),
      this.prisma.myDataSnapshot.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: dto.clientCompanyId,
          issueDate: dateFilter,
        },
        orderBy: { fetchedAt: 'desc' },
      }),
    ]);
    const totals = toVatTotals(documents, snapshots, company.vatNumber);
    const title = workpaperTitle(dto.year, period);

    const existing = await this.prisma.declarationWorkpaper.findFirst({
      where: {
        clientCompanyId: dto.clientCompanyId,
        type: DeclarationWorkpaperType.VAT_RETURN,
        periodYear: dto.year,
        periodKind: period.kind,
        periodEndMonth: period.endMonth,
      },
    });

    if (existing) {
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
        },
      });
    }

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
        totals,
      },
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
    const sign = document.documentType === DocumentType.CREDIT_NOTE ? -1 : 1;
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
    document.movementCode === 'PURCHASE_INVOICE'
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
