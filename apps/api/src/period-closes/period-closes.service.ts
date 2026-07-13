import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DocumentType,
  MyDataReconciliationStatus,
  MyDataStatus,
  PeriodCloseKind,
  PeriodCloseReviewStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { GeneratePeriodCloseDto } from './dto/generate-period-close.dto';
import { UpdatePeriodCloseCheckDto } from './dto/update-period-close-check.dto';

interface CloseCheck {
  code: string;
  label: string;
  completed: boolean;
  automatic: boolean;
  blocking: boolean;
  details: string;
}

@Injectable()
export class PeriodClosesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    tenant: TenantContext,
    filters: {
      clientCompanyId?: string;
      year?: number;
      kind?: PeriodCloseKind;
      status?: PeriodCloseReviewStatus;
    } = {},
  ) {
    return this.prisma.periodCloseReview.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: filters.clientCompanyId,
        periodYear: filters.year,
        kind: filters.kind,
        status: filters.status,
      },
      include: {
        clientCompany: { select: { id: true, legalName: true, vatNumber: true } },
        preparedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
      orderBy: [{ periodYear: 'desc' }, { endMonth: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async generate(tenant: TenantContext, dto: GeneratePeriodCloseDto) {
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

    const { startMonth, endMonth } = resolvePeriod(dto.kind, dto.endMonth);
    const dateFilter = toDateFilter(dto.year, startMonth, endMonth);
    const [documents, journalEntries, snapshots, vatWorkpaper, existing] = await Promise.all([
      this.prisma.document.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: dto.clientCompanyId,
          deletedAt: null,
          issueDate: dateFilter,
        },
        include: { accountingLinks: { select: { id: true } } },
      }),
      this.prisma.journalEntry.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: dto.clientCompanyId,
          entryDate: dateFilter,
          status: 'POSTED',
        },
        include: { lines: { select: { debit: true, credit: true } } },
      }),
      this.prisma.myDataSnapshot.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: dto.clientCompanyId,
          issueDate: dateFilter,
        },
        orderBy: { fetchedAt: 'desc' },
      }),
      this.prisma.declarationWorkpaper.findFirst({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: dto.clientCompanyId,
          type: 'VAT_RETURN',
          periodYear: dto.year,
          periodMonth: endMonth,
        },
      }),
      this.prisma.periodCloseReview.findFirst({
        where: {
          clientCompanyId: dto.clientCompanyId,
          kind: dto.kind,
          periodYear: dto.year,
          endMonth,
        },
      }),
    ]);

    const summary = buildReviewSummary(documents, journalEntries, snapshots, company.vatNumber);
    const checklist = buildChecklist(summary, Boolean(vatWorkpaper), readChecklist(existing?.checklist));
    const preparedById = await this.resolveTenantUserId(tenant);
    const data = {
      accountingOfficeId: tenant.accountingOfficeId,
      clientCompanyId: dto.clientCompanyId,
      kind: dto.kind,
      periodYear: dto.year,
      startMonth,
      endMonth,
      status: PeriodCloseReviewStatus.DRAFT,
      checklist: checklist as unknown as Prisma.InputJsonValue,
      reviewSummary: summary as unknown as Prisma.InputJsonValue,
      preparedById,
      preparedAt: new Date(),
      submittedAt: null,
      approvedById: null,
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
    };

    return this.prisma.periodCloseReview.upsert({
      where: {
        clientCompanyId_kind_periodYear_endMonth: {
          clientCompanyId: dto.clientCompanyId,
          kind: dto.kind,
          periodYear: dto.year,
          endMonth,
        },
      },
      update: data,
      create: data,
      include: periodCloseInclude,
    });
  }

  async updateChecklist(tenant: TenantContext, id: string, dto: UpdatePeriodCloseCheckDto) {
    const review = await this.getTenantReview(tenant, id);
    if (review.status === PeriodCloseReviewStatus.READY_FOR_REVIEW) {
      throw new BadRequestException('A submitted review cannot be edited.');
    }
    if (review.status === PeriodCloseReviewStatus.APPROVED) {
      throw new BadRequestException('An approved review cannot be edited.');
    }

    const checklist = readChecklist(review.checklist);
    const item = checklist.find((candidate) => candidate.code === dto.code);
    if (!item) {
      throw new BadRequestException(`Unknown close checklist item ${dto.code}.`);
    }
    item.completed = dto.completed;

    return this.prisma.periodCloseReview.update({
      where: { id: review.id },
      data: {
        checklist: checklist as unknown as Prisma.InputJsonValue,
        status: PeriodCloseReviewStatus.DRAFT,
        rejectionReason: null,
        rejectedAt: null,
      },
      include: periodCloseInclude,
    });
  }

  async submit(tenant: TenantContext, id: string) {
    const review = await this.getTenantReview(tenant, id);
    if (review.status === PeriodCloseReviewStatus.APPROVED) {
      throw new BadRequestException('The period close review is already approved.');
    }
    const incomplete = readChecklist(review.checklist).filter(
      (item) => item.blocking && !item.completed,
    );
    if (incomplete.length > 0) {
      throw new BadRequestException(
        `Complete all blocking checks before review: ${incomplete.map((item) => item.label).join(', ')}.`,
      );
    }

    return this.prisma.periodCloseReview.update({
      where: { id: review.id },
      data: {
        status: PeriodCloseReviewStatus.READY_FOR_REVIEW,
        submittedAt: new Date(),
      },
      include: periodCloseInclude,
    });
  }

  async approve(tenant: TenantContext, id: string) {
    const review = await this.getTenantReview(tenant, id);
    if (review.status !== PeriodCloseReviewStatus.READY_FOR_REVIEW) {
      throw new BadRequestException('Submit the period close review before approval.');
    }

    return this.prisma.periodCloseReview.update({
      where: { id: review.id },
      data: {
        status: PeriodCloseReviewStatus.APPROVED,
        approvedById: await this.resolveTenantUserId(tenant),
        approvedAt: new Date(),
        rejectionReason: null,
        rejectedAt: null,
      },
      include: periodCloseInclude,
    });
  }

  async reject(tenant: TenantContext, id: string, reason: string) {
    const review = await this.getTenantReview(tenant, id);
    if (review.status !== PeriodCloseReviewStatus.READY_FOR_REVIEW) {
      throw new BadRequestException('Only a submitted review can be rejected.');
    }

    return this.prisma.periodCloseReview.update({
      where: { id: review.id },
      data: {
        status: PeriodCloseReviewStatus.REJECTED,
        rejectionReason: reason,
        rejectedAt: new Date(),
        approvedById: null,
        approvedAt: null,
      },
      include: periodCloseInclude,
    });
  }

  private async getTenantReview(tenant: TenantContext, id: string) {
    const review = await this.prisma.periodCloseReview.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!review) {
      throw new NotFoundException('Period close review was not found.');
    }
    return review;
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

