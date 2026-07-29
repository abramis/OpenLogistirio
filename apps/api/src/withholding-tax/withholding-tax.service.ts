import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ClientEntityType,
  ObligationRecurrence,
  ObligationStatus,
  ObligationType,
  Prisma,
  WithholdingTaxCategory,
  WithholdingTaxReturn,
  WithholdingTaxStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { buildAadeMonthlyArchive } from './aade-monthly-file';
import {
  assertPaymentInPeriod,
  calculateWithholdingLine,
  money,
  withholdingCategoryCodes,
  withholdingDeadline,
} from './withholding-tax-calculator';
import {
  GenerateWithholdingTaxReturnDto,
  PayWithholdingTaxReturnDto,
  SubmitWithholdingTaxReturnDto,
  UpdateWithholdingTaxReturnDto,
  UpsertWithholdingTaxLineDto,
} from './dto/withholding-tax.dto';

const returnInclude = {
  clientCompany: {
    select: {
      id: true,
      legalName: true,
      vatNumber: true,
      professionLabel: true,
    },
  },
  approvedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  lines: {
    orderBy: [{ paymentDate: 'asc' as const }, { createdAt: 'asc' as const }],
  },
};

@Injectable()
export class WithholdingTaxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(
    tenant: TenantContext,
    clientCompanyId?: string,
    periodYear?: number,
    periodMonth?: number,
  ) {
    return this.prisma.withholdingTaxReturn.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
        periodYear,
        periodMonth,
      },
      include: returnInclude,
      orderBy: [
        { periodYear: 'desc' },
        { periodMonth: 'desc' },
        { category: 'asc' },
        { revision: 'desc' },
      ],
    });
  }

  metadata() {
    return {
      categories: Object.values(WithholdingTaxCategory).map((category) => ({
        category,
        codes: [...withholdingCategoryCodes[category]],
      })),
      standardRates: {
        BUSINESS_ACTIVITY: 20,
        DIVIDENDS: 5,
        INTEREST: 15,
        ROYALTIES: 20,
      },
      digitalFeeRates: [0, 1.2, 2.4, 3.6],
      deadlineRule: 'END_OF_SECOND_MONTH_AFTER_PAYMENT',
      fileSpecification: 'AADE_JL10_2026_ISO_8859_7_ZIP',
    };
  }

  async generate(tenant: TenantContext, dto: GenerateWithholdingTaxReturnDto) {
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

    const latest = await this.prisma.withholdingTaxReturn.findFirst({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: company.id,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        category: dto.category,
      },
      orderBy: { revision: 'desc' },
    });
    if (latest?.status === WithholdingTaxStatus.DRAFT) {
      return this.getReturn(tenant, latest.id);
    }
    if (latest && !dto.createAmending) {
      throw new BadRequestException(
        latest.status === WithholdingTaxStatus.SUBMITTED
          ? 'Η δήλωση έχει υποβληθεί. Δημιουργήστε τροποποιητική.'
          : 'Υπάρχει ήδη ενεργή δήλωση για αυτή την κατηγορία και περίοδο.',
      );
    }
    if (dto.createAmending && latest?.status !== WithholdingTaxStatus.SUBMITTED) {
      throw new BadRequestException('Τροποποιητική δημιουργείται μόνο μετά την επίσημη υποβολή.');
    }

    const profile = await this.prisma.withholdingTaxReturn.findFirst({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: company.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    const declarantIsLegalEntity =
      dto.declarantIsLegalEntity ??
      profile?.declarantIsLegalEntity ??
      (company.entityType !== ClientEntityType.FREELANCER &&
        company.entityType !== ClientEntityType.SOLE_PROPRIETOR);
    const declarantName = requiredProfile(
      dto.declarantName ?? profile?.declarantName ?? company.legalName,
      declarantIsLegalEntity ? 'επωνυμία δηλούντος' : 'επώνυμο δηλούντος',
      declarantIsLegalEntity ? 30 : 18,
    );
    const declarantFirstName = declarantIsLegalEntity
      ? null
      : requiredProfile(
          dto.declarantFirstName ?? profile?.declarantFirstName,
          'όνομα δηλούντος φυσικού προσώπου',
          9,
        );
    const declarantFatherName = declarantIsLegalEntity
      ? null
      : (dto.declarantFatherName ?? profile?.declarantFatherName)?.trim().slice(0, 3) || null;
    const businessActivity = requiredProfile(
      dto.businessActivity ?? profile?.businessActivity ?? company.professionLabel,
      'αντικείμενο δραστηριότητας',
      16,
    );
    const city = requiredProfile(dto.city ?? profile?.city, 'πόλη', 10);
    const street = requiredProfile(dto.street ?? profile?.street, 'οδός', 16);
    const streetNumber = requiredProfile(
      dto.streetNumber ?? profile?.streetNumber,
      'αριθμός οδού',
      5,
    );
    const postalCode = requiredProfile(
      dto.postalCode ?? profile?.postalCode,
      'ταχυδρομικός κώδικας',
      5,
    );
    if (!/^\d{5}$/.test(postalCode)) {
      throw new BadRequestException('Ο ταχυδρομικός κώδικας πρέπει να έχει 5 ψηφία.');
    }

    const revision = latest ? latest.revision + 1 : 0;
    const created = await this.prisma.withholdingTaxReturn.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: company.id,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        category: dto.category,
        returnType: revision === 0 ? 'INITIAL' : 'AMENDING',
        revision,
        submissionDeadline: withholdingDeadline(dto.periodYear, dto.periodMonth),
        declarantName,
        declarantFirstName,
        declarantFatherName,
        declarantIsLegalEntity,
        declarantVatNumber: company.vatNumber,
        businessActivity,
        city,
        street,
        streetNumber,
        postalCode,
      },
      include: returnInclude,
    });
    await this.syncObligation(tenant, created, ObligationStatus.IN_PROGRESS);
    await this.record(tenant, created.id, AuditAction.CREATE, {
      category: dto.category,
      periodYear: dto.periodYear,
      periodMonth: dto.periodMonth,
      revision,
    });
    return created;
  }

  async update(
    tenant: TenantContext,
    id: string,
    dto: UpdateWithholdingTaxReturnDto,
  ) {
    const existing = await this.getReturn(tenant, id);
    this.requireDraft(existing);
    const updated = await this.prisma.withholdingTaxReturn.update({
      where: { id },
      data: {
        declarantName: dto.declarantName,
        declarantFirstName: dto.declarantFirstName,
        declarantFatherName: dto.declarantFatherName,
        declarantIsLegalEntity: dto.declarantIsLegalEntity,
        businessActivity: dto.businessActivity,
        city: dto.city,
        street: dto.street,
        streetNumber: dto.streetNumber,
        postalCode: dto.postalCode,
        submissionDeadline: dto.submissionDeadline
          ? new Date(dto.submissionDeadline)
          : undefined,
        notes: dto.notes,
      },
      include: returnInclude,
    });
    await this.record(tenant, id, AuditAction.UPDATE, { action: 'HEADER_UPDATED' });
    return updated;
  }

  async addLine(tenant: TenantContext, id: string, dto: UpsertWithholdingTaxLineDto) {
    const declaration = await this.getReturn(tenant, id);
    this.requireDraft(declaration);
    const data = this.lineData(declaration, dto);
    await this.prisma.withholdingTaxReturnLine.create({
      data: {
        withholdingTaxReturnId: id,
        ...data,
      },
    });
    const updated = await this.recomputeTotals(tenant, id);
    await this.record(tenant, id, AuditAction.UPDATE, {
      action: 'LINE_ADDED',
      beneficiaryVatNumber: dto.beneficiaryVatNumber,
    });
    return updated;
  }

  async updateLine(
    tenant: TenantContext,
    id: string,
    lineId: string,
    dto: UpsertWithholdingTaxLineDto,
  ) {
    const declaration = await this.getReturn(tenant, id);
    this.requireDraft(declaration);
    const line = declaration.lines.find((item) => item.id === lineId);
    if (!line) {
      throw new NotFoundException('Η αναλυτική εγγραφή δεν βρέθηκε.');
    }
    await this.prisma.withholdingTaxReturnLine.update({
      where: { id: lineId },
      data: this.lineData(declaration, dto),
    });
    const updated = await this.recomputeTotals(tenant, id);
    await this.record(tenant, id, AuditAction.UPDATE, { action: 'LINE_UPDATED', lineId });
    return updated;
  }

  async deleteLine(tenant: TenantContext, id: string, lineId: string) {
    const declaration = await this.getReturn(tenant, id);
    this.requireDraft(declaration);
    if (!declaration.lines.some((item) => item.id === lineId)) {
      throw new NotFoundException('Η αναλυτική εγγραφή δεν βρέθηκε.');
    }
    await this.prisma.withholdingTaxReturnLine.delete({ where: { id: lineId } });
    const updated = await this.recomputeTotals(tenant, id);
    await this.record(tenant, id, AuditAction.DELETE, { action: 'LINE_DELETED', lineId });
    return updated;
  }

  async markReady(tenant: TenantContext, id: string) {
    const declaration = await this.getReturn(tenant, id);
    this.requireDraft(declaration);
    buildAadeMonthlyArchive(declaration);
    const updated = await this.prisma.withholdingTaxReturn.update({
      where: { id },
      data: { status: WithholdingTaxStatus.READY },
      include: returnInclude,
    });
    await this.syncObligation(tenant, updated, ObligationStatus.READY_TO_SUBMIT);
    await this.record(tenant, id, AuditAction.UPDATE, { action: 'READY' });
    return updated;
  }

  async approve(tenant: TenantContext, id: string) {
    const declaration = await this.getReturn(tenant, id);
    if (declaration.status !== WithholdingTaxStatus.READY) {
      throw new BadRequestException('Μόνο δήλωση έτοιμη για έλεγχο μπορεί να εγκριθεί.');
    }
    const approvedSnapshot = snapshot(declaration);
    const updated = await this.prisma.withholdingTaxReturn.update({
      where: { id },
      data: {
        status: WithholdingTaxStatus.APPROVED,
        approvedById: tenant.userId,
        approvedAt: new Date(),
        approvedSnapshot: approvedSnapshot as unknown as Prisma.InputJsonValue,
      },
      include: returnInclude,
    });
    await this.record(tenant, id, AuditAction.UPDATE, { action: 'APPROVED' });
    return updated;
  }

  async reopen(tenant: TenantContext, id: string) {
    const declaration = await this.getReturn(tenant, id);
    if (
      declaration.status !== WithholdingTaxStatus.READY &&
      declaration.status !== WithholdingTaxStatus.APPROVED
    ) {
      throw new BadRequestException('Μόνο έτοιμη ή εγκεκριμένη δήλωση μπορεί να ξανανοίξει.');
    }
    const updated = await this.prisma.withholdingTaxReturn.update({
      where: { id },
      data: {
        status: WithholdingTaxStatus.DRAFT,
        approvedById: null,
        approvedAt: null,
        approvedSnapshot: Prisma.JsonNull,
        fileGeneratedAt: null,
      },
      include: returnInclude,
    });
    await this.syncObligation(tenant, updated, ObligationStatus.IN_PROGRESS);
    await this.record(tenant, id, AuditAction.UPDATE, { action: 'REOPENED' });
    return updated;
  }

  async aadeArchive(tenant: TenantContext, id: string) {
    const declaration = await this.getReturn(tenant, id);
    if (
      declaration.status !== WithholdingTaxStatus.APPROVED &&
      declaration.status !== WithholdingTaxStatus.SUBMITTED
    ) {
      throw new BadRequestException('Το αρχείο ΑΑΔΕ παράγεται μόνο μετά την έγκριση.');
    }
    this.assertApprovedSnapshot(declaration);
    const generatedAt = new Date();
    const archive = buildAadeMonthlyArchive(declaration, generatedAt);
    await this.prisma.withholdingTaxReturn.update({
      where: { id },
      data: { fileGeneratedAt: generatedAt },
    });
    await this.record(tenant, id, AuditAction.UPDATE, {
      action: 'AADE_FILE_GENERATED',
      specification: 'JL10_2026',
    });
    return archive;
  }

  async submit(
    tenant: TenantContext,
    id: string,
    dto: SubmitWithholdingTaxReturnDto,
  ) {
    const declaration = await this.getReturn(tenant, id);
    if (declaration.status !== WithholdingTaxStatus.APPROVED) {
      throw new BadRequestException('Η επίσημη υποβολή καταχωρίζεται μόνο σε εγκεκριμένη δήλωση.');
    }
    this.assertApprovedSnapshot(declaration);
    if (!declaration.fileGeneratedAt) {
      throw new BadRequestException(
        'Πρέπει πρώτα να παραχθεί και να ανέβει το αναλυτικό zip στην ΑΑΔΕ.',
      );
    }
    const submittedAt = new Date(dto.submittedAt);
    const updated = await this.prisma.withholdingTaxReturn.update({
      where: { id },
      data: {
        status: WithholdingTaxStatus.SUBMITTED,
        fileProtocol: dto.fileProtocol,
        submissionReference: dto.submissionReference,
        submittedAt,
        debtId: dto.debtId,
        payableAmount: money(dto.payableAmount),
        lateSubmission: submittedAt.getTime() > declaration.submissionDeadline.getTime(),
      },
      include: returnInclude,
    });
    await this.syncObligation(tenant, updated, ObligationStatus.SUBMITTED);
    await this.record(tenant, id, AuditAction.UPDATE, {
      action: 'SUBMITTED',
      fileProtocol: dto.fileProtocol,
      submissionReference: dto.submissionReference,
      payableAmount: dto.payableAmount,
    });
    return updated;
  }

  async pay(tenant: TenantContext, id: string, dto: PayWithholdingTaxReturnDto) {
    const declaration = await this.getReturn(tenant, id);
    if (declaration.status !== WithholdingTaxStatus.SUBMITTED) {
      throw new BadRequestException('Πληρωμή καταχωρίζεται μόνο μετά την επίσημη υποβολή.');
    }
    if (Number(declaration.payableAmount) <= 0) {
      throw new BadRequestException('Η δήλωση δεν έχει πληρωτέο ποσό.');
    }
    const paidAt = new Date(dto.paidAt);
    const updated = await this.prisma.withholdingTaxReturn.update({
      where: { id },
      data: {
        paidAt,
        paymentReference: dto.paymentReference,
        latePayment: paidAt.getTime() > declaration.submissionDeadline.getTime(),
      },
      include: returnInclude,
    });
    await this.record(tenant, id, AuditAction.UPDATE, {
      action: 'PAID',
      paymentReference: dto.paymentReference,
    });
    return updated;
  }

  private lineData(declaration: WithholdingTaxReturn, dto: UpsertWithholdingTaxLineDto) {
    const paymentDate = new Date(dto.paymentDate);
    assertPaymentInPeriod(paymentDate, declaration.periodYear, declaration.periodMonth);
    const foreignWithoutGreekVat = dto.foreignWithoutGreekVat ?? false;
    if (!foreignWithoutGreekVat && !/^\d{9}$/.test(dto.beneficiaryVatNumber ?? '')) {
      throw new BadRequestException('Ο ημεδαπός δικαιούχος χρειάζεται ΑΦΜ 9 ψηφίων.');
    }
    if (foreignWithoutGreekVat && !/^[A-Z]{2}$/.test(dto.countryCode ?? '')) {
      throw new BadRequestException(
        'Ο αλλοδαπός χωρίς ελληνικό ΑΦΜ χρειάζεται κωδικό χώρας δύο γραμμάτων.',
      );
    }
    const amounts = calculateWithholdingLine({
      category: declaration.category,
      incomeCode: dto.incomeCode,
      grossAmount: dto.grossAmount,
      deductionsAmount: dto.deductionsAmount,
      withholdingRate: dto.withholdingRate,
      withheldTaxAmount: dto.withheldTaxAmount,
      digitalFeeRate: dto.digitalFeeRate,
      digitalFeeOgaAmount: dto.digitalFeeOgaAmount,
    });
    return {
      beneficiaryVatNumber: foreignWithoutGreekVat
        ? dto.beneficiaryVatNumber ?? null
        : dto.beneficiaryVatNumber,
      beneficiaryLastName: dto.beneficiaryLastName,
      beneficiaryFirstName: dto.beneficiaryFirstName,
      beneficiaryFatherName: dto.beneficiaryFatherName,
      beneficiarySocialSecurity: dto.beneficiarySocialSecurity,
      foreignWithoutGreekVat,
      countryCode: foreignWithoutGreekVat ? dto.countryCode : null,
      paymentDate,
      exemptionLawArticle: dto.exemptionLawArticle,
      exemptionLawNumber: dto.exemptionLawNumber,
      exemptionLawYear: dto.exemptionLawYear,
      notes: dto.notes,
      ...amounts,
    };
  }

  private async recomputeTotals(tenant: TenantContext, id: string) {
    const declaration = await this.getReturn(tenant, id);
    const sum = (field: keyof (typeof declaration.lines)[number]) =>
      money(declaration.lines.reduce((total, line) => total + Number(line[field] ?? 0), 0));
    const withheldTaxAmount = sum('withheldTaxAmount');
    const digitalFeeAmount = sum('digitalFeeAmount');
    const digitalFeeOgaAmount = sum('digitalFeeOgaAmount');
    return this.prisma.withholdingTaxReturn.update({
      where: { id },
      data: {
        grossAmount: sum('grossAmount'),
        deductionsAmount: sum('deductionsAmount'),
        netAmount: sum('netAmount'),
        assessedTaxAmount: sum('assessedTaxAmount'),
        withheldTaxAmount,
        digitalFeeAmount,
        digitalFeeOgaAmount,
        payableAmount: money(withheldTaxAmount + digitalFeeAmount + digitalFeeOgaAmount),
      },
      include: returnInclude,
    });
  }

  private async getReturn(tenant: TenantContext, id: string) {
    const declaration = await this.prisma.withholdingTaxReturn.findFirst({
      where: {
        id,
        accountingOfficeId: tenant.accountingOfficeId,
      },
      include: returnInclude,
    });
    if (!declaration) {
      throw new NotFoundException('Η δήλωση παρακρατούμενων φόρων δεν βρέθηκε.');
    }
    return declaration;
  }

  private requireDraft(value: { status: WithholdingTaxStatus }) {
    if (value.status !== WithholdingTaxStatus.DRAFT) {
      throw new BadRequestException('Μόνο πρόχειρη δήλωση μπορεί να αλλάξει.');
    }
  }

  private assertApprovedSnapshot(declaration: Awaited<ReturnType<WithholdingTaxService['getReturn']>>) {
    if (
      !declaration.approvedSnapshot ||
      JSON.stringify(declaration.approvedSnapshot) !== JSON.stringify(snapshot(declaration))
    ) {
      throw new BadRequestException(
        'Τα στοιχεία άλλαξαν μετά την έγκριση. Ξανανοίξτε και εγκρίνετε ξανά τη δήλωση.',
      );
    }
  }

  private async syncObligation(
    tenant: TenantContext,
    declaration: WithholdingTaxReturn,
    requestedStatus: ObligationStatus,
  ) {
    let status = requestedStatus;
    if (requestedStatus === ObligationStatus.SUBMITTED) {
      const pending = await this.prisma.withholdingTaxReturn.count({
        where: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: declaration.clientCompanyId,
          periodYear: declaration.periodYear,
          periodMonth: declaration.periodMonth,
          status: { not: WithholdingTaxStatus.SUBMITTED },
        },
      });
      status = pending === 0 ? ObligationStatus.SUBMITTED : ObligationStatus.READY_TO_SUBMIT;
    }
    await this.prisma.officeObligation.upsert({
      where: {
        clientCompanyId_type_periodYear_periodMonth: {
          clientCompanyId: declaration.clientCompanyId,
          type: ObligationType.WITHHOLDING_TAX,
          periodYear: declaration.periodYear,
          periodMonth: declaration.periodMonth,
        },
      },
      create: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: declaration.clientCompanyId,
        type: ObligationType.WITHHOLDING_TAX,
        title: `Παρακρατούμενοι φόροι ${String(declaration.periodMonth).padStart(2, '0')}/${declaration.periodYear}`,
        periodYear: declaration.periodYear,
        periodMonth: declaration.periodMonth,
        dueDate: declaration.submissionDeadline,
        recurrence: ObligationRecurrence.MONTHLY,
        status,
        completedAt: status === ObligationStatus.SUBMITTED ? new Date() : null,
      },
      update: {
        dueDate: declaration.submissionDeadline,
        status,
        completedAt: status === ObligationStatus.SUBMITTED ? new Date() : null,
      },
    });
  }

  private record(
    tenant: TenantContext,
    entityId: string,
    action: AuditAction,
    value: Record<string, unknown>,
  ) {
    return this.audit.record({
      tenant,
      action,
      entityType: 'WithholdingTaxReturn',
      entityId,
      newValue: value as Prisma.InputJsonValue,
    });
  }
}

