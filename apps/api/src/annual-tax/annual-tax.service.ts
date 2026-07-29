import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AnnualTaxReturnKind,
  AnnualTaxReturnStatus,
  AnnualTaxReturnType,
  AuditAction,
  ChartAccountType,
  ClientEntityType,
  JournalEntrySource,
  JournalEntryStatus,
  MyDataReconciliationStatus,
  MyDataSnapshotReviewStatus,
  MyDataSyncSource,
  ObligationStatus,
  ObligationType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import {
  calculateTaxableResult,
  defaultAnnualTaxDeadline,
  isLate,
} from './annual-tax-calculator';
import {
  GenerateAnnualTaxReturnDto,
  PayAnnualTaxInstallmentDto,
  SubmitAnnualTaxReturnDto,
  UpdateAnnualTaxReturnDto,
} from './dto/annual-tax.dto';

interface AnnualTaxChecklist {
  booksReconciled: boolean;
  myDataReviewed: boolean;
  depreciationsReviewed: boolean;
  inventoryReviewed: boolean;
  taxAdjustmentsReviewed: boolean;
  formsReviewed: boolean;
}

const EMPTY_CHECKLIST: AnnualTaxChecklist = {
  booksReconciled: false,
  myDataReviewed: false,
  depreciationsReviewed: false,
  inventoryReviewed: false,
  taxAdjustmentsReviewed: false,
  formsReviewed: false,
};

