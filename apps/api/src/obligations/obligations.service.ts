import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  ClientCompany,
  ObligationRecurrence,
  ObligationStatus,
  ObligationType,
  OfficeObligation,
  Prisma,
  TaxCalendarRule,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { CreateObligationDto } from './dto/create-obligation.dto';
import { FindObligationsQueryDto } from './dto/find-obligations-query.dto';
import { GenerateMonthlyObligationsDto } from './dto/generate-monthly-obligations.dto';
import { UpdateObligationDto } from './dto/update-obligation.dto';
import { UpsertTaxCalendarOverrideDto } from './dto/upsert-tax-calendar-override.dto';
import { UpsertTaxCalendarRuleDto } from './dto/upsert-tax-calendar-rule.dto';

@Injectable()
export class ObligationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(tenant: TenantContext, query: FindObligationsQueryDto = {}) {
    return this.prisma.officeObligation.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: query.clientCompanyId,
        type: query.type,
        status: query.status,
        dueDate:
          query.dueFrom || query.dueTo
            ? {
                gte: query.dueFrom ? new Date(query.dueFrom) : undefined,
                lte: query.dueTo ? new Date(query.dueTo) : undefined,
              }
            : undefined,
      },
      include: {
        clientCompany: {
          select: {
            id: true,
            legalName: true,
            vatNumber: true,
            accountingCategory: true,
            vatRegime: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(tenant: TenantContext, dto: CreateObligationDto) {
    await this.ensureTenantCompany(tenant, dto.clientCompanyId);
    await this.ensureTenantUser(tenant, dto.assignedUserId);

    const obligation = await this.prisma.officeObligation.create({
      data: this.toCreateData(tenant, dto),
    });

    await this.auditService.record({
      tenant,
      action: AuditAction.CREATE,
      entityType: 'OfficeObligation',
      entityId: obligation.id,
      newValue: this.toAuditJson(obligation),
    });

    return obligation;
  }

  async update(tenant: TenantContext, id: string, dto: UpdateObligationDto) {
    const existing = await this.getTenantObligation(tenant, id);

    if (dto.clientCompanyId) {
      await this.ensureTenantCompany(tenant, dto.clientCompanyId);
    }
    await this.ensureTenantUser(tenant, dto.assignedUserId);

    const updated = await this.prisma.officeObligation.update({
      where: { id: existing.id },
      data: {
        clientCompanyId: dto.clientCompanyId,
        assignedUserId: dto.assignedUserId,
        type: dto.type,
        title: dto.title,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status,
        recurrence: dto.recurrence,
        notes: dto.notes,
        completedAt:
          dto.status === ObligationStatus.SUBMITTED && existing.completedAt === null
            ? new Date()
            : undefined,
      },
    });

    await this.auditService.record({
      tenant,
      action: AuditAction.UPDATE,
      entityType: 'OfficeObligation',
      entityId: updated.id,
      oldValue: this.toAuditJson(existing),
      newValue: this.toAuditJson(updated),
    });

    return updated;
  }

  async complete(tenant: TenantContext, id: string) {
    const existing = await this.getTenantObligation(tenant, id);
    const updated = await this.prisma.officeObligation.update({
      where: { id: existing.id },
      data: {
        status: ObligationStatus.SUBMITTED,
        completedAt: new Date(),
      },
    });

    await this.auditService.record({
      tenant,
      action: AuditAction.UPDATE,
      entityType: 'OfficeObligation',
      entityId: updated.id,
      oldValue: this.toAuditJson(existing),
      newValue: this.toAuditJson(updated),
    });

    return updated;
  }

  async generateMonthly(tenant: TenantContext, dto: GenerateMonthlyObligationsDto) {
    const companies = await this.prisma.clientCompany.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
      orderBy: { legalName: 'asc' },
    });

    const createdOrExisting: OfficeObligation[] = [];
    const rules = await this.taxCalendarRules(tenant);
    const overrides = await this.prisma.taxCalendarOverride.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        periodYear: dto.year,
        periodMonth: dto.month,
      },
    });

    for (const company of companies) {
      for (const rule of rules.filter((item) => appliesToCompany(item, company, dto.month))) {
        const override = overrides.find((item) => item.taxCalendarRuleId === rule.id);
        createdOrExisting.push(
          await this.upsertGeneratedObligation(tenant, company, {
            type: rule.obligationType,
            title: `${rule.name} ${formatPeriod(dto.month, dto.year)}`,
            periodYear: dto.year,
            periodMonth: dto.month,
            dueDate: override?.dueDate ?? calculatedDueDate(rule, dto.year, dto.month),
            recurrence: rule.recurrence,
          }),
        );
      }
    }

    return {
      generated: createdOrExisting.length,
      obligations: createdOrExisting,
    };
  }

  async taxCalendarRules(tenant: TenantContext) {
    const existing = await this.prisma.taxCalendarRule.findMany({
      where: { accountingOfficeId: tenant.accountingOfficeId },
      orderBy: { code: 'asc' },
    });
    if (existing.length > 0) return existing;
    await this.prisma.taxCalendarRule.createMany({
      data: defaultTaxCalendarRules(tenant.accountingOfficeId),
      skipDuplicates: true,
    });
    return this.prisma.taxCalendarRule.findMany({
      where: { accountingOfficeId: tenant.accountingOfficeId },
      orderBy: { code: 'asc' },
    });
  }

  async upsertTaxCalendarRule(tenant: TenantContext, dto: UpsertTaxCalendarRuleDto) {
    return this.prisma.taxCalendarRule.upsert({
      where: {
        accountingOfficeId_code: { accountingOfficeId: tenant.accountingOfficeId, code: dto.code },
      },
      update: { ...dto },
      create: { accountingOfficeId: tenant.accountingOfficeId, ...dto },
    });
  }

  async upsertTaxCalendarOverride(tenant: TenantContext, dto: UpsertTaxCalendarOverrideDto) {
    const rule = await this.prisma.taxCalendarRule.findFirst({
      where: { id: dto.taxCalendarRuleId, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!rule) throw new NotFoundException('Tax calendar rule was not found.');
    return this.prisma.taxCalendarOverride.upsert({
      where: {
        taxCalendarRuleId_periodYear_periodMonth: {
          taxCalendarRuleId: rule.id,
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
        },
      },
      update: { dueDate: new Date(dto.dueDate), sourceUrl: dto.sourceUrl, notes: dto.notes },
      create: {
        accountingOfficeId: tenant.accountingOfficeId,
        taxCalendarRuleId: rule.id,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        dueDate: new Date(dto.dueDate),
        sourceUrl: dto.sourceUrl,
        notes: dto.notes,
      },
    });
  }

  private async upsertGeneratedObligation(
    tenant: TenantContext,
    company: ClientCompany,
    data: {
      type: ObligationType;
      title: string;
      periodYear: number;
      periodMonth: number;
      dueDate: Date;
      recurrence: ObligationRecurrence;
    },
  ) {
    // TODO: Official Greek tax calendar dates can change. Before production use,
    // connect this generator to a maintained tax-calendar source and verify AADE
    // announcements for VAT/myDATA deadlines.
    return this.prisma.officeObligation.upsert({
      where: {
        clientCompanyId_type_periodYear_periodMonth: {
          clientCompanyId: company.id,
          type: data.type,
          periodYear: data.periodYear,
          periodMonth: data.periodMonth,
        },
      },
      update: {},
      create: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: company.id,
        type: data.type,
        title: data.title,
        periodYear: data.periodYear,
        periodMonth: data.periodMonth,
        dueDate: data.dueDate,
        recurrence: data.recurrence,
      },
    });
  }

  private async getTenantObligation(tenant: TenantContext, id: string) {
    const obligation = await this.prisma.officeObligation.findFirst({
      where: {
        id,
        accountingOfficeId: tenant.accountingOfficeId,
      },
    });

    if (!obligation) {
      throw new NotFoundException('Obligation was not found.');
    }

    return obligation;
  }

  private async ensureTenantCompany(tenant: TenantContext, clientCompanyId: string): Promise<void> {
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

  private async ensureTenantUser(tenant: TenantContext, userId?: string): Promise<void> {
    if (!userId) {
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        accountingOfficeId: tenant.accountingOfficeId,
      },
    });

    if (!user) {
      throw new BadRequestException('Assigned user does not belong to this accounting office.');
    }
  }

  private toCreateData(
    tenant: TenantContext,
    dto: CreateObligationDto,
  ): Prisma.OfficeObligationUncheckedCreateInput {
    return {
      accountingOfficeId: tenant.accountingOfficeId,
      clientCompanyId: dto.clientCompanyId,
      assignedUserId: dto.assignedUserId,
      type: dto.type,
      title: dto.title,
      periodYear: dto.periodYear,
      periodMonth: dto.periodMonth,
      dueDate: new Date(dto.dueDate),
      status: dto.status,
      recurrence: dto.recurrence,
      notes: dto.notes,
    };
  }

  private toAuditJson(obligation: OfficeObligation): Prisma.InputJsonValue {
    return {
      id: obligation.id,
      accountingOfficeId: obligation.accountingOfficeId,
      clientCompanyId: obligation.clientCompanyId,
      assignedUserId: obligation.assignedUserId,
      type: obligation.type,
      title: obligation.title,
      periodYear: obligation.periodYear,
      periodMonth: obligation.periodMonth,
      dueDate: obligation.dueDate.toISOString(),
      status: obligation.status,
      recurrence: obligation.recurrence,
      completedAt: obligation.completedAt?.toISOString() ?? null,
    };
  }
}

