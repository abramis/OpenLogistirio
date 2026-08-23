import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AnnualCertificateKind,
  AuditAction,
  ClientEntityType,
  ComplianceSubmissionStatus,
  PayrollPeriodStatus,
  Prisma,
  WithholdingTaxCategory,
  WithholdingTaxStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { annualSpecification, buildAadeAnnualArchive } from './aade-annual-file';
import {
  GenerateAnnualCertificateDto,
  SubmitAnnualCertificateDto,
} from './dto/annual-certificate.dto';

const certificateInclude = {
  clientCompany: { select: { id: true, legalName: true, vatNumber: true } },
  lines: {
    orderBy: [
      { beneficiaryLastName: 'asc' as const },
      { beneficiaryVatNumber: 'asc' as const },
      { incomeCode: 'asc' as const },
    ],
  },
};

@Injectable()
export class AnnualCertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  metadata() {
    return {
      kinds: Object.values(AnnualCertificateKind),
      supportedFiscalYears: [2025],
      specifications: { 2025: annualSpecification(2025) },
      officialDecision: 'AADE A.1195/24-12-2025',
      officialSource: 'https://www.aade.gr/egkyklioi-kai-apofaseis/1195-24-12-2025',
    };
  }

  findAll(tenant: TenantContext, clientCompanyId?: string, fiscalYear?: number) {
    return this.prisma.annualCertificate.findMany({
      where: { accountingOfficeId: tenant.accountingOfficeId, clientCompanyId, fiscalYear },
      include: certificateInclude,
      orderBy: [{ fiscalYear: 'desc' }, { kind: 'asc' }, { revision: 'desc' }],
    });
  }

  async generate(tenant: TenantContext, dto: GenerateAnnualCertificateDto) {
    const specificationVersion = annualSpecification(dto.fiscalYear);
    const company = await this.prisma.clientCompany.findFirst({
      where: {
        id: dto.clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
    });
    if (!company) throw new NotFoundException('Ο πελάτης δεν βρέθηκε.');

    const latest = await this.prisma.annualCertificate.findFirst({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: company.id,
        fiscalYear: dto.fiscalYear,
        kind: dto.kind,
      },
      orderBy: { revision: 'desc' },
    });
    if (latest?.status === ComplianceSubmissionStatus.DRAFT && !dto.createAmending) {
      return this.get(tenant, latest.id);
    }
    if (latest && !dto.createAmending) {
      throw new BadRequestException('Υπάρχει ήδη βεβαίωση. Δημιουργήστε διορθωτική έκδοση.');
    }
    if (
      dto.createAmending &&
      latest?.status !== ComplianceSubmissionStatus.SUBMITTED &&
      latest?.status !== ComplianceSubmissionStatus.LOCKED
    ) {
      throw new BadRequestException(
        'Διορθωτική έκδοση δημιουργείται μόνο μετά από υποβολή της προηγούμενης.',
      );
    }

    const profile = await this.resolveProfile(company.id);
    const declarantIsLegalEntity =
      dto.declarantIsLegalEntity ??
      profile?.declarantIsLegalEntity ??
      (company.entityType !== ClientEntityType.FREELANCER &&
        company.entityType !== ClientEntityType.SOLE_PROPRIETOR);
    const header = {
      declarantName: required(
        dto.declarantName ?? profile?.declarantName ?? company.legalName,
        'επωνυμία/επώνυμο δηλούντος',
        declarantIsLegalEntity ? 30 : 18,
      ),
      declarantFirstName: declarantIsLegalEntity
        ? null
        : required(dto.declarantFirstName ?? profile?.declarantFirstName, 'όνομα δηλούντος', 9),
      declarantFatherName: declarantIsLegalEntity
        ? null
        : (dto.declarantFatherName ?? profile?.declarantFatherName)?.trim().slice(0, 3) || null,
      declarantIsLegalEntity,
      declarantVatNumber: company.vatNumber,
      businessActivity: required(
        dto.businessActivity ?? profile?.businessActivity ?? company.professionLabel,
        'αντικείμενο δραστηριότητας',
        16,
      ),
      city: required(dto.city ?? profile?.city, 'πόλη', 10),
      street: required(dto.street ?? profile?.street, 'οδός', 16),
      streetNumber: required(dto.streetNumber ?? profile?.streetNumber, 'αριθμός οδού', 5),
      postalCode: required(dto.postalCode ?? profile?.postalCode, 'ταχυδρομικός κώδικας', 5),
    };
    if (!/^\d{5}$/.test(header.postalCode)) {
      throw new BadRequestException('Ο ταχυδρομικός κώδικας πρέπει να έχει 5 ψηφία.');
    }

    const revision = latest ? latest.revision + 1 : 0;
    const source = await this.buildSource(company.id, dto.fiscalYear, dto.kind);
    const certificate = await this.prisma.$transaction(async (tx) => {
      if (latest && latest.status !== ComplianceSubmissionStatus.LOCKED) {
        await tx.annualCertificate.update({
          where: { id: latest.id },
          data: { status: ComplianceSubmissionStatus.LOCKED, lockedAt: new Date() },
        });
      }
      return tx.annualCertificate.create({
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: company.id,
          fiscalYear: dto.fiscalYear,
          kind: dto.kind,
          returnType: revision === 0 ? 'INITIAL' : 'AMENDING',
          revision,
          specificationVersion,
          ...header,
          ...source.totals,
          sourceSnapshot: source.snapshot as Prisma.InputJsonValue,
          reconciliation: source.reconciliation as Prisma.InputJsonValue,
          blockerCount: source.blockers.length,
          lines: { create: source.lines },
        },
        include: certificateInclude,
      });
    });
    await this.record(tenant, certificate.id, AuditAction.CREATE, {
      event: 'ANNUAL_CERTIFICATE_GENERATED',
      fiscalYear: dto.fiscalYear,
      kind: dto.kind,
      revision,
      blockerCount: source.blockers.length,
    });
    return certificate;
  }

  async refresh(tenant: TenantContext, id: string) {
    const current = await this.get(tenant, id);
    this.requireStatus(current.status, ComplianceSubmissionStatus.DRAFT);
    const source = await this.buildSource(
      current.clientCompanyId,
      current.fiscalYear,
      current.kind,
    );
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.annualCertificateLine.deleteMany({ where: { annualCertificateId: id } });
      return tx.annualCertificate.update({
        where: { id },
        data: {
          ...source.totals,
          sourceSnapshot: source.snapshot as Prisma.InputJsonValue,
          reconciliation: source.reconciliation as Prisma.InputJsonValue,
          blockerCount: source.blockers.length,
          lines: { create: source.lines },
        },
        include: certificateInclude,
      });
    });
    await this.record(tenant, id, AuditAction.UPDATE, {
      event: 'ANNUAL_CERTIFICATE_REFRESHED',
      blockerCount: source.blockers.length,
    });
    return updated;
  }

  async markReady(tenant: TenantContext, id: string) {
    const current = await this.get(tenant, id);
    this.requireStatus(current.status, ComplianceSubmissionStatus.DRAFT);
    if (current.blockerCount || current.lines.length === 0) {
      throw new BadRequestException(
        'Η βεβαίωση έχει εκκρεμότητες συμφωνίας ή δεν περιέχει εγγραφές. Ανανεώστε και ελέγξτε τη συμφωνία.',
      );
    }
    return this.updateStatus(
      tenant,
      id,
      ComplianceSubmissionStatus.READY,
      'ANNUAL_CERTIFICATE_READY',
    );
  }

  async file(tenant: TenantContext, id: string) {
    const current = await this.get(tenant, id);
    if (
      current.status !== ComplianceSubmissionStatus.READY &&
      current.status !== ComplianceSubmissionStatus.FILE_GENERATED
    ) {
      throw new BadRequestException('Το αρχείο δημιουργείται μόνο από ελεγμένη έτοιμη βεβαίωση.');
    }
    const archive = buildAadeAnnualArchive(current);
    await this.prisma.annualCertificate.update({
      where: { id },
      data: {
        status: ComplianceSubmissionStatus.FILE_GENERATED,
        fileName: archive.filename,
        fileChecksumSha256: archive.checksumSha256,
        fileGeneratedAt: new Date(),
      },
    });
    await this.record(tenant, id, AuditAction.UPDATE, {
      event: 'ANNUAL_CERTIFICATE_FILE_GENERATED',
      fileName: archive.filename,
      checksumSha256: archive.checksumSha256,
    });
    return archive;
  }

  async submit(tenant: TenantContext, id: string, dto: SubmitAnnualCertificateDto) {
    const current = await this.get(tenant, id);
    this.requireStatus(current.status, ComplianceSubmissionStatus.FILE_GENERATED);
    const updated = await this.prisma.annualCertificate.update({
      where: { id },
      data: {
        status: ComplianceSubmissionStatus.SUBMITTED,
        submittedAt: new Date(dto.submittedAt),
        submissionProtocol: dto.submissionProtocol.trim(),
      },
      include: certificateInclude,
    });
    await this.record(tenant, id, AuditAction.UPDATE, {
      event: 'ANNUAL_CERTIFICATE_SUBMITTED',
      protocol: updated.submissionProtocol,
    });
    return updated;
  }

  async lock(tenant: TenantContext, id: string) {
    const current = await this.get(tenant, id);
    this.requireStatus(current.status, ComplianceSubmissionStatus.SUBMITTED);
    const updated = await this.prisma.annualCertificate.update({
      where: { id },
      data: { status: ComplianceSubmissionStatus.LOCKED, lockedAt: new Date() },
      include: certificateInclude,
    });
    await this.record(tenant, id, AuditAction.UPDATE, { event: 'ANNUAL_CERTIFICATE_LOCKED' });
    return updated;
  }

  private async get(tenant: TenantContext, id: string) {
    const result = await this.prisma.annualCertificate.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
      include: certificateInclude,
    });
    if (!result) throw new NotFoundException('Η ετήσια βεβαίωση δεν βρέθηκε.');
    return result;
  }

  private async resolveProfile(clientCompanyId: string) {
    return (
      (await this.prisma.annualCertificate.findFirst({
        where: { clientCompanyId },
        orderBy: { createdAt: 'desc' },
      })) ??
      (await this.prisma.withholdingTaxReturn.findFirst({
        where: { clientCompanyId },
        orderBy: { createdAt: 'desc' },
      }))
    );
  }

  private async buildSource(
    clientCompanyId: string,
    fiscalYear: number,
    kind: AnnualCertificateKind,
  ) {
    return kind === AnnualCertificateKind.EMPLOYMENT
      ? this.buildPayrollSource(clientCompanyId, fiscalYear)
      : this.buildWithholdingSource(clientCompanyId, fiscalYear, kind);
  }

  private async buildPayrollSource(clientCompanyId: string, fiscalYear: number) {
    const periods = await this.prisma.payrollPeriod.findMany({
      where: { clientCompanyId, periodYear: fiscalYear },
      include: { entries: { include: { employee: true } } },
      orderBy: [{ periodMonth: 'asc' }, { declarationType: 'asc' }],
    });
    const blockers: string[] = [];
    const relevant = periods.filter((period) => period.entries.length > 0);
    for (const period of relevant) {
      if (
        period.status !== PayrollPeriodStatus.APPROVED &&
        period.status !== PayrollPeriodStatus.PAID
      ) {
        blockers.push(`Η μισθοδοσία ${period.periodMonth}/${fiscalYear} δεν έχει εγκριθεί.`);
      }
      if (!period.fmySubmittedAt || !period.fmyProtocol) {
        blockers.push(`Δεν έχει καταχωριστεί πρωτόκολλο ΦΜΥ ${period.periodMonth}/${fiscalYear}.`);
      }
    }
    const finalPeriods = relevant.filter(
      (period) =>
        period.status === PayrollPeriodStatus.APPROVED ||
        period.status === PayrollPeriodStatus.PAID,
    );
    type Group = {
      employee: (typeof finalPeriods)[number]['entries'][number]['employee'];
      entries: (typeof finalPeriods)[number]['entries'];
      periodIds: string[];
    };
    const groups = new Map<string, Group>();
    for (const period of finalPeriods) {
      for (const entry of period.entries) {
        const group = groups.get(entry.employeeId) ?? {
          employee: entry.employee,
          entries: [],
          periodIds: [],
        };
        group.entries.push(entry);
        group.periodIds.push(period.id);
        groups.set(entry.employeeId, group);
      }
    }
    const lines = [...groups.values()].map((group) => {
      const grossAmount = money(sum(group.entries, 'grossEarnings'));
      const deductionsAmount = money(
        group.entries.reduce(
          (total, entry) =>
            total + Number(entry.employeeContributions) + Number(entry.otherDeductions),
          0,
        ),
      );
      return {
        beneficiaryVatNumber: group.employee.afm,
        beneficiaryLastName: group.employee.lastName,
        beneficiaryFirstName: group.employee.firstName,
        beneficiaryFatherName: group.employee.fatherName,
        beneficiarySocialSecurity: group.employee.amka,
        dependentChildren: group.employee.dependentChildren,
        incomeCode: '01',
        grossAmount,
        deductionsAmount,
        netAmount: money(grossAmount - deductionsAmount),
        withheldTaxAmount: money(sum(group.entries, 'withholdingTax')),
        digitalFeeAmount: 0,
        sourceRefs: { payrollPeriodIds: [...new Set(group.periodIds)] },
      };
    });
    const totals = totalsFor(lines);
    const monthlyGross = money(
      finalPeriods.reduce((total, period) => total + Number(period.totalGross), 0),
    );
    const monthlyTax = money(
      finalPeriods.reduce((total, period) => total + Number(period.totalWithholdingTax), 0),
    );
    if (monthlyGross !== totals.grossAmount)
      blockers.push('Το ετήσιο μικτό σύνολο δεν συμφωνεί με τις μηνιαίες μισθοδοσίες.');
    if (monthlyTax !== totals.withheldTaxAmount)
      blockers.push('Ο ετήσιος φόρος δεν συμφωνεί με τις μηνιαίες δηλώσεις ΦΜΥ.');
    return {
      lines,
      totals,
      blockers,
      snapshot: {
        payrollPeriodIds: finalPeriods.map((period) => period.id),
        fmyProtocols: finalPeriods.map((period) => period.fmyProtocol).filter(Boolean),
      },
      reconciliation: {
        matched: blockers.length === 0,
        blockers,
        payrollGross: monthlyGross,
        payrollWithheldTax: monthlyTax,
        annualGross: totals.grossAmount,
        annualWithheldTax: totals.withheldTaxAmount,
      },
    };
  }

  private async buildWithholdingSource(
    clientCompanyId: string,
    fiscalYear: number,
    kind: AnnualCertificateKind,
  ) {
    const categories =
      kind === AnnualCertificateKind.BUSINESS_ACTIVITY
        ? [WithholdingTaxCategory.BUSINESS_ACTIVITY]
        : [
            WithholdingTaxCategory.DIVIDENDS,
            WithholdingTaxCategory.INTEREST,
            WithholdingTaxCategory.ROYALTIES,
          ];
    const returns = await this.prisma.withholdingTaxReturn.findMany({
      where: { clientCompanyId, periodYear: fiscalYear, category: { in: categories } },
      include: { lines: true },
      orderBy: [{ periodMonth: 'asc' }, { category: 'asc' }, { revision: 'desc' }],
    });
    const latestByPeriod = new Map<string, (typeof returns)[number]>();
    for (const item of returns) {
      const key = `${item.periodMonth}:${item.category}`;
      if (!latestByPeriod.has(key)) latestByPeriod.set(key, item);
    }
    const blockers: string[] = [];
    for (const item of latestByPeriod.values()) {
      if (item.status !== WithholdingTaxStatus.SUBMITTED) {
        blockers.push(
          `Η μηνιαία δήλωση ${item.category} ${item.periodMonth}/${fiscalYear} δεν έχει υποβληθεί.`,
        );
      }
      if (item.status === WithholdingTaxStatus.SUBMITTED && !item.submissionReference) {
        blockers.push(
          `Λείπει πρωτόκολλο δήλωσης ${item.category} ${item.periodMonth}/${fiscalYear}.`,
        );
      }
    }
    const submitted = [...latestByPeriod.values()].filter(
      (item) => item.status === WithholdingTaxStatus.SUBMITTED,
    );
    type Row = (typeof submitted)[number]['lines'][number] & { sourceReturnId: string };
    const rows: Row[] = submitted.flatMap((item) =>
      item.lines.map((line) => ({ ...line, sourceReturnId: item.id })),
    );
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const key = `${row.beneficiaryVatNumber ?? ''}:${row.countryCode ?? ''}:${row.incomeCode}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const lines = [...groups.values()].map((items) => ({
      beneficiaryVatNumber: items[0].beneficiaryVatNumber,
      beneficiaryLastName: items[0].beneficiaryLastName,
      beneficiaryFirstName: items[0].beneficiaryFirstName,
      beneficiaryFatherName: items[0].beneficiaryFatherName,
      beneficiarySocialSecurity: items[0].beneficiarySocialSecurity,
      foreignWithoutGreekVat: items[0].foreignWithoutGreekVat,
      countryCode: items[0].countryCode,
      incomeCode: items[0].incomeCode,
      grossAmount: money(sum(items, 'grossAmount')),
      deductionsAmount: money(sum(items, 'deductionsAmount')),
      netAmount: money(sum(items, 'netAmount')),
      withheldTaxAmount: money(sum(items, 'withheldTaxAmount')),
      digitalFeeAmount: money(sum(items, 'digitalFeeAmount')),
      sourceRefs: {
        withholdingTaxReturnIds: [...new Set(items.map((item) => item.sourceReturnId))],
      },
    }));
    const totals = totalsFor(lines);
    const monthlyGross = money(
      submitted.reduce((total, item) => total + Number(item.grossAmount), 0),
    );
    const monthlyTax = money(
      submitted.reduce((total, item) => total + Number(item.withheldTaxAmount), 0),
    );
    if (monthlyGross !== totals.grossAmount)
      blockers.push('Το ετήσιο μικτό σύνολο δεν συμφωνεί με τις μηνιαίες δηλώσεις.');
    if (monthlyTax !== totals.withheldTaxAmount)
      blockers.push('Ο ετήσιος φόρος δεν συμφωνεί με τις μηνιαίες δηλώσεις.');
    return {
      lines,
      totals,
      blockers,
      snapshot: {
        withholdingTaxReturnIds: submitted.map((item) => item.id),
        submissionProtocols: submitted.map((item) => item.submissionReference).filter(Boolean),
      },
      reconciliation: {
        matched: blockers.length === 0,
        blockers,
        monthlyGross,
        monthlyWithheldTax: monthlyTax,
        annualGross: totals.grossAmount,
        annualWithheldTax: totals.withheldTaxAmount,
      },
    };
  }

  private async updateStatus(
    tenant: TenantContext,
    id: string,
    status: ComplianceSubmissionStatus,
    event: string,
  ) {
    const updated = await this.prisma.annualCertificate.update({
      where: { id },
      data: { status },
      include: certificateInclude,
    });
    await this.record(tenant, id, AuditAction.UPDATE, { event });
    return updated;
  }

  private requireStatus(actual: ComplianceSubmissionStatus, expected: ComplianceSubmissionStatus) {
    if (actual !== expected) {
      throw new BadRequestException(`Η ενέργεια απαιτεί κατάσταση ${expected}.`);
    }
  }

  private record(tenant: TenantContext, entityId: string, action: AuditAction, details: object) {
    return this.audit.record({
      tenant,
      action,
      entityType: 'AnnualCertificate',
      entityId,
      newValue: details as Prisma.InputJsonValue,
    });
  }
}

function required(value: string | null | undefined, label: string, maxLength: number): string {
  const normalized = value?.trim();
  if (!normalized) throw new BadRequestException(`Λείπει ${label}.`);
  return normalized.slice(0, maxLength);
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sum<T>(items: T[], key: keyof T): number {
  return items.reduce((total, item) => total + Number(item[key]), 0);
}

function totalsFor(
  lines: Array<{
    grossAmount: number;
    deductionsAmount: number;
    netAmount: number;
    withheldTaxAmount: number;
    digitalFeeAmount: number;
  }>,
) {
  return {
    grossAmount: money(sum(lines, 'grossAmount')),
    deductionsAmount: money(sum(lines, 'deductionsAmount')),
    netAmount: money(sum(lines, 'netAmount')),
    withheldTaxAmount: money(sum(lines, 'withheldTaxAmount')),
    digitalFeeAmount: money(sum(lines, 'digitalFeeAmount')),
  };
}
