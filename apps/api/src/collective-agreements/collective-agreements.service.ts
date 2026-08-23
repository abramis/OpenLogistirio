import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import {
  ApplyCollectiveAgreementDto,
  CreateCollectiveAgreementDto,
  CreateCollectiveAgreementVersionDto,
  EvaluateCollectiveAgreementDto,
} from './dto/collective-agreement.dto';

const include = {
  clientCompany: { select: { id: true, legalName: true } },
  versions: {
    include: { wageRules: { orderBy: { specialtyCode: 'asc' as const } } },
    orderBy: { validFrom: 'desc' as const },
  },
};

@Injectable()
export class CollectiveAgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(tenant: TenantContext, clientCompanyId?: string) {
    return this.prisma.collectiveAgreement.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        OR: clientCompanyId ? [{ clientCompanyId }, { clientCompanyId: null }] : undefined,
      },
      include,
      orderBy: [{ mandatory: 'desc' }, { priority: 'desc' }, { code: 'asc' }],
    });
  }

  async create(tenant: TenantContext, dto: CreateCollectiveAgreementDto) {
    if (dto.clientCompanyId) await this.ensureCompany(tenant, dto.clientCompanyId);
    const result = await this.prisma.collectiveAgreement.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId || null,
        code: dto.code.trim().toUpperCase(),
        title: dto.title.trim(),
        sourceUrl: dto.sourceUrl?.trim() || null,
        activityCodes: dto.activityCodes.map(normalizeCode),
        specialtyCodes: dto.specialtyCodes.map(normalizeCode),
        mandatory: dto.mandatory,
        priority: dto.priority,
      },
      include,
    });
    await this.event(tenant, result.id, AuditAction.CREATE, 'COLLECTIVE_AGREEMENT_CREATED', {});
    return result;
  }

  async addVersion(
    tenant: TenantContext,
    agreementId: string,
    dto: CreateCollectiveAgreementVersionDto,
  ) {
    await this.getAgreement(tenant, agreementId);
    const validFrom = new Date(dto.validFrom);
    const validTo = dto.validTo ? new Date(dto.validTo) : null;
    if (validTo && validTo < validFrom)
      throw new BadRequestException('Η λήξη ΣΣΕ προηγείται της έναρξης.');
    if (!dto.wageRules.length)
      throw new BadRequestException('Η έκδοση ΣΣΕ χρειάζεται τουλάχιστον έναν μισθολογικό κανόνα.');
    const result = await this.prisma.collectiveAgreementVersion.create({
      data: {
        collectiveAgreementId: agreementId,
        versionLabel: dto.versionLabel.trim(),
        validFrom,
        validTo,
        weeklyHours: dto.weeklyHours,
        notes: dto.notes?.trim() || null,
        wageRules: {
          create: dto.wageRules.map((rule) => {
            if (rule.minimumMonthlySalary === undefined && rule.minimumDailyWage === undefined) {
              throw new BadRequestException(
                'Κάθε κανόνας ΣΣΕ χρειάζεται μηνιαίο μισθό ή ημερομίσθιο.',
              );
            }
            return {
              specialtyCode: normalizeCode(rule.specialtyCode),
              specialtyTitle: rule.specialtyTitle.trim(),
              minimumMonthlySalary: rule.minimumMonthlySalary,
              minimumDailyWage: rule.minimumDailyWage,
              allowanceRules: rule.allowanceRules as Prisma.InputJsonValue,
            };
          }),
        },
      },
      include: { wageRules: true, collectiveAgreement: true },
    });
    await this.event(
      tenant,
      agreementId,
      AuditAction.UPDATE,
      'COLLECTIVE_AGREEMENT_VERSION_CREATED',
      {
        versionId: result.id,
        versionLabel: result.versionLabel,
        validFrom,
      },
    );
    return result;
  }

  async evaluate(tenant: TenantContext, dto: EvaluateCollectiveAgreementDto) {
    const company = await this.ensureCompany(tenant, dto.clientCompanyId);
    if (!company.collectiveAgreementEnabled) {
      return {
        applicable: false,
        reason: 'COLLECTIVE_AGREEMENT_NOT_ENABLED_FOR_CLIENT',
        statutoryMonthlySalary: dto.statutoryMonthlySalary ?? null,
        statutoryDailyWage: dto.statutoryDailyWage ?? null,
      };
    }
    const onDate = new Date(dto.onDate);
    const activityCodes = readCodes(company.activityCodes);
    const agreements = await this.prisma.collectiveAgreement.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        OR: [{ clientCompanyId: company.id }, { clientCompanyId: null }],
      },
      include: {
        versions: {
          where: {
            validFrom: { lte: onDate },
            OR: [{ validTo: null }, { validTo: { gte: onDate } }],
          },
          include: { wageRules: true },
        },
      },
    });
    const specialty = normalizeCode(dto.specialtyCode);
    const candidates = agreements.flatMap((agreement) => {
      const agreementActivities = readCodes(agreement.activityCodes);
      const agreementSpecialties = readCodes(agreement.specialtyCodes);
      const activityMatch =
        agreement.clientCompanyId === company.id ||
        agreementActivities.includes('*') ||
        agreementActivities.some((rule) => activityCodes.some((code) => code.startsWith(rule)));
      const specialtyMatch =
        agreementSpecialties.includes('*') || agreementSpecialties.includes(specialty);
      if (!activityMatch || !specialtyMatch) return [];
      return agreement.versions.flatMap((version) =>
        version.wageRules
          .filter(
            (rule) => rule.specialtyCode === '*' || normalizeCode(rule.specialtyCode) === specialty,
          )
          .map((rule) => ({ agreement, version, rule })),
      );
    });
    candidates.sort(
      (left, right) =>
        Number(right.agreement.mandatory) - Number(left.agreement.mandatory) ||
        right.agreement.priority - left.agreement.priority ||
        Number(right.rule.minimumMonthlySalary ?? right.rule.minimumDailyWage ?? 0) -
          Number(left.rule.minimumMonthlySalary ?? left.rule.minimumDailyWage ?? 0),
    );
    const selected = candidates[0];
    if (!selected) {
      return {
        applicable: false,
        reason: 'NO_MATCHING_EFFECTIVE_COLLECTIVE_AGREEMENT',
        statutoryMonthlySalary: dto.statutoryMonthlySalary ?? null,
        statutoryDailyWage: dto.statutoryDailyWage ?? null,
      };
    }
    const allowanceResult = calculateAllowances(
      selected.rule.allowanceRules,
      dto.priorServiceYears,
      dto.allowanceInputs,
      Number(selected.rule.minimumMonthlySalary ?? selected.rule.minimumDailyWage ?? 0),
    );
    const collectiveMonthly = selected.rule.minimumMonthlySalary
      ? money(Number(selected.rule.minimumMonthlySalary) + allowanceResult.total)
      : null;
    const collectiveDaily = selected.rule.minimumDailyWage
      ? money(Number(selected.rule.minimumDailyWage) + allowanceResult.total)
      : null;
    return {
      applicable: true,
      agreement: {
        id: selected.agreement.id,
        code: selected.agreement.code,
        title: selected.agreement.title,
        sourceUrl: selected.agreement.sourceUrl,
        mandatory: selected.agreement.mandatory,
      },
      version: {
        id: selected.version.id,
        label: selected.version.versionLabel,
        validFrom: selected.version.validFrom,
        validTo: selected.version.validTo,
        weeklyHours: selected.version.weeklyHours,
      },
      wageRule: {
        specialtyCode: selected.rule.specialtyCode,
        specialtyTitle: selected.rule.specialtyTitle,
        minimumMonthlySalary: selected.rule.minimumMonthlySalary,
        minimumDailyWage: selected.rule.minimumDailyWage,
      },
      allowances: allowanceResult.items,
      collectiveMonthlySalary: collectiveMonthly,
      collectiveDailyWage: collectiveDaily,
      legalMonthlySalary: Math.max(dto.statutoryMonthlySalary ?? 0, collectiveMonthly ?? 0) || null,
      legalDailyWage: Math.max(dto.statutoryDailyWage ?? 0, collectiveDaily ?? 0) || null,
      evaluatedAt: new Date(),
      onDate,
    };
  }

  async applyToContract(
    tenant: TenantContext,
    contractId: string,
    dto: ApplyCollectiveAgreementDto,
  ) {
    const contract = await this.prisma.payrollContract.findFirst({
      where: {
        id: contractId,
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
      },
    });
    if (!contract) throw new NotFoundException('Η σύμβαση εργαζομένου δεν βρέθηκε.');
    const evaluation = await this.evaluate(tenant, dto);
    const version = evaluation.version;
    const agreement = evaluation.agreement;
    if (!evaluation.applicable || !version || !agreement) {
      throw new BadRequestException(
        'Δεν βρέθηκε ενεργή ΣΣΕ για αυτόν τον ΚΑΔ, ειδικότητα και χρόνο.',
      );
    }
    const updated = await this.prisma.payrollContract.update({
      where: { id: contractId },
      data: {
        specialtyCode: normalizeCode(dto.specialtyCode),
        collectiveAgreementVersionId: version.id,
        statutoryMonthlySalary: evaluation.legalMonthlySalary,
        statutoryDailyWage: evaluation.legalDailyWage,
        weeklyHours: version.weeklyHours ?? undefined,
        legalBaseSnapshot: evaluation as unknown as Prisma.InputJsonValue,
      },
    });
    await this.event(
      tenant,
      contractId,
      AuditAction.UPDATE,
      'COLLECTIVE_AGREEMENT_APPLIED',
      {
        agreementId: agreement.id,
        versionId: version.id,
        specialtyCode: dto.specialtyCode,
        legalMonthlySalary: evaluation.legalMonthlySalary,
        legalDailyWage: evaluation.legalDailyWage,
      },
      'PayrollContract',
    );
    return { contract: updated, evaluation };
  }

  private async ensureCompany(tenant: TenantContext, id: string) {
    const company = await this.prisma.clientCompany.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId, deletedAt: null },
    });
    if (!company) throw new NotFoundException('Ο πελάτης δεν βρέθηκε.');
    return company;
  }

  private async getAgreement(tenant: TenantContext, id: string) {
    const agreement = await this.prisma.collectiveAgreement.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
      include,
    });
    if (!agreement) throw new NotFoundException('Η ΣΣΕ δεν βρέθηκε.');
    return agreement;
  }

  private event(
    tenant: TenantContext,
    entityId: string,
    action: AuditAction,
    event: string,
    details: object,
    entityType = 'CollectiveAgreement',
  ) {
    return this.audit.record({
      tenant,
      action,
      entityType,
      entityId,
      newValue: { event, ...details } as Prisma.InputJsonValue,
    });
  }
}