function appliesToCompany(rule: TaxCalendarRule, company: ClientCompany, month: number): boolean {
  if (
    !rule.isActive ||
    (rule.accountingCategory && rule.accountingCategory !== company.accountingCategory)
  )
    return false;
  if (rule.vatRegime && rule.vatRegime !== company.vatRegime) return false;
  return !rule.applicableMonths || rule.applicableMonths.split(',').map(Number).includes(month);
}

function formatPeriod(month: number, year: number): string {
  return `${String(month).padStart(2, '0')}/${year}`;
}

function calculatedDueDate(rule: TaxCalendarRule, year: number, month: number): Date {
  const target = new Date(Date.UTC(year, month - 1 + rule.dueMonthOffset, 1));
  const day =
    rule.dueDay === 0
      ? new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
      : Math.min(
          rule.dueDay,
          new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate(),
        );
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day));
}

function defaultTaxCalendarRules(
  accountingOfficeId: string,
): Prisma.TaxCalendarRuleCreateManyInput[] {
  return [
    {
      accountingOfficeId,
      code: 'MYDATA_MONTHLY',
      name: 'Έλεγχος myDATA',
      obligationType: ObligationType.MYDATA_REVIEW,
      recurrence: ObligationRecurrence.MONTHLY,
      dueMonthOffset: 1,
      dueDay: 20,
      notes: 'Επιβεβαιώστε την προθεσμία από τις τρέχουσες ανακοινώσεις ΑΑΔΕ.',
    },
    {
      accountingOfficeId,
      code: 'VAT_MONTHLY',
      name: 'Περιοδική ΦΠΑ',
      obligationType: ObligationType.VAT_RETURN,
      recurrence: ObligationRecurrence.MONTHLY,
      dueMonthOffset: 1,
      dueDay: 0,
      accountingCategory: 'DOUBLE_ENTRY',
      vatRegime: 'NORMAL',
      notes: 'Επιβεβαιώστε την προθεσμία από τις τρέχουσες ανακοινώσεις ΑΑΔΕ.',
    },
    {
      accountingOfficeId,
      code: 'VAT_QUARTERLY',
      name: 'Περιοδική ΦΠΑ',
      obligationType: ObligationType.VAT_RETURN,
      recurrence: ObligationRecurrence.QUARTERLY,
      dueMonthOffset: 1,
      dueDay: 0,
      applicableMonths: '3,6,9,12',
      accountingCategory: 'SIMPLE_BOOKS',
      vatRegime: 'NORMAL',
      notes: 'Επιβεβαιώστε την προθεσμία από τις τρέχουσες ανακοινώσεις ΑΑΔΕ.',
    },
  ];
}