function requiredProfile(
  value: string | null | undefined,
  label: string,
  maxLength: number,
): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new BadRequestException(
      `Συμπληρώστε ${label} για το επίσημο αρχείο ΑΑΔΕ της πρώτης δήλωσης.`,
    );
  }
  return normalized.slice(0, maxLength);
}

function snapshot(
  declaration: Awaited<ReturnType<WithholdingTaxService['getReturn']>>,
): Record<string, unknown> {
  return {
    periodYear: declaration.periodYear,
    periodMonth: declaration.periodMonth,
    category: declaration.category,
    declarantName: declaration.declarantName,
    declarantFirstName: declaration.declarantFirstName,
    declarantFatherName: declaration.declarantFatherName,
    declarantIsLegalEntity: declaration.declarantIsLegalEntity,
    declarantVatNumber: declaration.declarantVatNumber,
    businessActivity: declaration.businessActivity,
    city: declaration.city,
    street: declaration.street,
    streetNumber: declaration.streetNumber,
    postalCode: declaration.postalCode,
    totals: {
      grossAmount: Number(declaration.grossAmount),
      deductionsAmount: Number(declaration.deductionsAmount),
      netAmount: Number(declaration.netAmount),
      assessedTaxAmount: Number(declaration.assessedTaxAmount),
      withheldTaxAmount: Number(declaration.withheldTaxAmount),
      digitalFeeAmount: Number(declaration.digitalFeeAmount),
      digitalFeeOgaAmount: Number(declaration.digitalFeeOgaAmount),
    },
    lines: declaration.lines.map((line) => ({
      id: line.id,
      beneficiaryVatNumber: line.beneficiaryVatNumber,
      beneficiaryLastName: line.beneficiaryLastName,
      beneficiaryFirstName: line.beneficiaryFirstName,
      beneficiaryFatherName: line.beneficiaryFatherName,
      beneficiarySocialSecurity: line.beneficiarySocialSecurity,
      foreignWithoutGreekVat: line.foreignWithoutGreekVat,
      countryCode: line.countryCode,
      incomeCode: line.incomeCode,
      paymentDate: line.paymentDate.toISOString(),
      grossAmount: Number(line.grossAmount),
      deductionsAmount: Number(line.deductionsAmount),
      netAmount: Number(line.netAmount),
      withholdingRate: Number(line.withholdingRate),
      assessedTaxAmount: Number(line.assessedTaxAmount),
      withheldTaxAmount: Number(line.withheldTaxAmount),
      digitalFeeRate: Number(line.digitalFeeRate),
      digitalFeeAmount: Number(line.digitalFeeAmount),
      digitalFeeOgaAmount: Number(line.digitalFeeOgaAmount),
      exemptionLawArticle: line.exemptionLawArticle,
      exemptionLawNumber: line.exemptionLawNumber,
      exemptionLawYear: line.exemptionLawYear,
    })),
  };
}