function calculateAllowances(
  value: Prisma.JsonValue,
  priorServiceYears: number,
  inputs: Record<string, boolean | number | string>,
  base: number,
) {
  const rules = Array.isArray(value) ? value : [];
  const items: Array<{ code: string; title: string; amount: number }> = [];
  for (const candidate of rules) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const rule = candidate as Record<string, unknown>;
    const minYears = Number(rule['minPriorServiceYears'] ?? 0);
    const inputKey = typeof rule['inputKey'] === 'string' ? rule['inputKey'] : undefined;
    if (priorServiceYears < minYears || (inputKey && !inputs[inputKey])) continue;
    const type = String(rule['type'] ?? 'FIXED').toUpperCase();
    const valueNumber = Number(rule['value'] ?? 0);
    if (!Number.isFinite(valueNumber) || valueNumber < 0) continue;
    const amount = money(type === 'PERCENT' ? (base * valueNumber) / 100 : valueNumber);
    items.push({
      code: String(rule['code'] ?? `ALLOWANCE_${items.length + 1}`),
      title: String(rule['title'] ?? 'Επίδομα'),
      amount,
    });
  }
  return { items, total: money(items.reduce((total, item) => total + item.amount, 0)) };
}

function readCodes(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map(normalizeCode)
    : [];
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