@Injectable()
export class AnnualTaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(tenant: TenantContext, clientCompanyId?: string, fiscalYear?: number) {
    return this.prisma.annualTaxReturn.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
        fiscalYear,
      },
      include: annualTaxInclude,
      orderBy: [{ fiscalYear: 'desc' }, { revision: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async generate(tenant: TenantContext, dto: GenerateAnnualTaxReturnDto) {
    const company = await this.prisma.clientCompany.findFirst({
      where: {
        id: dto.clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });
    if (!company) {
      throw new NotFoundException('Ο πελάτης δεν βρέθηκε.');
    }
    if (company.fiscalYearStart !== 1 || company.fiscalYearEnd !== 12) {
      throw new BadRequestException(
        'Το ετήσιο φορολογικό κλείσιμο υποστηρίζει προς το παρόν μόνο χρήση 1/1–31/12. Δεν δημιουργήθηκε φύλλο με πιθανώς λανθασμένη περίοδο.',
      );
    }

    const kind = dto.kind ?? returnKindForEntity(company.entityType);
    const latest = await this.prisma.annualTaxReturn.findFirst({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: company.id,
        fiscalYear: dto.fiscalYear,
        kind,
      },
      orderBy: { revision: 'desc' },
    });

    if (latest && latest.status !== AnnualTaxReturnStatus.DRAFT) {
      if (!dto.createAmending) {
        throw new BadRequestException(
          latest.status === AnnualTaxReturnStatus.SUBMITTED
            ? 'Η αρχική δήλωση έχει υποβληθεί. Δημιουργήστε τροποποιητική δήλωση.'
            : 'Το φύλλο έχει φύγει από το πρόχειρο και δεν μπορεί να ξαναγραφτεί.',
        );
      }
      if (latest.status !== AnnualTaxReturnStatus.SUBMITTED) {
        throw new BadRequestException(
          'Τροποποιητική δημιουργείται μόνο μετά την καταχώριση της επίσημης υποβολής.',
        );
      }
    }

    const snapshot = await this.buildSnapshot(tenant, company.id, dto.fiscalYear);
    if (latest?.status === AnnualTaxReturnStatus.DRAFT) {
      const updated = await this.prisma.annualTaxReturn.update({
        where: { id: latest.id },
        data: {
          ...snapshot,
          taxableResult: calculateTaxableResult({
            accountingResult: snapshot.accountingResult,
            nonDeductibleExpenses: Number(latest.nonDeductibleExpenses),
            taxExemptIncome: Number(latest.taxExemptIncome),
            otherTaxAdditions: Number(latest.otherTaxAdditions),
            otherTaxDeductions: Number(latest.otherTaxDeductions),
            priorTaxLosses: Number(latest.priorTaxLosses),
          }),
        },
        include: annualTaxInclude,
      });
      await this.recordAudit(tenant, updated.id, 'ANNUAL_TAX_REFRESHED', snapshot);
      return updated;
    }

    const revision = latest ? latest.revision + 1 : 0;
    const created = await this.prisma.annualTaxReturn.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: company.id,
        fiscalYear: dto.fiscalYear,
        kind,
        returnType: revision === 0 ? AnnualTaxReturnType.INITIAL : AnnualTaxReturnType.AMENDING,
        revision,
        includesE3: true,
        submissionDeadline: defaultAnnualTaxDeadline(dto.fiscalYear),
        checklist: EMPTY_CHECKLIST as unknown as Prisma.InputJsonValue,
        ...snapshot,
        taxableResult: snapshot.accountingResult,
      },
      include: annualTaxInclude,
    });
    await this.recordAudit(tenant, created.id, 'ANNUAL_TAX_CREATED', {
      fiscalYear: dto.fiscalYear,
      kind,
      revision,
    });
    return created;
  }

  async update(tenant: TenantContext, id: string, dto: UpdateAnnualTaxReturnDto) {
    const annualReturn = await this.getTenantReturn(tenant, id);
    this.requireStatus(annualReturn.status, AnnualTaxReturnStatus.DRAFT);
    if (dto.includesE3 === false) {
      throw new BadRequestException(
        'Το Ε3 είναι υποχρεωτικό για τους επαγγελματίες, τις ατομικές επιχειρήσεις και τα νομικά πρόσωπα.',
      );
    }
    const adjustments = {
      accountingResult: Number(annualReturn.accountingResult),
      nonDeductibleExpenses:
        dto.nonDeductibleExpenses ?? Number(annualReturn.nonDeductibleExpenses),
      taxExemptIncome: dto.taxExemptIncome ?? Number(annualReturn.taxExemptIncome),
      otherTaxAdditions: dto.otherTaxAdditions ?? Number(annualReturn.otherTaxAdditions),
      otherTaxDeductions: dto.otherTaxDeductions ?? Number(annualReturn.otherTaxDeductions),
      priorTaxLosses: dto.priorTaxLosses ?? Number(annualReturn.priorTaxLosses),
    };

    const updated = await this.prisma.annualTaxReturn.update({
      where: { id },
      data: {
        includesE2: dto.includesE2,
        includesE3: dto.includesE3,
        submissionDeadline: dto.submissionDeadline
          ? new Date(dto.submissionDeadline)
          : undefined,
        ...adjustments,
        taxableResult: calculateTaxableResult(adjustments),
        checklist: dto.checklist
          ? (dto.checklist as unknown as Prisma.InputJsonValue)
          : undefined,
        adjustmentNotes:
          dto.adjustmentNotes === undefined ? undefined : dto.adjustmentNotes.trim() || null,
      },
      include: annualTaxInclude,
    });
    await this.recordAudit(tenant, id, 'ANNUAL_TAX_ADJUSTMENTS_UPDATED', {
      taxableResult: Number(updated.taxableResult),
    });
    return updated;
  }

  async markReady(tenant: TenantContext, id: string) {
    const annualReturn = await this.getTenantReturn(tenant, id);
    this.requireStatus(annualReturn.status, AnnualTaxReturnStatus.DRAFT);
    const snapshot = await this.buildSnapshot(
      tenant,
      annualReturn.clientCompanyId,
      annualReturn.fiscalYear,
    );
    const blockers = blockerMessages(snapshot);
    const checklist = readChecklist(annualReturn.checklist);
    if (!Object.values(checklist).every(Boolean)) {
      blockers.push('Δεν έχουν επιβεβαιωθεί όλα τα βήματα του ετήσιου ελέγχου.');
    }
    if (blockers.length) {
      throw new BadRequestException(blockers.join(' '));
    }

    const updated = await this.prisma.annualTaxReturn.update({
      where: { id },
      data: {
        ...snapshot,
        taxableResult: calculateTaxableResult({
          accountingResult: snapshot.accountingResult,
          nonDeductibleExpenses: Number(annualReturn.nonDeductibleExpenses),
          taxExemptIncome: Number(annualReturn.taxExemptIncome),
          otherTaxAdditions: Number(annualReturn.otherTaxAdditions),
          otherTaxDeductions: Number(annualReturn.otherTaxDeductions),
          priorTaxLosses: Number(annualReturn.priorTaxLosses),
        }),
        status: AnnualTaxReturnStatus.READY,
      },
      include: annualTaxInclude,
    });
    await this.recordAudit(tenant, id, 'ANNUAL_TAX_READY', {});
    return updated;
  }

  async approve(tenant: TenantContext, id: string) {
    const annualReturn = await this.getTenantReturn(tenant, id);
    this.requireStatus(annualReturn.status, AnnualTaxReturnStatus.READY);
    const snapshot = await this.buildSnapshot(
      tenant,
      annualReturn.clientCompanyId,
      annualReturn.fiscalYear,
    );
    this.assertSnapshotUnchanged(annualReturn, snapshot);
    const updated = await this.prisma.annualTaxReturn.update({
      where: { id },
      data: {
        status: AnnualTaxReturnStatus.APPROVED,
        approvedById: await this.resolveTenantUserId(tenant),
        approvedAt: new Date(),
      },
      include: annualTaxInclude,
    });
    await this.recordAudit(tenant, id, 'ANNUAL_TAX_APPROVED', {});
    return updated;
  }

  async reopen(tenant: TenantContext, id: string) {
    const annualReturn = await this.getTenantReturn(tenant, id);
    if (
      annualReturn.status !== AnnualTaxReturnStatus.READY &&
      annualReturn.status !== AnnualTaxReturnStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Μόνο φύλλο για έγκριση ή εγκεκριμένο φύλλο μπορεί να επιστρέψει σε πρόχειρο.',
      );
    }
    const updated = await this.prisma.annualTaxReturn.update({
      where: { id },
      data: {
        status: AnnualTaxReturnStatus.DRAFT,
        approvedById: null,
        approvedAt: null,
      },
      include: annualTaxInclude,
    });
    await this.recordAudit(tenant, id, 'ANNUAL_TAX_REOPENED', {});
    return updated;
  }

  async submit(tenant: TenantContext, id: string, dto: SubmitAnnualTaxReturnDto) {
    const annualReturn = await this.getTenantReturn(tenant, id);
    this.requireStatus(annualReturn.status, AnnualTaxReturnStatus.APPROVED);
    const snapshot = await this.buildSnapshot(
      tenant,
      annualReturn.clientCompanyId,
      annualReturn.fiscalYear,
    );
    this.assertSnapshotUnchanged(annualReturn, snapshot);
    const submittedAt = new Date(dto.submittedAt);
    if (dto.totalPayable > 0 && !dto.debtId?.trim()) {
      throw new BadRequestException('Απαιτείται Ταυτότητα Οφειλής όταν υπάρχει πληρωτέο ποσό.');
    }
    validateAssessmentAmounts(dto);
    validateInstallments(dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.annualTaxInstallment.deleteMany({ where: { annualTaxReturnId: id } });
      const result = await tx.annualTaxReturn.update({
        where: { id },
        data: {
          status: AnnualTaxReturnStatus.SUBMITTED,
          submittedAt,
          submissionReference: dto.submissionReference.trim(),
          lateSubmission: isLate(submittedAt, annualReturn.submissionDeadline),
          assessmentReference: dto.assessmentReference.trim(),
          debtId: dto.debtId?.trim() || null,
          assessedIncomeTax: dto.assessedIncomeTax,
          taxPrepayment: dto.taxPrepayment,
          otherAssessedAmounts: dto.otherAssessedAmounts,
          totalPayable: dto.totalPayable,
          refundAmount: dto.refundAmount,
          submissionNotes: dto.submissionNotes?.trim() || null,
          installments: {
            create: dto.installments.map((installment) => ({
              installmentNumber: installment.installmentNumber,
              dueDate: new Date(installment.dueDate),
              amount: installment.amount,
            })),
          },
        },
        include: annualTaxInclude,
      });

      const obligation = await tx.officeObligation.findFirst({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: annualReturn.clientCompanyId,
          type: ObligationType.INCOME_TAX_PREP,
          periodYear: annualReturn.fiscalYear,
          periodMonth: null,
        },
      });
      if (obligation) {
        await tx.officeObligation.update({
          where: { id: obligation.id },
          data: { status: ObligationStatus.SUBMITTED, completedAt: submittedAt },
        });
      }
      return result;
    });
    await this.recordAudit(tenant, id, 'ANNUAL_TAX_SUBMITTED', {
      submissionReference: updated.submissionReference,
      assessmentReference: updated.assessmentReference,
      totalPayable: Number(updated.totalPayable),
      installmentCount: updated.installments.length,
    });
    return updated;
  }

  async payInstallment(
    tenant: TenantContext,
    installmentId: string,
    dto: PayAnnualTaxInstallmentDto,
  ) {
    const installment = await this.prisma.annualTaxInstallment.findFirst({
      where: {
        id: installmentId,
        annualTaxReturn: {
          accountingOfficeId: tenant.accountingOfficeId,
          status: AnnualTaxReturnStatus.SUBMITTED,
        },
      },
    });
    if (!installment) {
      throw new NotFoundException('Η δόση δεν βρέθηκε σε υποβλημένη δήλωση.');
    }
    if (installment.paidAt) {
      throw new BadRequestException('Η δόση έχει ήδη καταχωριστεί ως πληρωμένη.');
    }
    const paidAt = new Date(dto.paidAt);
    const updated = await this.prisma.annualTaxInstallment.update({
      where: { id: installment.id },
      data: {
        paidAt,
        paymentReference: dto.paymentReference.trim(),
        latePayment: isLate(paidAt, installment.dueDate),
        notes: dto.notes?.trim() || null,
      },
    });
    await this.recordAudit(tenant, installment.annualTaxReturnId, 'ANNUAL_TAX_INSTALLMENT_PAID', {
      installmentNumber: installment.installmentNumber,
      paidAt,
      paymentReference: updated.paymentReference,
      latePayment: updated.latePayment,
    });
    return updated;
  }

  private async buildSnapshot(
    tenant: TenantContext,
    clientCompanyId: string,
    fiscalYear: number,
  ) {
    const dateFilter = {
      gte: new Date(Date.UTC(fiscalYear, 0, 1)),
      lt: new Date(Date.UTC(fiscalYear + 1, 0, 1)),
    };
    const [
      journalLines,
      myDataRows,
      unpostedDocumentCount,
      unresolvedMyDataCount,
      periods,
      assets,
    ] = await Promise.all([
      this.prisma.journalEntryLine.findMany({
        where: {
          account: {
            accountingOfficeId: tenant.accountingOfficeId,
            clientCompanyId,
            type: { in: [ChartAccountType.REVENUE, ChartAccountType.EXPENSE] },
          },
          journalEntry: {
            status: JournalEntryStatus.POSTED,
            source: { not: JournalEntrySource.CLOSING },
            entryDate: dateFilter,
          },
        },
        select: { debit: true, credit: true, account: { select: { type: true } } },
      }),
      this.prisma.myDataSnapshot.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          issueDate: dateFilter,
        },
        select: { source: true, invoiceType: true, netAmount: true },
      }),
      this.prisma.document.count({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          deletedAt: null,
          issueDate: dateFilter,
          accountingLinks: { none: {} },
        },
      }),
      this.prisma.myDataSnapshot.count({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          issueDate: dateFilter,
          reconciliationStatus: { not: MyDataReconciliationStatus.MATCHED },
          reviewStatus: MyDataSnapshotReviewStatus.PENDING,
        },
      }),
      this.prisma.accountingPeriod.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          fiscalYear,
        },
        select: { status: true },
      }),
      this.prisma.fixedAsset.findMany({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId,
          acquisitionDate: { lt: dateFilter.lt },
        },
        select: {
          status: true,
          disposalDate: true,
          depreciationEntries: {
            where: { fiscalYear },
            select: { posted: true },
          },
        },
      }),
    ]);

    const bookRevenue = roundMoney(
      journalLines
        .filter((line) => line.account.type === ChartAccountType.REVENUE)
        .reduce((sum, line) => sum + Number(line.credit) - Number(line.debit), 0),
    );
    const bookExpenses = roundMoney(
      journalLines
        .filter((line) => line.account.type === ChartAccountType.EXPENSE)
        .reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0),
    );
    const myDataRevenue = roundMoney(
      myDataRows
        .filter((row) => row.source === MyDataSyncSource.REQUEST_TRANSMITTED_DOCS)
        .reduce(
          (sum, row) =>
            sum +
            Number(row.netAmount ?? 0) *
              (row.invoiceType?.startsWith('5.') ? -1 : 1),
          0,
        ),
    );
    const myDataExpenses = roundMoney(
      myDataRows
        .filter((row) => row.source === MyDataSyncSource.REQUEST_DOCS)
        .reduce(
          (sum, row) =>
            sum +
            Number(row.netAmount ?? 0) *
              (row.invoiceType?.startsWith('5.') ? -1 : 1),
          0,
        ),
    );
    const unpostedDepreciationCount = assets.filter(
      (asset) =>
        (asset.status === 'ACTIVE' ||
          (asset.disposalDate !== null && asset.disposalDate >= dateFilter.gte)) &&
        (asset.depreciationEntries.length === 0 ||
          asset.depreciationEntries.some((entry) => !entry.posted)),
    ).length;

    return {
      bookRevenue,
      bookExpenses,
      accountingResult: roundMoney(bookRevenue - bookExpenses),
      myDataRevenue,
      myDataExpenses,
      unpostedDocumentCount,
      unresolvedMyDataCount,
      openPeriodCount: periods.filter((period) => period.status === 'OPEN').length,
      missingPeriodCount: Math.max(12 - periods.length, 0),
      unpostedDepreciationCount,
    };
  }

  private async getTenantReturn(tenant: TenantContext, id: string) {
    const annualReturn = await this.prisma.annualTaxReturn.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!annualReturn) {
      throw new NotFoundException('Το ετήσιο φορολογικό φύλλο δεν βρέθηκε.');
    }
    return annualReturn;
  }

  private requireStatus(actual: AnnualTaxReturnStatus, expected: AnnualTaxReturnStatus) {
    if (actual !== expected) {
      throw new BadRequestException(`Η ενέργεια απαιτεί κατάσταση ${expected}.`);
    }
  }

  private assertSnapshotUnchanged(
    annualReturn: {
      bookRevenue: Prisma.Decimal;
      bookExpenses: Prisma.Decimal;
      myDataRevenue: Prisma.Decimal;
      myDataExpenses: Prisma.Decimal;
      unpostedDocumentCount: number;
      unresolvedMyDataCount: number;
      openPeriodCount: number;
      missingPeriodCount: number;
      unpostedDepreciationCount: number;
    },
    snapshot: {
      bookRevenue: number;
      bookExpenses: number;
      myDataRevenue: number;
      myDataExpenses: number;
      unpostedDocumentCount: number;
      unresolvedMyDataCount: number;
      openPeriodCount: number;
      missingPeriodCount: number;
      unpostedDepreciationCount: number;
    },
  ) {
    const blockers = blockerMessages(snapshot);
    if (blockers.length) {
      throw new BadRequestException(
        `${blockers.join(' ')} Επιστρέψτε το φύλλο σε πρόχειρο και ανανεώστε το.`,
      );
    }
    const changed =
      Number(annualReturn.bookRevenue) !== snapshot.bookRevenue ||
      Number(annualReturn.bookExpenses) !== snapshot.bookExpenses ||
      Number(annualReturn.myDataRevenue) !== snapshot.myDataRevenue ||
      Number(annualReturn.myDataExpenses) !== snapshot.myDataExpenses;
    if (changed) {
      throw new BadRequestException(
        'Τα βιβλία ή τα δεδομένα myDATA άλλαξαν μετά τον έλεγχο. Επιστρέψτε το φύλλο σε πρόχειρο και ανανεώστε το.',
      );
    }
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

  private async recordAudit(
    tenant: TenantContext,
    entityId: string,
    event: string,
    details: object,
  ) {
    await this.audit.record({
      tenant,
      action: AuditAction.UPDATE,
      entityType: 'AnnualTaxReturn',
      entityId,
      newValue: { event, ...details } as Prisma.InputJsonValue,
    });
  }
}