const periodCloseInclude = {
  clientCompany: { select: { id: true, legalName: true, vatNumber: true } },
  preparedBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.PeriodCloseReviewInclude;

function resolvePeriod(kind: PeriodCloseKind, endMonth: number) {
  if (kind === PeriodCloseKind.MONTHLY) {
    return { startMonth: endMonth, endMonth };
  }
  if (![3, 6, 9, 12].includes(endMonth)) {
    throw new BadRequestException('Quarterly close end month must be 3, 6, 9 or 12.');
  }
  return { startMonth: endMonth - 2, endMonth };
}

function toDateFilter(year: number, startMonth: number, endMonth: number): Prisma.DateTimeFilter {
  return {
    gte: new Date(Date.UTC(year, startMonth - 1, 1)),
    lt: new Date(Date.UTC(year, endMonth, 1)),
  };
}

function buildReviewSummary(
  documents: Array<{
    documentType: DocumentType;
    movementCode: string | null;
    netAmount: Prisma.Decimal;
    vatAmount: Prisma.Decimal;
    myDataStatus: MyDataStatus;
    myDataMark: string | null;
    accountingLinks: Array<{ id: string }>;
  }>,
  journalEntries: Array<{
    lines: Array<{ debit: Prisma.Decimal; credit: Prisma.Decimal }>;
  }>,
  snapshots: Array<{
    mark: string;
    issuerVatNumber: string | null;
    invoiceType: string | null;
    netAmount: Prisma.Decimal | null;
    vatAmount: Prisma.Decimal | null;
    reconciliationStatus: MyDataReconciliationStatus;
  }>,
  companyVatNumber: string,
) {
  const uniqueSnapshots = [...new Map(snapshots.map((snapshot) => [snapshot.mark, snapshot])).values()];
  const unpostedDocuments = documents.filter((document) => document.accountingLinks.length === 0);
  const failedDocuments = documents.filter((document) => document.myDataStatus === MyDataStatus.FAILED);
  const unresolvedMyDataDocuments = documents.filter((document) => {
    if (document.documentType === DocumentType.PURCHASE_INVOICE) {
      return !document.myDataMark;
    }
    return (
      document.myDataStatus !== MyDataStatus.SENT &&
      document.myDataStatus !== MyDataStatus.CANCELLED
    );
  });
  const reconciliationMismatches = uniqueSnapshots.filter(
    (snapshot) => snapshot.reconciliationStatus !== MyDataReconciliationStatus.MATCHED,
  );
  let journalDebit = 0;
  let journalCredit = 0;
  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      journalDebit += Number(line.debit);
      journalCredit += Number(line.credit);
    }
  }

  const erp = vatSideTotals(documents, (document) =>
    document.documentType === DocumentType.PURCHASE_INVOICE ||
    document.movementCode === 'PURCHASE_INVOICE'
      ? 'purchases'
      : 'sales',
  );
  const aade = vatSideTotals(uniqueSnapshots, (snapshot) =>
    snapshot.issuerVatNumber === companyVatNumber ? 'sales' : 'purchases',
  );

  return {
    documentCount: documents.length,
    unpostedDocuments: unpostedDocuments.length,
    journalEntryCount: journalEntries.length,
    journalDebit: roundMoney(journalDebit),
    journalCredit: roundMoney(journalCredit),
    journalDifference: roundMoney(journalDebit - journalCredit),
    failedMyDataDocuments: failedDocuments.length,
    unresolvedMyDataDocuments: unresolvedMyDataDocuments.length,
    myDataSnapshotCount: uniqueSnapshots.length,
    reconciliationMismatches: reconciliationMismatches.length,
    erpVat: erp,
    aadeVat: aade,
    vatDelta: {
      salesNet: roundMoney(erp.salesNet - aade.salesNet),
      salesVat: roundMoney(erp.salesVat - aade.salesVat),
      purchasesNet: roundMoney(erp.purchasesNet - aade.purchasesNet),
      purchasesVat: roundMoney(erp.purchasesVat - aade.purchasesVat),
    },
  };
}