const annualTaxInclude = {
  clientCompany: {
    select: { id: true, legalName: true, vatNumber: true, entityType: true },
  },
  approvedBy: { select: { id: true, fullName: true } },
  installments: { orderBy: { installmentNumber: 'asc' as const } },
};

function returnKindForEntity(entityType: ClientEntityType): AnnualTaxReturnKind {
  return entityType === ClientEntityType.FREELANCER ||
    entityType === ClientEntityType.SOLE_PROPRIETOR
    ? AnnualTaxReturnKind.INDIVIDUAL_E1
    : AnnualTaxReturnKind.LEGAL_ENTITY_N;
}

function readChecklist(value: Prisma.JsonValue): AnnualTaxChecklist {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_CHECKLIST };
  }
  const item = value as Record<string, unknown>;
  return {
    booksReconciled: item['booksReconciled'] === true,
    myDataReviewed: item['myDataReviewed'] === true,
    depreciationsReviewed: item['depreciationsReviewed'] === true,
    inventoryReviewed: item['inventoryReviewed'] === true,
    taxAdjustmentsReviewed: item['taxAdjustmentsReviewed'] === true,
    formsReviewed: item['formsReviewed'] === true,
  };
}

function blockerMessages(snapshot: {
  unpostedDocumentCount: number;
  unresolvedMyDataCount: number;
  openPeriodCount: number;
  missingPeriodCount: number;
  unpostedDepreciationCount: number;
}): string[] {
  const messages: string[] = [];
  if (snapshot.unpostedDocumentCount) {
    messages.push(`Υπάρχουν ${snapshot.unpostedDocumentCount} ακαταχώριστα παραστατικά.`);
  }
  if (snapshot.unresolvedMyDataCount) {
    messages.push(`Υπάρχουν ${snapshot.unresolvedMyDataCount} εκκρεμείς αποκλίσεις myDATA.`);
  }
  if (snapshot.missingPeriodCount) {
    messages.push(`Λείπουν ${snapshot.missingPeriodCount} λογιστικές περίοδοι.`);
  }
  if (snapshot.openPeriodCount) {
    messages.push(`Υπάρχουν ${snapshot.openPeriodCount} ανοικτές λογιστικές περίοδοι.`);
  }
  if (snapshot.unpostedDepreciationCount) {
    messages.push(
      `Υπάρχουν ${snapshot.unpostedDepreciationCount} πάγια χωρίς καταχωρισμένη ετήσια απόσβεση.`,
    );
  }
  return messages;
}

function validateAssessmentAmounts(dto: SubmitAnnualTaxReturnDto) {
  const components = roundMoney(
    dto.assessedIncomeTax + dto.taxPrepayment + dto.otherAssessedAmounts,
  );
  if (components !== roundMoney(dto.totalPayable - dto.refundAmount)) {
    throw new BadRequestException(
      'Το καθαρό αποτέλεσμα εκκαθάρισης πρέπει να συμφωνεί με φόρο, προκαταβολή, λοιπά ποσά, πληρωτέο και επιστροφή.',
    );
  }
  if (dto.totalPayable > 0 && dto.refundAmount > 0) {
    throw new BadRequestException(
      'Το ίδιο εκκαθαριστικό δεν μπορεί να είναι ταυτόχρονα χρεωστικό και πιστωτικό.',
    );
  }
}

function validateInstallments(dto: SubmitAnnualTaxReturnDto) {
  if (dto.totalPayable === 0 && dto.installments.length > 0) {
    throw new BadRequestException('Μηδενικό πληρωτέο ποσό δεν πρέπει να έχει δόσεις.');
  }
  if (dto.totalPayable > 0 && dto.installments.length === 0) {
    throw new BadRequestException('Καταχωρίστε τις δόσεις του επίσημου εκκαθαριστικού.');
  }
  const numbers = new Set(dto.installments.map((item) => item.installmentNumber));
  if (numbers.size !== dto.installments.length) {
    throw new BadRequestException('Οι αριθμοί δόσεων πρέπει να είναι μοναδικοί.');
  }
  const sum = roundMoney(dto.installments.reduce((total, item) => total + item.amount, 0));
  if (sum !== roundMoney(dto.totalPayable)) {
    throw new BadRequestException('Το άθροισμα των δόσεων δεν συμφωνεί με το πληρωτέο ποσό.');
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