function vatSideTotals<T extends { invoiceType?: string | null; documentType?: DocumentType; netAmount: Prisma.Decimal | null; vatAmount: Prisma.Decimal | null }>(
  items: T[],
  side: (item: T) => 'sales' | 'purchases',
) {
  const totals = { salesNet: 0, salesVat: 0, purchasesNet: 0, purchasesVat: 0 };
  for (const item of items) {
    const sign = item.documentType === DocumentType.CREDIT_NOTE || item.invoiceType?.startsWith('5.') ? -1 : 1;
    const prefix = side(item) === 'sales' ? 'sales' : 'purchases';
    totals[`${prefix}Net`] += Number(item.netAmount ?? 0) * sign;
    totals[`${prefix}Vat`] += Number(item.vatAmount ?? 0) * sign;
  }
  return {
    salesNet: roundMoney(totals.salesNet),
    salesVat: roundMoney(totals.salesVat),
    purchasesNet: roundMoney(totals.purchasesNet),
    purchasesVat: roundMoney(totals.purchasesVat),
  };
}

function buildChecklist(
  summary: ReturnType<typeof buildReviewSummary>,
  hasVatWorkpaper: boolean,
  previous: CloseCheck[],
): CloseCheck[] {
  const manualSupporting = previous.find(
    (item) => item.code === 'SUPPORTING_DOCUMENTS_REVIEWED',
  )?.completed;
  return [
    check('DOCUMENTS_POSTED', 'Όλα τα παραστατικά έχουν λογιστικοποιηθεί', summary.unpostedDocuments === 0, true, `${summary.unpostedDocuments} μη λογιστικοποιημένα`),
    check('JOURNAL_BALANCED', 'Το ημερολόγιο είναι ισοσκελισμένο', summary.journalDifference === 0, true, `Διαφορά ${summary.journalDifference.toFixed(2)} €`),
    check('MYDATA_RECONCILED', 'Ολοκληρώθηκε η συμφωνία myDATA', summary.unresolvedMyDataDocuments === 0 && summary.reconciliationMismatches === 0, true, `${summary.unresolvedMyDataDocuments} εκκρεμή ERP, ${summary.reconciliationMismatches} αποκλίσεις ΑΑΔΕ`),
    check('FAILED_TRANSMISSIONS_RESOLVED', 'Δεν υπάρχουν αποτυχημένες διαβιβάσεις', summary.failedMyDataDocuments === 0, true, `${summary.failedMyDataDocuments} αποτυχίες`),
    check('VAT_WORKPAPER_READY', 'Δημιουργήθηκε VAT workpaper περιόδου', hasVatWorkpaper, true, hasVatWorkpaper ? 'Διαθέσιμο' : 'Δεν βρέθηκε'),
    check('VAT_RECONCILED', 'Τα σύνολα ΦΠΑ ERP και myDATA συμφωνούν', Object.values(summary.vatDelta).every((value) => value === 0), true, `Διαφορές καθαρών/ΦΠΑ: ${Object.values(summary.vatDelta).map((value) => value.toFixed(2)).join(' / ')} €`),
    check('SUPPORTING_DOCUMENTS_REVIEWED', 'Ελέγχθηκαν τα δικαιολογητικά και οι εξαιρέσεις', manualSupporting ?? false, false, 'Χειροκίνητη επιβεβαίωση'),
  ];
}

function check(
  code: string,
  label: string,
  completed: boolean,
  automatic: boolean,
  details: string,
): CloseCheck {
  return { code, label, completed, automatic, blocking: true, details };
}

function readChecklist(value: Prisma.JsonValue | undefined): CloseCheck[] {
  return Array.isArray(value) ? (value as unknown as CloseCheck[]) : [];
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
