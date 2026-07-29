import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApdDeclarationType,
  AuditAction,
  PayrollContract,
  PayrollCompensationType,
  PayrollErganiDeclarationStatus,
  PayrollErganiDeclarationType,
  PayrollEventType,
  PayrollLeavePaymentSource,
  PayrollLeave,
  PayrollLeaveType,
  PayrollPeriodStatus,
  PayrollSicknessBenefitStatus,
  PayrollTerminationStatus,
  PayrollTerminationType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TenantContext } from '../common/tenant/tenant-context';
import { ApdExportService } from './apd-export.service';
import {
  CalculatePayrollPeriodDto,
  CompleteApdSubmissionDto,
  CompleteFmySubmissionDto,
  CompletePayrollErganiDeclarationDto,
  CompletePayrollTerminationDto,
  CreatePayrollErganiDeclarationDto,
  CreatePayrollEventDto,
  CreatePayrollLeaveDto,
  CreatePayrollContractDto,
  CreatePayrollEmployeeDto,
  CreatePayrollTerminationDto,
  MarkContributionsPaidDto,
  MarkFmyPaidDto,
  MarkPayrollPaidDto,
  UpdatePayrollComplianceDeadlinesDto,
  UpdatePayrollContractDto,
  UpdatePayrollEmployeeDto,
  UpdatePayrollSicknessDto,
  UpsertPayrollEmployerSettingsDto,
} from './dto/payroll.dto';
import {
  athensEndOfDay,
  erganiDeclarationBlocksPayroll,
  erganiDeclarationDeadline,
  erganiDeclarationNeedsAcceptance,
  isErganiSubmissionLate,
} from './ergani-declaration';
import {
  fmyDeadlineForPaymentDate,
  isComplianceLate,
  payrollComplianceDeadlines,
} from './payroll-compliance';
import {
  ageAt,
  calculateMonthlyWithholdingTax2026,
  calculateWorkPremiums,
  roundMoney,
} from './payroll-calculator';

const PERIOD_INCLUDE = {
  clientCompany: { select: { id: true, legalName: true, vatNumber: true } },
  approvedBy: { select: { id: true, fullName: true } },
  entries: {
    include: {
      employee: true,
      contract: true,
    },
    orderBy: [
      { employee: { lastName: 'asc' } },
      { employee: { firstName: 'asc' } },
      { apdEarningsType: 'asc' },
    ],
  },
} satisfies Prisma.PayrollPeriodInclude;

export interface SicknessCalculationContext {
  priorEmployerLiabilityDays: number;
  priorEpisodeDays: number;
  employerLiabilityLimitDays: number;
  hasPriorLongSicknessInCalendarYear: boolean;
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly apdExport: ApdExportService,
  ) {}

  async getWorkspace(tenant: TenantContext, clientCompanyId: string) {
    await this.ensureTenantCompany(tenant, clientCompanyId);
    const [settings, employees, periods, events, leaves, terminations, erganiDeclarations] =
      await Promise.all([
      this.prisma.payrollEmployerSettings.findFirst({
        where: { accountingOfficeId: tenant.accountingOfficeId, clientCompanyId },
      }),
      this.prisma.payrollEmployee.findMany({
        where: { accountingOfficeId: tenant.accountingOfficeId, clientCompanyId },
        include: { contracts: { orderBy: { startDate: 'desc' } } },
        orderBy: [{ status: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.payrollPeriod.findMany({
        where: { accountingOfficeId: tenant.accountingOfficeId, clientCompanyId },
        include: PERIOD_INCLUDE,
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        take: 24,
      }),
      this.prisma.payrollEvent.findMany({
        where: { accountingOfficeId: tenant.accountingOfficeId, clientCompanyId },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { createdAt: 'desc' }],
        take: 100,
      }),
      this.prisma.payrollLeave.findMany({
        where: { accountingOfficeId: tenant.accountingOfficeId, clientCompanyId },
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ dateFrom: 'desc' }],
      }),
      this.prisma.payrollTermination.findMany({
        where: { accountingOfficeId: tenant.accountingOfficeId, clientCompanyId },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
          contract: { select: { id: true, startDate: true, endDate: true } },
        },
        orderBy: [{ terminationDate: 'desc' }],
        take: 100,
      }),
      this.prisma.payrollErganiDeclaration.findMany({
        where: { accountingOfficeId: tenant.accountingOfficeId, clientCompanyId },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
          contract: { select: { id: true, startDate: true, endDate: true } },
        },
        orderBy: [{ status: 'asc' }, { deadlineAt: 'asc' }, { createdAt: 'desc' }],
        take: 200,
      }),
    ]);
    const periodsWithDeadlines = await Promise.all(
      periods.map((period) => {
        if (
          period.apdSubmissionDeadline &&
          period.contributionsPaymentDeadline &&
          period.fmySubmissionDeadline
        ) {
          return period;
        }
        const deadlines = payrollComplianceDeadlines(
          period.periodYear,
          period.periodMonth,
        );
        return this.prisma.payrollPeriod.update({
          where: { id: period.id },
          data: {
            apdSubmissionDeadline:
              period.apdSubmissionDeadline ?? deadlines.apdSubmissionDeadline,
            contributionsPaymentDeadline:
              period.contributionsPaymentDeadline ??
              deadlines.contributionsPaymentDeadline,
            fmySubmissionDeadline:
              period.fmySubmissionDeadline ?? deadlines.fmySubmissionDeadline,
          },
          include: PERIOD_INCLUDE,
        });
      }),
    );
    const leaveBalances = employees.map((employee) => {
      const contract = [...employee.contracts].sort(
        (a, b) => a.startDate.getTime() - b.startDate.getTime(),
      )[0];
      const year = new Date().getUTCFullYear();
      const entitlement = contract
        ? annualLeaveEntitlement({
            employmentStart: contract.startDate,
            fiscalYear: year,
            weeklySystem: contract.weeklySystem,
            recognizedPriorServiceYears: employee.recognizedPriorServiceYears,
          })
        : 0;
      const taken = leaves
        .filter(
          (leave) =>
            leave.employeeId === employee.id &&
            leave.fiscalYear === year &&
            leave.type === PayrollLeaveType.ANNUAL,
        )
        .reduce((total, leave) => total + Number(leave.workingDays), 0);
      return { employeeId: employee.id, fiscalYear: year, entitlement, taken, remaining: roundMoney(entitlement - taken) };
    });
    return {
      settings,
      employees,
      periods: periodsWithDeadlines,
      events,
      leaves,
      leaveBalances,
      terminations,
      erganiDeclarations,
    };
  }

  async upsertEmployerSettings(
    tenant: TenantContext,
    dto: UpsertPayrollEmployerSettingsDto,
  ) {
    await this.ensureTenantCompany(tenant, dto.clientCompanyId);
    const oldValue = await this.prisma.payrollEmployerSettings.findUnique({
      where: { clientCompanyId: dto.clientCompanyId },
    });
    if (oldValue && oldValue.accountingOfficeId !== tenant.accountingOfficeId) {
      throw new NotFoundException('Η επιχείρηση δεν βρέθηκε.');
    }

    const settings = await this.prisma.payrollEmployerSettings.upsert({
      where: { clientCompanyId: dto.clientCompanyId },
      create: {
        ...dto,
        accountingOfficeId: tenant.accountingOfficeId,
        submissionOfficeCode: dto.submissionOfficeCode.padStart(10, '0'),
        efkaPaymentRf: dto.efkaPaymentRf?.toUpperCase(),
        tekaPaymentRf: dto.tekaPaymentRf?.toUpperCase(),
      },
      update: {
        employerRegistryNumber: dto.employerRegistryNumber,
        submissionOfficeCode: dto.submissionOfficeCode.padStart(10, '0'),
        submissionOfficeName: dto.submissionOfficeName,
        street: dto.street,
        streetNumber: dto.streetNumber,
        postalCode: dto.postalCode,
        city: dto.city,
        efkaPaymentRf: dto.efkaPaymentRf?.toUpperCase(),
        tekaPaymentRf: dto.tekaPaymentRf?.toUpperCase(),
      },
    });
    await this.recordAudit(
      tenant,
      oldValue ? AuditAction.UPDATE : AuditAction.CREATE,
      'PayrollEmployerSettings',
      settings.id,
      oldValue,
      settings,
    );
    return settings;
  }

  async createEmployee(tenant: TenantContext, dto: CreatePayrollEmployeeDto) {
    await this.ensureTenantCompany(tenant, dto.clientCompanyId);
    const employee = await this.prisma.payrollEmployee.create({
      data: {
        ...dto,
        accountingOfficeId: tenant.accountingOfficeId,
        birthDate: utcDate(dto.birthDate),
        afm: dto.afm,
        amka: dto.amka,
        iban: dto.iban?.toUpperCase(),
      },
    });
    await this.recordAudit(
      tenant,
      AuditAction.CREATE,
      'PayrollEmployee',
      employee.id,
      undefined,
      employee,
    );
    return employee;
  }

  async updateEmployee(
    tenant: TenantContext,
    id: string,
    dto: UpdatePayrollEmployeeDto,
  ) {
    const existing = await this.prisma.payrollEmployee.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!existing) throw new NotFoundException('Ο εργαζόμενος δεν βρέθηκε.');
    const lockedEntry = await this.findLockedPayrollEntry(id, undefined);
    const protectedIdentityChanged =
      (dto.code !== undefined && dto.code !== existing.code) ||
      (dto.lastName !== undefined && dto.lastName !== existing.lastName) ||
      (dto.firstName !== undefined && dto.firstName !== existing.firstName) ||
      (dto.fatherName !== undefined && dto.fatherName !== existing.fatherName) ||
      (dto.motherName !== undefined && dto.motherName !== existing.motherName) ||
      (dto.birthDate !== undefined &&
        utcDate(dto.birthDate).getTime() !== existing.birthDate.getTime()) ||
      (dto.afm !== undefined && dto.afm !== existing.afm) ||
      (dto.amka !== undefined && dto.amka !== existing.amka) ||
      (dto.insuranceRegistryNumber !== undefined &&
        dto.insuranceRegistryNumber !== existing.insuranceRegistryNumber) ||
      (dto.tekaInsured !== undefined &&
        dto.tekaInsured !== existing.tekaInsured);
    if (lockedEntry && protectedIdentityChanged) {
      throw new BadRequestException(
        'Τα στοιχεία ταυτότητας χρησιμοποιούνται σε εγκεκριμένη ΑΠΔ και δεν αλλοιώνονται. Επιτρέπονται μόνο κατάσταση, στοιχεία επικοινωνίας και τρέχοντα φορολογικά στοιχεία.',
      );
    }

    const updated = await this.prisma.payrollEmployee.update({
      where: { id },
      data: {
        code: dto.code,
        status: dto.status,
        lastName: dto.lastName,
        firstName: dto.firstName,
        fatherName: dto.fatherName,
        motherName: dto.motherName,
        birthDate: dto.birthDate ? utcDate(dto.birthDate) : undefined,
        afm: dto.afm,
        amka: dto.amka,
        insuranceRegistryNumber: dto.insuranceRegistryNumber,
        dependentChildren: dto.dependentChildren,
        recognizedPriorServiceYears: dto.recognizedPriorServiceYears,
        tekaInsured: dto.tekaInsured,
        email: dto.email,
        phone: dto.phone,
        iban: dto.iban?.toUpperCase(),
        notes: dto.notes,
      },
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollEmployee',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async createContract(tenant: TenantContext, dto: CreatePayrollContractDto) {
    const employee = await this.prisma.payrollEmployee.findFirst({
      where: { id: dto.employeeId, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!employee) throw new NotFoundException('Ο εργαζόμενος δεν βρέθηκε.');

    const startDate = utcDate(dto.startDate);
    const endDate = dto.endDate ? utcDate(dto.endDate) : undefined;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('Η λήξη σύμβασης δεν μπορεί να προηγείται της έναρξης.');
    }
    this.validateCompensation(dto, startDate);
    this.validateContractSchedule(dto);
    await this.ensureNoContractOverlap(employee.id, startDate, endDate);

    const effectiveAt = new Date(dto.erganiEffectiveAt);
    if (athensDateKey(effectiveAt) !== dto.startDate.slice(0, 10)) {
      throw new BadRequestException(
        'Η ακριβής έναρξη εργασίας στο ΕΡΓΑΝΗ ΙΙ πρέπει να ανήκει στην ημερομηνία έναρξης της σύμβασης.',
      );
    }
    const result = await this.prisma.$transaction(async (transaction) => {
      const contract = await transaction.payrollContract.create({
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: employee.clientCompanyId,
          employeeId: employee.id,
          startDate,
          endDate,
          compensationType: dto.compensationType,
          monthlySalary: dto.monthlySalary,
          dailyWage: dto.dailyWage,
          statutoryMonthlySalary: dto.statutoryMonthlySalary,
          statutoryDailyWage: dto.statutoryDailyWage,
          fullTime: dto.fullTime,
          weeklySystem: dto.weeklySystem,
          weeklyHours: dto.weeklyHours,
          workDaysPerWeek: dto.workDaysPerWeek,
          workWeekdays: dto.workWeekdays,
          dailyStartTime: dto.dailyStartTime,
          dailyEndTime: dto.dailyEndTime,
          breakMinutes: dto.breakMinutes,
          breakWithinWorkingTime: dto.breakWithinWorkingTime,
          digitalCardEnabled: dto.digitalCardEnabled,
          flexibleArrivalMinutes: dto.flexibleArrivalMinutes,
          apdBranchNumber: dto.apdBranchNumber,
          apdKad: dto.apdKad,
          apdSpecialtyCode: dto.apdSpecialtyCode,
          apdSpecialInsuranceCase: dto.apdSpecialInsuranceCase,
          apdCoveragePackageCode: dto.apdCoveragePackageCode,
          externalSupplementaryFund: dto.externalSupplementaryFund,
          externalHealthFund: dto.externalHealthFund,
          employeeContributionRate: dto.employeeContributionRate,
          employerContributionRate: dto.employerContributionRate,
          notes: dto.notes,
        },
      });
      const hiringDeclaration = await transaction.payrollErganiDeclaration.create({
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: employee.clientCompanyId,
          employeeId: employee.id,
          contractId: contract.id,
          type: PayrollErganiDeclarationType.HIRING,
          effectiveAt,
          deadlineAt: erganiDeclarationDeadline(
            PayrollErganiDeclarationType.HIRING,
            effectiveAt,
          ),
          declarationSnapshot: payrollContractSnapshot(contract),
          notes: 'Δημιουργήθηκε αυτόματα με τη νέα σύμβαση.',
        },
      });
      const scheduleDeclaration =
        await transaction.payrollErganiDeclaration.create({
          data: {
            accountingOfficeId: tenant.accountingOfficeId,
            clientCompanyId: employee.clientCompanyId,
            employeeId: employee.id,
            contractId: contract.id,
            type: PayrollErganiDeclarationType.INITIAL_WORK_SCHEDULE,
            effectiveAt,
            deadlineAt: erganiDeclarationDeadline(
              PayrollErganiDeclarationType.INITIAL_WORK_SCHEDULE,
              effectiveAt,
            ),
            declarationSnapshot: payrollContractSnapshot(contract),
            notes:
              'Αρχική Ψηφιακή Οργάνωση Χρόνου Εργασίας — υποβάλλεται αυθημερόν μετά την πρόσληψη.',
          },
        });
      return { contract, hiringDeclaration, scheduleDeclaration };
    });
    await this.recordAudit(
      tenant,
      AuditAction.CREATE,
      'PayrollContract',
      result.contract.id,
      undefined,
      result.contract,
    );
    await this.recordAudit(
      tenant,
      AuditAction.CREATE,
      'PayrollErganiDeclaration',
      result.hiringDeclaration.id,
      undefined,
      result.hiringDeclaration,
    );
    await this.recordAudit(
      tenant,
      AuditAction.CREATE,
      'PayrollErganiDeclaration',
      result.scheduleDeclaration.id,
      undefined,
      result.scheduleDeclaration,
    );
    return result.contract;
  }

  async updateContract(
    tenant: TenantContext,
    id: string,
    dto: UpdatePayrollContractDto,
  ) {
    const existing = await this.prisma.payrollContract.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!existing) throw new NotFoundException('Η σύμβαση δεν βρέθηκε.');
    const lockedEntry = await this.findLockedPayrollEntry(undefined, id);

    const startDate = dto.startDate ? utcDate(dto.startDate) : existing.startDate;
    const endDate =
      dto.endDate === undefined
        ? existing.endDate ?? undefined
        : dto.endDate
          ? utcDate(dto.endDate)
          : undefined;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('Η λήξη σύμβασης δεν μπορεί να προηγείται της έναρξης.');
    }
    const merged: CreatePayrollContractDto = {
      employeeId: existing.employeeId,
      startDate: startDate.toISOString(),
      erganiEffectiveAt:
        dto.erganiEffectiveAt ?? existing.startDate.toISOString(),
      endDate: endDate?.toISOString(),
      compensationType: dto.compensationType ?? existing.compensationType,
      monthlySalary:
        dto.monthlySalary !== undefined
          ? dto.monthlySalary
          : existing.monthlySalary === null
            ? undefined
            : Number(existing.monthlySalary),
      dailyWage:
        dto.dailyWage !== undefined
          ? dto.dailyWage
          : existing.dailyWage === null
            ? undefined
            : Number(existing.dailyWage),
      statutoryMonthlySalary:
        dto.statutoryMonthlySalary !== undefined
          ? dto.statutoryMonthlySalary
          : existing.statutoryMonthlySalary === null
            ? undefined
            : Number(existing.statutoryMonthlySalary),
      statutoryDailyWage:
        dto.statutoryDailyWage !== undefined
          ? dto.statutoryDailyWage
          : existing.statutoryDailyWage === null
            ? undefined
            : Number(existing.statutoryDailyWage),
      fullTime: dto.fullTime ?? existing.fullTime,
      weeklySystem: dto.weeklySystem ?? existing.weeklySystem,
      weeklyHours: dto.weeklyHours ?? Number(existing.weeklyHours),
      workDaysPerWeek: dto.workDaysPerWeek ?? existing.workDaysPerWeek,
      workWeekdays: dto.workWeekdays ?? existing.workWeekdays,
      dailyStartTime: dto.dailyStartTime ?? existing.dailyStartTime,
      dailyEndTime: dto.dailyEndTime ?? existing.dailyEndTime,
      breakMinutes: dto.breakMinutes ?? existing.breakMinutes,
      breakWithinWorkingTime:
        dto.breakWithinWorkingTime ?? existing.breakWithinWorkingTime,
      digitalCardEnabled:
        dto.digitalCardEnabled ?? existing.digitalCardEnabled,
      flexibleArrivalMinutes:
        dto.flexibleArrivalMinutes ?? existing.flexibleArrivalMinutes,
      apdBranchNumber: dto.apdBranchNumber ?? existing.apdBranchNumber,
      apdKad: dto.apdKad ?? existing.apdKad,
      apdSpecialtyCode: dto.apdSpecialtyCode ?? existing.apdSpecialtyCode,
      apdSpecialInsuranceCase:
        dto.apdSpecialInsuranceCase ?? existing.apdSpecialInsuranceCase,
      apdCoveragePackageCode:
        dto.apdCoveragePackageCode ?? existing.apdCoveragePackageCode,
      externalSupplementaryFund:
        dto.externalSupplementaryFund ?? existing.externalSupplementaryFund,
      externalHealthFund: dto.externalHealthFund ?? existing.externalHealthFund,
      employeeContributionRate:
        dto.employeeContributionRate ?? Number(existing.employeeContributionRate),
      employerContributionRate:
        dto.employerContributionRate ?? Number(existing.employerContributionRate),
      notes: dto.notes ?? existing.notes ?? undefined,
    };
    if (merged.compensationType === PayrollCompensationType.MONTHLY) {
      merged.dailyWage = undefined;
      merged.statutoryDailyWage = undefined;
    } else {
      merged.monthlySalary = undefined;
      merged.statutoryMonthlySalary = undefined;
    }
    const coreChanged = contractCoreChanged(existing, merged, startDate);
    const erganiTermsChanged = erganiContractTermsChanged(
      existing,
      merged,
      startDate,
      endDate,
    );
    if (erganiTermsChanged) {
      if (
        !dto.erganiDeclarationType ||
        dto.erganiDeclarationType === PayrollErganiDeclarationType.HIRING ||
        dto.erganiDeclarationType ===
          PayrollErganiDeclarationType.INITIAL_WORK_SCHEDULE ||
        !dto.erganiEffectiveAt
      ) {
        throw new BadRequestException(
          'Για ουσιώδη αλλαγή σύμβασης απαιτούνται τύπος μεταβολής ΕΡΓΑΝΗ ΙΙ και ακριβής ημερομηνία/ώρα εφαρμογής.',
        );
      }
    }
    if (
      lockedEntry &&
      (coreChanged ||
        !endDate ||
        endDate.getTime() < lockedEntry.employmentTo.getTime())
    ) {
      throw new BadRequestException(
        'Η σύμβαση έχει εγκεκριμένο ιστορικό. Επιτρέπεται μόνο λήξη μετά την τελευταία εγκεκριμένη περίοδο· για νέα αμοιβή ή όρους καταχωρίστε νέα σύμβαση.',
      );
    }
    this.validateCompensation(merged, startDate);
    this.validateContractSchedule(merged);
    await this.ensureNoContractOverlap(existing.employeeId, startDate, endDate, id);

    const result = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.payrollContract.update({
        where: { id },
        data: {
          startDate,
          endDate: endDate ?? null,
          compensationType: merged.compensationType,
          monthlySalary: merged.monthlySalary ?? null,
          dailyWage: merged.dailyWage ?? null,
          statutoryMonthlySalary: merged.statutoryMonthlySalary ?? null,
          statutoryDailyWage: merged.statutoryDailyWage ?? null,
          fullTime: merged.fullTime,
          weeklySystem: merged.weeklySystem,
          weeklyHours: merged.weeklyHours,
          workDaysPerWeek: merged.workDaysPerWeek,
          workWeekdays: merged.workWeekdays,
          dailyStartTime: merged.dailyStartTime,
          dailyEndTime: merged.dailyEndTime,
          breakMinutes: merged.breakMinutes,
          breakWithinWorkingTime: merged.breakWithinWorkingTime,
          digitalCardEnabled: merged.digitalCardEnabled,
          flexibleArrivalMinutes: merged.flexibleArrivalMinutes,
          apdBranchNumber: merged.apdBranchNumber,
          apdKad: merged.apdKad,
          apdSpecialtyCode: merged.apdSpecialtyCode,
          apdSpecialInsuranceCase: merged.apdSpecialInsuranceCase,
          apdCoveragePackageCode: merged.apdCoveragePackageCode,
          externalSupplementaryFund: merged.externalSupplementaryFund,
          externalHealthFund: merged.externalHealthFund,
          employeeContributionRate: merged.employeeContributionRate,
          employerContributionRate: merged.employerContributionRate,
          notes: merged.notes,
        },
      });
      if (!erganiTermsChanged || !dto.erganiDeclarationType || !dto.erganiEffectiveAt) {
        return { updated, declaration: undefined };
      }
      const effectiveAt = new Date(dto.erganiEffectiveAt);
      const existingDraft = await transaction.payrollErganiDeclaration.findFirst({
        where: {
          contractId: id,
          type: dto.erganiDeclarationType,
          status: PayrollErganiDeclarationStatus.DRAFT,
        },
        orderBy: { createdAt: 'desc' },
      });
      const declaration = existingDraft
        ? await transaction.payrollErganiDeclaration.update({
            where: { id: existingDraft.id },
            data: {
              effectiveAt,
              deadlineAt: erganiDeclarationDeadline(
                dto.erganiDeclarationType,
                effectiveAt,
              ),
              declarationSnapshot: payrollContractSnapshot(updated),
              notes: 'Ενημερώθηκε αυτόματα με τη μεταβολή της σύμβασης.',
            },
          })
        : await transaction.payrollErganiDeclaration.create({
            data: {
              accountingOfficeId: tenant.accountingOfficeId,
              clientCompanyId: existing.clientCompanyId,
              employeeId: existing.employeeId,
              contractId: id,
              type: dto.erganiDeclarationType,
              effectiveAt,
              deadlineAt: erganiDeclarationDeadline(
                dto.erganiDeclarationType,
                effectiveAt,
              ),
              declarationSnapshot: payrollContractSnapshot(updated),
              notes: 'Δημιουργήθηκε αυτόματα με τη μεταβολή της σύμβασης.',
            },
          });
      return { updated, declaration };
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollContract',
      id,
      existing,
      result.updated,
    );
    if (result.declaration) {
      await this.recordAudit(
        tenant,
        AuditAction.CREATE,
        'PayrollErganiDeclaration',
        result.declaration.id,
        undefined,
        result.declaration,
      );
    }
    return result.updated;
  }

  async deleteContract(tenant: TenantContext, id: string) {
    const existing = await this.prisma.payrollContract.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
      include: {
        erganiDeclarations: true,
        payrollTermination: { select: { id: true } },
        _count: { select: { payrollEntries: true, payrollEvents: true } },
      },
    });
    if (!existing) throw new NotFoundException('Η σύμβαση δεν βρέθηκε.');
    if (
      existing._count.payrollEntries > 0 ||
      existing._count.payrollEvents > 0 ||
      existing.payrollTermination
    ) {
      throw new BadRequestException(
        'Η σύμβαση έχει μισθολογικό ιστορικό ή διαδικασία λύσης και δεν μπορεί να ακυρωθεί.',
      );
    }
    if (
      existing.erganiDeclarations.some(
        (declaration) =>
          declaration.status === PayrollErganiDeclarationStatus.COMPLETED,
      )
    ) {
      throw new BadRequestException(
        'Η σύμβαση έχει υποβληθεί στο ΕΡΓΑΝΗ ΙΙ και δεν διαγράφεται. Χρησιμοποιήστε ορθή επανάληψη/ανάκληση στο ΕΡΓΑΝΗ ΙΙ και καταγράψτε την αντίστοιχη μεταβολή.',
      );
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.payrollErganiDeclaration.deleteMany({
        where: { contractId: id },
      });
      await transaction.payrollContract.delete({ where: { id } });
    });
    await this.recordAudit(
      tenant,
      AuditAction.DELETE,
      'PayrollContract',
      id,
      existing,
      undefined,
    );
    return { deleted: true };
  }

  async createErganiDeclaration(
    tenant: TenantContext,
    dto: CreatePayrollErganiDeclarationDto,
  ) {
    if (
      dto.type === PayrollErganiDeclarationType.HIRING ||
      dto.type === PayrollErganiDeclarationType.INITIAL_WORK_SCHEDULE
    ) {
      throw new BadRequestException(
        'Η πρόσληψη και η αρχική δήλωση ωραρίου δημιουργούνται αυτόματα μαζί με τη νέα σύμβαση.',
      );
    }
    const employee = await this.prisma.payrollEmployee.findFirst({
      where: {
        id: dto.employeeId,
        accountingOfficeId: tenant.accountingOfficeId,
      },
      include: { contracts: { orderBy: { startDate: 'desc' } } },
    });
    if (!employee) throw new NotFoundException('Ο εργαζόμενος δεν βρέθηκε.');
    const effectiveAt = new Date(dto.effectiveAt);
    const effectiveDate = utcDate(athensDateKey(effectiveAt));
    const contract = employee.contracts.find(
      (item) =>
        item.startDate <= effectiveDate &&
        (!item.endDate || item.endDate >= effectiveDate),
    );
    if (!contract) {
      throw new BadRequestException(
        'Δεν βρέθηκε ενεργή σύμβαση στην ημερομηνία εφαρμογής της μεταβολής.',
      );
    }
    const existingDraft = await this.prisma.payrollErganiDeclaration.findFirst({
      where: {
        contractId: contract.id,
        type: dto.type,
        status: PayrollErganiDeclarationStatus.DRAFT,
      },
    });
    if (existingDraft) {
      throw new BadRequestException(
        'Υπάρχει ήδη εκκρεμής δήλωση αυτού του τύπου για τη σύμβαση.',
      );
    }
    const declaration = await this.prisma.payrollErganiDeclaration.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: employee.clientCompanyId,
        employeeId: employee.id,
        contractId: contract.id,
        type: dto.type,
        effectiveAt,
        deadlineAt: erganiDeclarationDeadline(dto.type, effectiveAt),
        declarationSnapshot: payrollContractSnapshot(contract),
        notes: dto.notes,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        contract: { select: { id: true, startDate: true, endDate: true } },
      },
    });
    await this.recordAudit(
      tenant,
      AuditAction.CREATE,
      'PayrollErganiDeclaration',
      declaration.id,
      undefined,
      declaration,
    );
    return declaration;
  }

  async completeErganiDeclaration(
    tenant: TenantContext,
    id: string,
    dto: CompletePayrollErganiDeclarationDto,
  ) {
    const existing = await this.prisma.payrollErganiDeclaration.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        contract: { select: { id: true, startDate: true, endDate: true } },
      },
    });
    if (!existing) throw new NotFoundException('Η δήλωση ΕΡΓΑΝΗ ΙΙ δεν βρέθηκε.');
    if (existing.status !== PayrollErganiDeclarationStatus.DRAFT) {
      throw new BadRequestException('Η δήλωση ΕΡΓΑΝΗ ΙΙ έχει ήδη ολοκληρωθεί.');
    }
    const protocol = dto.erganiProtocol.trim();
    const protocolExists = await this.prisma.payrollErganiDeclaration.findFirst({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        erganiProtocol: protocol,
        id: { not: id },
      },
      select: { id: true },
    });
    if (protocolExists) {
      throw new BadRequestException(
        'Ο αριθμός πρωτοκόλλου έχει ήδη καταχωριστεί σε άλλη δήλωση.',
      );
    }
    const submittedAt = new Date(dto.erganiSubmittedAt);
    const needsAcceptance = erganiDeclarationNeedsAcceptance(existing.type);
    if (
      needsAcceptance &&
      (!dto.acceptanceMethod || !dto.acceptanceReference?.trim() || !dto.acceptedAt)
    ) {
      throw new BadRequestException(
        'Απαιτείται τρόπος, αποδεικτικό και χρόνος αποδοχής του εργαζομένου.',
      );
    }
    const acceptedAt = dto.acceptedAt ? new Date(dto.acceptedAt) : undefined;
    if (
      needsAcceptance &&
      acceptedAt &&
      acceptedAt.getTime() > existing.effectiveAt.getTime()
    ) {
      throw new BadRequestException(
        'Η αποδοχή του εργαζομένου πρέπει να έχει ολοκληρωθεί πριν από την εφαρμογή της δήλωσης.',
      );
    }
    const updated = await this.prisma.payrollErganiDeclaration.update({
      where: { id },
      data: {
        status: PayrollErganiDeclarationStatus.COMPLETED,
        erganiProtocol: protocol,
        erganiSubmittedAt: submittedAt,
        acceptanceMethod: dto.acceptanceMethod,
        acceptanceReference: dto.acceptanceReference?.trim(),
        acceptedAt,
        lateSubmission: isErganiSubmissionLate(submittedAt, existing.deadlineAt),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        contract: { select: { id: true, startDate: true, endDate: true } },
      },
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollErganiDeclaration',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async deleteErganiDeclaration(tenant: TenantContext, id: string) {
    const existing = await this.prisma.payrollErganiDeclaration.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!existing) throw new NotFoundException('Η δήλωση ΕΡΓΑΝΗ ΙΙ δεν βρέθηκε.');
    if (existing.status !== PayrollErganiDeclarationStatus.DRAFT) {
      throw new BadRequestException(
        'Ολοκληρωμένη δήλωση ΕΡΓΑΝΗ ΙΙ δεν διαγράφεται από το ιστορικό.',
      );
    }
    if (
      existing.type === PayrollErganiDeclarationType.HIRING ||
      existing.type === PayrollErganiDeclarationType.INITIAL_WORK_SCHEDULE
    ) {
      throw new BadRequestException(
        'Η εκκρεμής πρόσληψη και η αρχική δήλωση ωραρίου διαγράφονται μόνο μαζί με ακύρωση της νέας σύμβασης.',
      );
    }
    await this.prisma.payrollErganiDeclaration.delete({ where: { id } });
    await this.recordAudit(
      tenant,
      AuditAction.DELETE,
      'PayrollErganiDeclaration',
      id,
      existing,
      undefined,
    );
    return { deleted: true };
  }

  async createEvent(tenant: TenantContext, dto: CreatePayrollEventDto) {
    const employee = await this.prisma.payrollEmployee.findFirst({
      where: { id: dto.employeeId, accountingOfficeId: tenant.accountingOfficeId },
      include: { contracts: { orderBy: { startDate: 'desc' } } },
    });
    if (!employee) throw new NotFoundException('Ο εργαζόμενος δεν βρέθηκε.');
    const periodEnd = new Date(Date.UTC(dto.periodYear, dto.periodMonth, 0));
    const contract = employee.contracts.find(
      (value) =>
        value.startDate <= periodEnd && (!value.endDate || value.endDate >= new Date(Date.UTC(dto.periodYear, dto.periodMonth - 1, 1))),
    ) ?? employee.contracts[0];
    if (!contract) throw new BadRequestException('Ο εργαζόμενος δεν έχει σύμβαση.');
    await this.ensurePeriodMutableForCompany(
      employee.clientCompanyId,
      dto.periodYear,
      dto.periodMonth,
    );
    let sicknessContext: SicknessCalculationContext | undefined;
    let sicknessDates: { dateFrom: Date; dateTo: Date } | undefined;
    if (dto.type === PayrollEventType.SICKNESS) {
      sicknessDates = this.validateSicknessInput(dto, contract);
      const overlap = await this.prisma.payrollEvent.findFirst({
        where: {
          employeeId: employee.id,
          type: PayrollEventType.SICKNESS,
          dateFrom: { lte: sicknessDates.dateTo },
          dateTo: { gte: sicknessDates.dateFrom },
        },
      });
      if (overlap) {
        throw new BadRequestException('Υπάρχει ήδη αναρρωτική απουσία που επικαλύπτει το διάστημα.');
      }
      const leaveOverlap = await this.prisma.payrollLeave.findFirst({
        where: {
          employeeId: employee.id,
          dateFrom: { lte: sicknessDates.dateTo },
          dateTo: { gte: sicknessDates.dateFrom },
        },
      });
      if (leaveOverlap) {
        throw new BadRequestException('Υπάρχει ήδη άδεια ή απουσία που επικαλύπτει το διάστημα.');
      }
      sicknessContext = await this.sicknessCalculationContext(
        employee.id,
        contract.startDate,
        contract.compensationType,
        sicknessDates.dateFrom,
        dto.medicalCertificateReference!,
      );
    } else {
      const duplicate = await this.prisma.payrollEvent.findFirst({
        where: {
          employeeId: employee.id,
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
          type: dto.type,
        },
      });
      if (duplicate) {
        throw new BadRequestException(
          'Υπάρχει ήδη ίδιος τύπος ειδικής αποδοχής για τον εργαζόμενο και την περίοδο.',
        );
      }
    }

    const calculated = calculateEventGross(dto, contract, sicknessContext);
    const event = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.payrollEvent.create({
        data: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: employee.clientCompanyId,
          employeeId: employee.id,
          contractId: contract.id,
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
          type: dto.type,
          dateFrom: dto.dateFrom ? utcDate(dto.dateFrom) : undefined,
          dateTo: dto.dateTo ? utcDate(dto.dateTo) : undefined,
          insuranceDays: dto.insuranceDays ?? 0,
          leaveDays: dto.leaveDays,
          efkaBenefit: dto.efkaBenefit ?? 0,
          sicknessBenefitStatus: dto.sicknessBenefitStatus,
          medicalCertificateReference: dto.medicalCertificateReference?.trim(),
          grossAmount: calculated.grossAmount,
          autoCalculated: calculated.autoCalculated,
          calculationDetails: calculated.details,
          notes: dto.notes,
        },
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      });
      if (dto.type === PayrollEventType.SICKNESS && sicknessDates && dto.leaveDays) {
        await transaction.payrollLeave.create({
          data: {
            accountingOfficeId: tenant.accountingOfficeId,
            clientCompanyId: employee.clientCompanyId,
            employeeId: employee.id,
            payrollEventId: created.id,
            fiscalYear: sicknessDates.dateFrom.getUTCFullYear(),
            type: PayrollLeaveType.SICK,
            dateFrom: sicknessDates.dateFrom,
            dateTo: sicknessDates.dateTo,
            workingDays: dto.leaveDays,
            paid: true,
            notes: dto.notes,
          },
        });
      }
      return created;
    });
    await this.recordAudit(
      tenant,
      AuditAction.CREATE,
      'PayrollEvent',
      event.id,
      undefined,
      event,
    );
    return event;
  }

  async updateSickness(
    tenant: TenantContext,
    id: string,
    dto: UpdatePayrollSicknessDto,
  ) {
    const existing = await this.prisma.payrollEvent.findFirst({
      where: {
        id,
        accountingOfficeId: tenant.accountingOfficeId,
        type: PayrollEventType.SICKNESS,
      },
      include: { contract: true },
    });
    if (!existing) throw new NotFoundException('Η αναρρωτική απουσία δεν βρέθηκε.');
    await this.ensurePeriodMutableForCompany(
      existing.clientCompanyId,
      existing.periodYear,
      existing.periodMonth,
    );
    const calculationDto = {
      employeeId: existing.employeeId,
      periodYear: existing.periodYear,
      periodMonth: existing.periodMonth,
      type: PayrollEventType.SICKNESS,
      dateFrom: existing.dateFrom?.toISOString(),
      dateTo: existing.dateTo?.toISOString(),
      leaveDays: existing.leaveDays ?? undefined,
      insuranceDays: dto.insuranceDays ?? existing.insuranceDays,
      efkaBenefit: dto.efkaBenefit,
      sicknessBenefitStatus: dto.sicknessBenefitStatus,
      medicalCertificateReference:
        dto.medicalCertificateReference ?? existing.medicalCertificateReference ?? undefined,
      notes: dto.notes ?? existing.notes ?? undefined,
    } satisfies CreatePayrollEventDto;
    this.validateSicknessInput(calculationDto, existing.contract);
    const context = await this.sicknessCalculationContext(
      existing.employeeId,
      existing.contract.startDate,
      existing.contract.compensationType,
      existing.dateFrom!,
      calculationDto.medicalCertificateReference!,
      existing.id,
    );
    const calculated = calculateEventGross(calculationDto, existing.contract, context);
    const updated = await this.prisma.payrollEvent.update({
      where: { id },
      data: {
        insuranceDays: calculationDto.insuranceDays,
        efkaBenefit: dto.efkaBenefit,
        sicknessBenefitStatus: dto.sicknessBenefitStatus,
        medicalCertificateReference: calculationDto.medicalCertificateReference,
        grossAmount: calculated.grossAmount,
        autoCalculated: true,
        calculationDetails: calculated.details,
        notes: calculationDto.notes,
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollEvent',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async deleteEvent(tenant: TenantContext, id: string) {
    const event = await this.prisma.payrollEvent.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!event) throw new NotFoundException('Η ειδική αποδοχή δεν βρέθηκε.');
    await this.ensurePeriodMutableForCompany(
      event.clientCompanyId,
      event.periodYear,
      event.periodMonth,
    );
    await this.prisma.$transaction(async (transaction) => {
      await transaction.payrollLeave.deleteMany({ where: { payrollEventId: id } });
      await transaction.payrollEvent.delete({ where: { id } });
    });
    await this.recordAudit(
      tenant,
      AuditAction.DELETE,
      'PayrollEvent',
      id,
      event,
      undefined,
    );
    return { deleted: true };
  }

  async createLeave(tenant: TenantContext, dto: CreatePayrollLeaveDto) {
    if (dto.type === PayrollLeaveType.SICK) {
      throw new BadRequestException(
        'Η ασθένεια καταχωρίζεται στις ειδικές αποδοχές ώστε να υπολογιστούν εργοδοτικές αποδοχές και ΑΠΔ 008.',
      );
    }
    const employee = await this.prisma.payrollEmployee.findFirst({
      where: { id: dto.employeeId, accountingOfficeId: tenant.accountingOfficeId },
      include: { contracts: { orderBy: { startDate: 'asc' } } },
    });
    if (!employee) throw new NotFoundException('Ο εργαζόμενος δεν βρέθηκε.');
    const dateFrom = utcDate(dto.dateFrom);
    const dateTo = utcDate(dto.dateTo);
    if (dateTo < dateFrom) throw new BadRequestException('Η λήξη άδειας προηγείται της έναρξης.');
    if (dateFrom.getUTCFullYear() !== dateTo.getUTCFullYear()) {
      throw new BadRequestException('Η άδεια που περνά σε νέο έτος καταχωρίζεται σε δύο εγγραφές.');
    }
    const overlap = await this.prisma.payrollLeave.findFirst({
      where: { employeeId: employee.id, dateFrom: { lte: dateTo }, dateTo: { gte: dateFrom } },
    });
    if (overlap) throw new BadRequestException('Υπάρχει ήδη άδεια που επικαλύπτει το διάστημα.');
    if (dto.type === PayrollLeaveType.ANNUAL) {
      const contract = employee.contracts[0];
      if (!contract) throw new BadRequestException('Δεν υπάρχει σύμβαση για υπολογισμό άδειας.');
      const entitlement = annualLeaveEntitlement({
        employmentStart: contract.startDate,
        fiscalYear: dateFrom.getUTCFullYear(),
        weeklySystem: contract.weeklySystem,
        recognizedPriorServiceYears: employee.recognizedPriorServiceYears,
      });
      const aggregate = await this.prisma.payrollLeave.aggregate({
        where: { employeeId: employee.id, fiscalYear: dateFrom.getUTCFullYear(), type: PayrollLeaveType.ANNUAL },
        _sum: { workingDays: true },
      });
      if (Number(aggregate._sum.workingDays ?? 0) + dto.workingDays > entitlement) {
        throw new BadRequestException(`Οι ημέρες υπερβαίνουν το δικαίωμα ${entitlement} ημερών.`);
      }
    }
    if (dto.type === PayrollLeaveType.PATERNITY && dto.workingDays > 14) {
      throw new BadRequestException('Η άδεια πατρότητας δεν μπορεί να υπερβαίνει τις 14 εργάσιμες ημέρες.');
    }
    const paymentSource =
      dto.paymentSource ??
      (dto.type === PayrollLeaveType.UNPAID
        ? PayrollLeavePaymentSource.UNPAID
        : dto.type === PayrollLeaveType.SPECIAL_MATERNITY_PROTECTION ||
            dto.type === PayrollLeaveType.PARENTAL
          ? PayrollLeavePaymentSource.DYPA
          : dto.type === PayrollLeaveType.MATERNITY
            ? PayrollLeavePaymentSource.E_EFKA_DYPA
            : PayrollLeavePaymentSource.EMPLOYER);
    if (
      dto.type === PayrollLeaveType.PATERNITY &&
      paymentSource !== PayrollLeavePaymentSource.EMPLOYER
    ) {
      throw new BadRequestException('Η άδεια πατρότητας είναι άδεια με αποδοχές από τον εργοδότη.');
    }
    if (
      dto.type === PayrollLeaveType.SPECIAL_MATERNITY_PROTECTION &&
      paymentSource !== PayrollLeavePaymentSource.DYPA
    ) {
      throw new BadRequestException('Η ειδική άδεια προστασίας μητρότητας καταβάλλεται από τη ΔΥΠΑ.');
    }
    if (
      dto.type === PayrollLeaveType.PARENTAL &&
      paymentSource !== PayrollLeavePaymentSource.DYPA &&
      paymentSource !== PayrollLeavePaymentSource.UNPAID
    ) {
      throw new BadRequestException(
        'Η γονική άδεια καταχωρίζεται χωριστά για το επιδοτούμενο τμήμα ΔΥΠΑ και το άνευ αποδοχών τμήμα.',
      );
    }
    if (
      dto.employerGrossAmount &&
      paymentSource !== PayrollLeavePaymentSource.EMPLOYER &&
      paymentSource !== PayrollLeavePaymentSource.MIXED
    ) {
      throw new BadRequestException(
        'Εργοδοτικές αποδοχές επιτρέπονται μόνο όταν πηγή πληρωμής είναι ο εργοδότης ή μικτή.',
      );
    }
    const leave = await this.prisma.payrollLeave.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: employee.clientCompanyId,
        employeeId: employee.id,
        fiscalYear: dateFrom.getUTCFullYear(),
        type: dto.type,
        dateFrom,
        dateTo,
        workingDays: dto.workingDays,
        paid:
          dto.paid ??
          (paymentSource === PayrollLeavePaymentSource.EMPLOYER ||
            paymentSource === PayrollLeavePaymentSource.MIXED),
        paymentSource,
        employerGrossAmount: dto.employerGrossAmount ?? 0,
        employeeRequestReference: dto.employeeRequestReference,
        externalBenefitReference: dto.externalBenefitReference,
        erganiProtocol: dto.erganiProtocol,
        erganiSubmittedAt: dto.erganiSubmittedAt
          ? new Date(dto.erganiSubmittedAt)
          : undefined,
        notes: dto.notes,
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });
    await this.recordAudit(tenant, AuditAction.CREATE, 'PayrollLeave', leave.id, undefined, leave);
    return leave;
  }

  async deleteLeave(tenant: TenantContext, id: string) {
    const leave = await this.prisma.payrollLeave.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!leave) throw new NotFoundException('Η εγγραφή άδειας δεν βρέθηκε.');
    if (leave.payrollEventId) {
      throw new BadRequestException(
        'Η αναρρωτική απουσία διαγράφεται από τις ειδικές αποδοχές ώστε να ενημερωθεί μαζί και η ΑΠΔ.',
      );
    }
    await this.prisma.payrollLeave.delete({ where: { id } });
    await this.recordAudit(tenant, AuditAction.DELETE, 'PayrollLeave', id, leave, undefined);
    return { deleted: true };
  }

  async createTermination(
    tenant: TenantContext,
    dto: CreatePayrollTerminationDto,
  ) {
    const terminationDate = utcDate(dto.terminationDate);
    const contract = await this.prisma.payrollContract.findFirst({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        employeeId: dto.employeeId,
        startDate: { lte: terminationDate },
        OR: [{ endDate: null }, { endDate: { gte: terminationDate } }],
      },
      include: { employee: true },
      orderBy: { startDate: 'desc' },
    });
    if (!contract) {
      throw new BadRequestException(
        'Δεν υπάρχει ενεργή σύμβαση του εργαζομένου κατά την ημερομηνία λύσης.',
      );
    }
    const existing = await this.prisma.payrollTermination.findUnique({
      where: { contractId: contract.id },
    });
    if (existing) {
      throw new BadRequestException('Υπάρχει ήδη διαδικασία λύσης για αυτή τη σύμβαση.');
    }

    const calculation = calculateTerminationSeverance({
      employmentStart: contract.startDate,
      terminationDate,
      type: dto.type,
      withNotice: dto.withNotice ?? false,
      regularMonthlyEarnings: dto.regularMonthlyEarnings,
    });
    if (
      dto.type === PayrollTerminationType.EMPLOYER_DISMISSAL &&
      dto.regularMonthlyEarnings <= 0
    ) {
      throw new BadRequestException(
        'Για απόλυση απαιτούνται οι τακτικές μικτές αποδοχές πλήρους απασχόλησης του τελευταίου μήνα.',
      );
    }
    if (
      dto.type === PayrollTerminationType.EMPLOYER_DISMISSAL &&
      dto.severanceAmount !== undefined &&
      dto.severanceAmount < calculation.statutorySeverance
    ) {
      throw new BadRequestException(
        `Η τελική αποζημίωση δεν μπορεί να είναι μικρότερη από τη νόμιμη (${calculation.statutorySeverance.toFixed(2)} €).`,
      );
    }
    const severanceAmount = dto.severanceAmount ?? calculation.statutorySeverance;
    const details = {
      ...calculation.details,
      manualOverride: dto.severanceAmount !== undefined,
      enteredSeveranceAmount: severanceAmount,
    };
    const termination = await this.prisma.payrollTermination.create({
      data: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: contract.clientCompanyId,
        employeeId: contract.employeeId,
        contractId: contract.id,
        type: dto.type,
        terminationDate,
        withNotice: dto.type === PayrollTerminationType.EMPLOYER_DISMISSAL
          ? dto.withNotice ?? false
          : false,
        noticeMonths: calculation.noticeMonths,
        completedServiceYears: calculation.completedServiceYears,
        regularMonthlyEarnings: dto.regularMonthlyEarnings,
        severanceMonths: calculation.severanceMonths,
        statutorySeverance: calculation.statutorySeverance,
        severanceAmount,
        calculationDetails: details,
        notes: dto.notes,
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        contract: { select: { id: true, startDate: true, endDate: true } },
      },
    });
    await this.recordAudit(
      tenant,
      AuditAction.CREATE,
      'PayrollTermination',
      termination.id,
      undefined,
      termination,
    );
    return termination;
  }

  async completeTermination(
    tenant: TenantContext,
    id: string,
    dto: CompletePayrollTerminationDto,
  ) {
    const oldValue = await this.prisma.payrollTermination.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!oldValue) throw new NotFoundException('Η διαδικασία λύσης σύμβασης δεν βρέθηκε.');
    if (oldValue.status === PayrollTerminationStatus.COMPLETED) {
      throw new BadRequestException('Η διαδικασία λύσης έχει ήδη ολοκληρωθεί.');
    }
    if (Number(oldValue.severanceAmount) > 0 && (!dto.paymentDate || !dto.paymentReference)) {
      throw new BadRequestException(
        'Για αποζημίωση απαιτούνται ημερομηνία και τραπεζικό αποδεικτικό πληρωμής.',
      );
    }

    const completed = await this.prisma.$transaction(async (transaction) => {
      const termination = await transaction.payrollTermination.update({
        where: { id },
        data: {
          status: PayrollTerminationStatus.COMPLETED,
          erganiProtocol: dto.erganiProtocol.trim(),
          erganiSubmittedAt: new Date(dto.erganiSubmittedAt),
          paymentDate: dto.paymentDate ? utcDate(dto.paymentDate) : undefined,
          paymentReference: dto.paymentReference?.trim(),
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
          contract: { select: { id: true, startDate: true, endDate: true } },
        },
      });
      await transaction.payrollContract.update({
        where: { id: oldValue.contractId },
        data: { endDate: oldValue.terminationDate },
      });
      const otherActiveContracts = await transaction.payrollContract.count({
        where: {
          employeeId: oldValue.employeeId,
          id: { not: oldValue.contractId },
          startDate: { lte: oldValue.terminationDate },
          OR: [{ endDate: null }, { endDate: { gt: oldValue.terminationDate } }],
        },
      });
      if (otherActiveContracts === 0) {
        await transaction.payrollEmployee.update({
          where: { id: oldValue.employeeId },
          data: { status: 'INACTIVE' },
        });
      }
      return termination;
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollTermination',
      id,
      oldValue,
      completed,
    );
    return completed;
  }

  async deleteTermination(tenant: TenantContext, id: string) {
    const termination = await this.prisma.payrollTermination.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
    });
    if (!termination) throw new NotFoundException('Η διαδικασία λύσης σύμβασης δεν βρέθηκε.');
    if (termination.status !== PayrollTerminationStatus.DRAFT) {
      throw new BadRequestException('Ολοκληρωμένη λύση σύμβασης δεν διαγράφεται.');
    }
    await this.prisma.payrollTermination.delete({ where: { id } });
    await this.recordAudit(
      tenant,
      AuditAction.DELETE,
      'PayrollTermination',
      id,
      termination,
      undefined,
    );
    return { deleted: true };
  }

  async calculate(tenant: TenantContext, dto: CalculatePayrollPeriodDto) {
    const company = await this.ensureTenantCompany(tenant, dto.clientCompanyId);
    const declarationType = dto.declarationType ?? ApdDeclarationType.NORMAL;
    const periodStart = new Date(Date.UTC(dto.periodYear, dto.periodMonth - 1, 1));
    const periodEnd = new Date(Date.UTC(dto.periodYear, dto.periodMonth, 0));
    const overrides = new Map((dto.overrides ?? []).map((value) => [value.employeeId, value]));

    const contracts = await this.prisma.payrollContract.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        startDate: { lte: periodEnd },
        OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
      },
      include: { employee: true },
      orderBy: { startDate: 'desc' },
    });
    if (contracts.length === 0) {
      throw new BadRequestException('Δεν υπάρχουν ενεργές συμβάσεις για την επιλεγμένη περίοδο.');
    }
    await this.ensureNoPendingErganiDeclarations(
      tenant,
      dto.clientCompanyId,
      contracts.map((contract) => contract.id),
      periodEnd,
    );
    const events = await this.prisma.payrollEvent.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
      },
      include: { employee: true, contract: true },
    });
    const leaves = await this.prisma.payrollLeave.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        dateFrom: { lte: periodEnd },
        dateTo: { gte: periodStart },
      },
    });
    const pendingSickness = events.find(
      (event) =>
        event.type === PayrollEventType.SICKNESS &&
        event.sicknessBenefitStatus === PayrollSicknessBenefitStatus.PENDING,
    );
    if (pendingSickness) {
      throw new BadRequestException(
        `${pendingSickness.employee.lastName} ${pendingSickness.employee.firstName}: εκκρεμεί η απόφαση επιδόματος ασθενείας e-ΕΦΚΑ. Ενημερώστε την αναρρωτική απουσία πριν τον υπολογισμό.`,
      );
    }

    const byEmployee = new Map<string, (typeof contracts)[number]>();
    contracts.forEach((contract) => {
      if (!byEmployee.has(contract.employeeId)) byEmployee.set(contract.employeeId, contract);
    });

    const regularEntryData = [...byEmployee.values()].map((contract) => {
      const override = overrides.get(contract.employeeId);
      const sicknessInsuranceDays = events
        .filter(
          (event) =>
            event.employeeId === contract.employeeId &&
            event.type === PayrollEventType.SICKNESS,
        )
        .reduce((total, event) => total + event.insuranceDays, 0);
      const employeeLeaves = leaves.filter((leave) => leave.employeeId === contract.employeeId);
      const externallyPaidLeaveDays = roundMoney(
        employeeLeaves
          .filter(
            (leave) =>
              leave.paymentSource !== PayrollLeavePaymentSource.EMPLOYER &&
              leave.type !== PayrollLeaveType.SICK,
          )
          .reduce(
            (total, leave) =>
              total +
              allocatedLeaveDays(
                leave,
                periodStart,
                periodEnd,
                contract.workWeekdays,
              ),
            0,
          ),
      );
      const leaveEmployerGross = roundMoney(
        employeeLeaves.reduce(
          (total, leave) =>
            total +
            allocateLeaveAmount(
              leave,
              periodStart,
              periodEnd,
              contract.workWeekdays,
            ),
          0,
        ),
      );
      if (sicknessInsuranceDays > 25) {
        throw new BadRequestException(
          `${contract.employee.lastName} ${contract.employee.firstName}: οι ημέρες ασθένειας ΑΠΔ 008 υπερβαίνουν τις 25.`,
        );
      }
      const employmentFrom = contract.startDate > periodStart ? contract.startDate : periodStart;
      const employmentTo =
        contract.endDate && contract.endDate < periodEnd ? contract.endDate : periodEnd;
      const requiresActualDays =
        contract.compensationType === PayrollCompensationType.DAILY ||
        employmentFrom.getTime() !== periodStart.getTime() ||
        employmentTo.getTime() !== periodEnd.getTime();
      if (requiresActualDays && override?.insuranceDays === undefined) {
        throw new BadRequestException(
          `${contract.employee.lastName} ${contract.employee.firstName}: συμπληρώστε τις πραγματικές ημέρες ασφάλισης (ημερομίσθιος ή μη πλήρης μήνας).`,
        );
      }
      const automaticInsuranceDays = Math.max(
        0,
        25 - sicknessInsuranceDays - Math.ceil(externallyPaidLeaveDays),
      );
      const insuranceDays = override?.insuranceDays ?? automaticInsuranceDays;
      const minimums = minimumWage2026(dto.periodMonth);
      const configuredMonthly = Number(contract.monthlySalary ?? 0);
      const configuredDaily = Number(contract.dailyWage ?? 0);
      const contractualMinimum =
        minimums.monthly * (contract.fullTime ? 1 : Number(contract.weeklyHours) / 40);
      const dailyMinimum =
        minimums.daily *
        dailyWorkRatio(
          contract.fullTime,
          Number(contract.weeklyHours),
          contract.workDaysPerWeek,
          contract.weeklySystem,
        );

      if (
        contract.compensationType === PayrollCompensationType.MONTHLY &&
        configuredMonthly < contractualMinimum
      ) {
        throw new BadRequestException(
          `${contract.employee.lastName} ${contract.employee.firstName}: ο μισθός ${configuredMonthly.toFixed(2)}€ είναι κάτω από το ελάχιστο ${roundMoney(contractualMinimum).toFixed(2)}€ της περιόδου.`,
        );
      }
      if (
        contract.compensationType === PayrollCompensationType.DAILY &&
        configuredDaily < dailyMinimum
      ) {
        throw new BadRequestException(
          `${contract.employee.lastName} ${contract.employee.firstName}: το ημερομίσθιο ${configuredDaily.toFixed(2)}€ είναι κάτω από το ελάχιστο ${roundMoney(dailyMinimum).toFixed(2)}€ της περιόδου.`,
        );
      }

      const payableDays = Math.max(
        0,
        override?.insuranceDays ?? automaticInsuranceDays,
      );
      const baseGross = roundMoney(
        contract.compensationType === PayrollCompensationType.MONTHLY
          ? (configuredMonthly * payableDays) / 25
          : configuredDaily * payableDays,
      );
      if (contract.fullTime && Number(override?.partTimeAdditionalHours ?? 0) > 0) {
        throw new BadRequestException(
          `${contract.employee.lastName} ${contract.employee.firstName}: πρόσθετη εργασία 12% επιτρέπεται μόνο σε μερική απασχόληση.`,
        );
      }
      if (
        !contract.fullTime &&
        (Number(override?.extraWorkHours ?? 0) > 0 ||
          Number(override?.legalOvertimeHours ?? 0) > 0 ||
          Number(override?.approvedOvertimeHours ?? 0) > 0 ||
          Number(override?.illegalOvertimeHours ?? 0) > 0)
      ) {
        throw new BadRequestException(
          `${contract.employee.lastName} ${contract.employee.firstName}: σε μερική απασχόληση περάστε πρώτα την πρόσθετη εργασία 12% μέχρι το πλήρες ωράριο.`,
        );
      }
      const workPremiums = calculateWorkPremiums({
        compensationType: contract.compensationType,
        contractualMonthlySalary: configuredMonthly,
        contractualDailyWage: configuredDaily,
        statutoryMonthlySalary:
          Number(contract.statutoryMonthlySalary ?? 0) || contractualMinimum,
        statutoryDailyWage: Number(contract.statutoryDailyWage ?? 0) || dailyMinimum,
        fullTime: contract.fullTime,
        nightHours: override?.nightHours,
        sundayHolidayHours: override?.sundayHolidayHours,
        extraWorkHours: override?.extraWorkHours,
        legalOvertimeHours: override?.legalOvertimeHours,
        approvedOvertimeHours: override?.approvedOvertimeHours,
        illegalOvertimeHours: override?.illegalOvertimeHours,
        partTimeAdditionalHours: override?.partTimeAdditionalHours,
      });
      const overtimeGross = roundMoney(
        (override?.overtimeGross ?? 0) +
          workPremiums.extraWorkGross +
          workPremiums.legalOvertimeGross +
          workPremiums.approvedOvertimeGross +
          workPremiums.illegalOvertimeGross +
          workPremiums.partTimeExtraGross,
      );
      const bonusGross = roundMoney(override?.bonusGross ?? 0);
      const otherGross = roundMoney(override?.otherGross ?? 0);
      const otherDeductions = roundMoney(override?.otherDeductions ?? 0);
      const grossEarnings = roundMoney(
        baseGross +
          overtimeGross +
          workPremiums.nightPremiumGross +
          workPremiums.sundayHolidayGross +
          leaveEmployerGross +
          bonusGross +
          otherGross,
      );
      const contributionExempt = workPremiums.contributionExempt;
      const contributionBase = roundMoney(grossEarnings - contributionExempt);
      const employeeContributions = roundMoney(
        (contributionBase * Number(contract.employeeContributionRate)) / 100,
      );
      const employerContributions = roundMoney(
        (contributionBase * Number(contract.employerContributionRate)) / 100,
      );
      const taxableEarnings = roundMoney(grossEarnings - employeeContributions);
      const age = ageAt(contract.employee.birthDate, periodEnd);
      const withholdingTax = calculateMonthlyWithholdingTax2026({
        monthlyTaxableEarnings: taxableEarnings,
        age,
        dependentChildren: contract.employee.dependentChildren,
      });
      const netPayable = roundMoney(
        grossEarnings - employeeContributions - withholdingTax - otherDeductions,
      );
      if (netPayable < 0) {
        throw new BadRequestException(
          `${contract.employee.lastName} ${contract.employee.firstName}: οι κρατήσεις υπερβαίνουν τις αποδοχές.`,
        );
      }

      return {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        employeeId: contract.employeeId,
        contractId: contract.id,
        entryKey: `REGULAR:${override?.apdEarningsType ?? '001'}`,
        employmentFrom,
        employmentTo,
        insuranceDays,
        apdEarningsType: override?.apdEarningsType ?? '001',
        baseGross,
        overtimeGross,
        nightPremiumGross: workPremiums.nightPremiumGross,
        sundayHolidayGross: workPremiums.sundayHolidayGross,
        extraWorkGross: workPremiums.extraWorkGross,
        legalOvertimeGross: workPremiums.legalOvertimeGross,
        approvedOvertimeGross: workPremiums.approvedOvertimeGross,
        illegalOvertimeGross: workPremiums.illegalOvertimeGross,
        partTimeExtraGross: workPremiums.partTimeExtraGross,
        leaveEmployerGross,
        bonusGross,
        otherGross,
        grossEarnings,
        contributionBase,
        contributionExempt,
        employeeContributions,
        employerContributions,
        taxableEarnings,
        withholdingTax,
        otherDeductions,
        netPayable,
        calculationSnapshot: {
          rulesVersion: 'GR-PAYROLL-2026.3',
          calculatedAt: new Date().toISOString(),
          age,
          dependentChildren: contract.employee.dependentChildren,
          minimumMonthly: minimums.monthly,
          minimumDaily: minimums.daily,
          employeeContributionRate: Number(contract.employeeContributionRate),
          employerContributionRate: Number(contract.employerContributionRate),
          sicknessInsuranceDays,
          externallyPaidLeaveDays,
          payableDays,
          workPremiums: {
            nightHours: override?.nightHours ?? 0,
            sundayHolidayHours: override?.sundayHolidayHours ?? 0,
            extraWorkHours: override?.extraWorkHours ?? 0,
            legalOvertimeHours: override?.legalOvertimeHours ?? 0,
            approvedOvertimeHours: override?.approvedOvertimeHours ?? 0,
            illegalOvertimeHours: override?.illegalOvertimeHours ?? 0,
            partTimeAdditionalHours: override?.partTimeAdditionalHours ?? 0,
            contractualHourlyRate: workPremiums.contractualHourlyRate,
            statutoryHourlyRate: workPremiums.statutoryHourlyRate,
            overtimeErganiProtocol: override?.overtimeErganiProtocol ?? null,
            contributionExemption:
              contract.fullTime && contributionExempt > 0
                ? 'ART-41-N5184-2025-ART-73-N5239-2025'
                : null,
          },
          taxMethod: 'AADE-2026-ANNUALIZED-14',
        } satisfies Prisma.InputJsonObject,
      };
    });

    const regularByEmployee = new Map(
      regularEntryData.map((entry) => [entry.employeeId, entry]),
    );
    const eventEntryData = events.map((event) => {
      const grossEarnings = roundMoney(Number(event.grossAmount));
      const employeeContributions = roundMoney(
        (grossEarnings * Number(event.contract.employeeContributionRate)) / 100,
      );
      const employerContributions = roundMoney(
        (grossEarnings * Number(event.contract.employerContributionRate)) / 100,
      );
      const taxableEarnings = roundMoney(grossEarnings - employeeContributions);
      const regular = regularByEmployee.get(event.employeeId);
      const periodAge = ageAt(event.employee.birthDate, periodEnd);
      const nominalGross =
        event.contract.compensationType === PayrollCompensationType.MONTHLY
          ? Number(event.contract.monthlySalary)
          : Number(event.contract.dailyWage) * 25;
      const nominalEmployeeContributions = roundMoney(
        (nominalGross * Number(event.contract.employeeContributionRate)) / 100,
      );
      const taxBase = regular?.taxableEarnings ??
        roundMoney(nominalGross - nominalEmployeeContributions);
      const regularTax = regular?.withholdingTax ??
        calculateMonthlyWithholdingTax2026({
          monthlyTaxableEarnings: taxBase,
          age: periodAge,
          dependentChildren: event.employee.dependentChildren,
        });
      const effectiveRate = taxBase > 0 ? regularTax / taxBase : 0;
      const withholdingTax = roundMoney(taxableEarnings * effectiveRate);
      const netPayable = roundMoney(
        grossEarnings - employeeContributions - withholdingTax,
      );
      return {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: dto.clientCompanyId,
        employeeId: event.employeeId,
        contractId: event.contractId,
        payrollEventId: event.id,
        entryKey: `EVENT:${event.id}`,
        employmentFrom: event.dateFrom ?? periodStart,
        employmentTo: event.dateTo ?? periodEnd,
        insuranceDays: event.insuranceDays,
        apdEarningsType: apdEarningsType(event.type),
        baseGross: 0,
        overtimeGross:
          event.type === PayrollEventType.OVERTIME ? grossEarnings : 0,
        nightPremiumGross: 0,
        sundayHolidayGross: 0,
        extraWorkGross: 0,
        legalOvertimeGross: 0,
        approvedOvertimeGross: 0,
        illegalOvertimeGross: 0,
        partTimeExtraGross: 0,
        leaveEmployerGross: 0,
        bonusGross: event.type === PayrollEventType.BONUS ? grossEarnings : 0,
        otherGross:
          event.type !== PayrollEventType.OVERTIME &&
          event.type !== PayrollEventType.BONUS
            ? grossEarnings
            : 0,
        grossEarnings,
        contributionBase: grossEarnings,
        contributionExempt: 0,
        employeeContributions,
        employerContributions,
        taxableEarnings,
        withholdingTax,
        otherDeductions: 0,
        netPayable,
        calculationSnapshot: {
          rulesVersion: 'GR-PAYROLL-2026.2',
          eventType: event.type,
          payrollEventId: event.id,
          eventCalculationDetails: event.calculationDetails,
          effectiveWithholdingRate: effectiveRate,
        } satisfies Prisma.InputJsonObject,
      };
    });
    const entryData = [
      ...regularEntryData.filter(
        (entry) => entry.insuranceDays > 0 || entry.grossEarnings > 0,
      ),
      ...eventEntryData,
    ];

    const totals = {
      totalGross: sum(entryData, 'grossEarnings'),
      totalEmployeeContributions: sum(entryData, 'employeeContributions'),
      totalEmployerContributions: sum(entryData, 'employerContributions'),
      totalWithholdingTax: sum(entryData, 'withholdingTax'),
      totalNet: sum(entryData, 'netPayable'),
      tekaContributionAmount: roundMoney(
        entryData.reduce((total, entry) => {
          const contract = byEmployee.get(entry.employeeId);
          return total + (contract?.employee.tekaInsured ? entry.contributionBase * 0.06 : 0);
        }, 0),
      ),
    };
    const complianceDeadlines = payrollComplianceDeadlines(
      dto.periodYear,
      dto.periodMonth,
    );

    const oldPeriod = await this.prisma.payrollPeriod.findUnique({
      where: {
        clientCompanyId_periodYear_periodMonth_declarationType: {
          clientCompanyId: dto.clientCompanyId,
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
          declarationType,
        },
      },
      include: PERIOD_INCLUDE,
    });
    if (
      oldPeriod &&
      oldPeriod.status !== PayrollPeriodStatus.DRAFT &&
      oldPeriod.status !== PayrollPeriodStatus.CALCULATED
    ) {
      throw new BadRequestException('Εγκεκριμένη ή πληρωμένη μισθοδοσία δεν επανυπολογίζεται.');
    }

    const period = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.payrollPeriod.upsert({
        where: {
          clientCompanyId_periodYear_periodMonth_declarationType: {
            clientCompanyId: dto.clientCompanyId,
            periodYear: dto.periodYear,
            periodMonth: dto.periodMonth,
            declarationType,
          },
        },
        create: {
          accountingOfficeId: tenant.accountingOfficeId,
          clientCompanyId: dto.clientCompanyId,
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
          declarationType,
          status: PayrollPeriodStatus.CALCULATED,
          ...totals,
          ...complianceDeadlines,
          calculatedAt: new Date(),
          notes: dto.notes,
        },
        update: {
          status: PayrollPeriodStatus.CALCULATED,
          ...totals,
          apdSubmissionDeadline:
            oldPeriod?.apdSubmissionDeadline ??
            complianceDeadlines.apdSubmissionDeadline,
          contributionsPaymentDeadline:
            oldPeriod?.contributionsPaymentDeadline ??
            complianceDeadlines.contributionsPaymentDeadline,
          fmySubmissionDeadline:
            oldPeriod?.fmySubmissionDeadline ??
            complianceDeadlines.fmySubmissionDeadline,
          calculatedAt: new Date(),
          notes: dto.notes,
        },
      });
      await tx.payrollEntry.deleteMany({ where: { payrollPeriodId: saved.id } });
      await tx.payrollEntry.createMany({
        data: entryData.map((entry) => ({ ...entry, payrollPeriodId: saved.id })),
      });
      return tx.payrollPeriod.findUniqueOrThrow({
        where: { id: saved.id },
        include: PERIOD_INCLUDE,
      });
    });

    await this.recordAudit(
      tenant,
      oldPeriod ? AuditAction.UPDATE : AuditAction.CREATE,
      'PayrollPeriod',
      period.id,
      oldPeriod,
      period,
    );
    return { ...period, company };
  }

  async approve(tenant: TenantContext, id: string) {
    const existing = await this.findPeriod(tenant, id);
    if (existing.status !== PayrollPeriodStatus.CALCULATED) {
      throw new BadRequestException('Μόνο υπολογισμένη μισθοδοσία μπορεί να εγκριθεί.');
    }
    await this.ensureNoPendingErganiDeclarations(
      tenant,
      existing.clientCompanyId,
      [...new Set(existing.entries.map((entry) => entry.contractId))],
      new Date(Date.UTC(existing.periodYear, existing.periodMonth, 0)),
    );
    const overtimeWithoutProtocol = existing.entries.find((entry) => {
      if (
        Number(entry.legalOvertimeGross) <= 0 &&
        Number(entry.approvedOvertimeGross) <= 0
      ) {
        return false;
      }
      const snapshot = entry.calculationSnapshot as Record<string, unknown>;
      const workPremiums = snapshot['workPremiums'] as Record<string, unknown> | undefined;
      return !String(workPremiums?.['overtimeErganiProtocol'] ?? '').trim();
    });
    if (overtimeWithoutProtocol) {
      throw new BadRequestException(
        `${overtimeWithoutProtocol.employee.lastName} ${overtimeWithoutProtocol.employee.firstName}: λείπει το πραγματικό πρωτόκολλο δήλωσης υπερωρίας στο ΕΡΓΑΝΗ ΙΙ.`,
      );
    }
    const periodStart = new Date(
      Date.UTC(existing.periodYear, existing.periodMonth - 1, 1),
    );
    const periodEnd = new Date(Date.UTC(existing.periodYear, existing.periodMonth, 0));
    const familyLeaves = await this.prisma.payrollLeave.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: existing.clientCompanyId,
        dateFrom: { lte: periodEnd },
        dateTo: { gte: periodStart },
        type: {
          in: [
            PayrollLeaveType.MATERNITY,
            PayrollLeaveType.SPECIAL_MATERNITY_PROTECTION,
            PayrollLeaveType.PATERNITY,
            PayrollLeaveType.PARENTAL,
          ],
        },
      },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });
    const incompleteLeave = familyLeaves.find((leave) => {
      if (!leave.employeeRequestReference) return true;
      if (
        leave.type === PayrollLeaveType.PARENTAL &&
        (!leave.erganiProtocol || !leave.erganiSubmittedAt)
      ) {
        return true;
      }
      return (
        leave.paymentSource !== PayrollLeavePaymentSource.EMPLOYER &&
        !leave.externalBenefitReference
      );
    });
    if (incompleteLeave) {
      throw new BadRequestException(
        `${incompleteLeave.employee.lastName} ${incompleteLeave.employee.firstName}: η οικογενειακή άδεια δεν έχει πλήρη αίτηση, πρωτόκολλο ΕΡΓΑΝΗ όπου απαιτείται και αναφορά εξωτερικής παροχής.`,
      );
    }
    if (!tenant.userId) throw new BadRequestException('Απαιτείται συνδεδεμένος χρήστης.');
    const updated = await this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        status: PayrollPeriodStatus.APPROVED,
        approvedById: tenant.userId,
        approvedAt: new Date(),
      },
      include: PERIOD_INCLUDE,
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollPeriod',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async markPaid(tenant: TenantContext, id: string, dto: MarkPayrollPaidDto) {
    const existing = await this.findPeriod(tenant, id);
    if (existing.status !== PayrollPeriodStatus.APPROVED) {
      throw new BadRequestException('Μόνο εγκεκριμένη μισθοδοσία μπορεί να σημειωθεί ως πληρωμένη.');
    }
    const paymentDate = utcDate(dto.paymentDate);
    const automaticPeriodDeadline = payrollComplianceDeadlines(
      existing.periodYear,
      existing.periodMonth,
    ).fmySubmissionDeadline;
    const keepManualFmyDeadline =
      existing.fmySubmissionDeadline &&
      existing.fmySubmissionDeadline.getTime() !==
        automaticPeriodDeadline.getTime();
    const updated = await this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        status: PayrollPeriodStatus.PAID,
        paidAt: new Date(),
        paymentDate,
        fmySubmissionDeadline: keepManualFmyDeadline
          ? existing.fmySubmissionDeadline
          : fmyDeadlineForPaymentDate(paymentDate),
      },
      include: PERIOD_INCLUDE,
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollPeriod',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async updateComplianceDeadlines(
    tenant: TenantContext,
    id: string,
    dto: UpdatePayrollComplianceDeadlinesDto,
  ) {
    const existing = await this.findPeriod(tenant, id);
    if (
      !dto.apdSubmissionDeadline &&
      !dto.contributionsPaymentDeadline &&
      !dto.fmySubmissionDeadline
    ) {
      throw new BadRequestException('Δώστε τουλάχιστον μία προθεσμία.');
    }
    const apdSubmissionDeadline = dto.apdSubmissionDeadline
      ? complianceDeadline(dto.apdSubmissionDeadline)
      : existing.apdSubmissionDeadline;
    const contributionsPaymentDeadline = dto.contributionsPaymentDeadline
      ? complianceDeadline(dto.contributionsPaymentDeadline)
      : existing.contributionsPaymentDeadline;
    const fmySubmissionDeadline = dto.fmySubmissionDeadline
      ? complianceDeadline(dto.fmySubmissionDeadline)
      : existing.fmySubmissionDeadline;
    const updated = await this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        apdSubmissionDeadline,
        contributionsPaymentDeadline,
        fmySubmissionDeadline,
        apdLateSubmission:
          existing.apdSubmittedAt && apdSubmissionDeadline
            ? isComplianceLate(existing.apdSubmittedAt, apdSubmissionDeadline)
            : false,
        tekaLateSubmission:
          existing.tekaSubmittedAt && apdSubmissionDeadline
            ? isComplianceLate(existing.tekaSubmittedAt, apdSubmissionDeadline)
            : false,
        contributionsLatePayment:
          existing.contributionsPaymentDate && contributionsPaymentDeadline
            ? isComplianceLate(
                existing.contributionsPaymentDate,
                contributionsPaymentDeadline,
              )
            : false,
        tekaLatePayment:
          existing.tekaPaymentDate && contributionsPaymentDeadline
            ? isComplianceLate(
                existing.tekaPaymentDate,
                contributionsPaymentDeadline,
              )
            : false,
        fmyLateSubmission:
          existing.fmySubmittedAt && fmySubmissionDeadline
            ? isComplianceLate(existing.fmySubmittedAt, fmySubmissionDeadline)
            : false,
        fmyLatePayment:
          existing.fmyPaymentDate && fmySubmissionDeadline
            ? isComplianceLate(existing.fmyPaymentDate, fmySubmissionDeadline)
            : false,
      },
      include: PERIOD_INCLUDE,
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollPeriodCompliance',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async completeApdSubmission(
    tenant: TenantContext,
    id: string,
    dto: CompleteApdSubmissionDto,
  ) {
    const existing = await this.findApprovedPeriod(tenant, id);
    if (!existing.apdSubmissionDeadline) {
      throw new BadRequestException('Δεν έχει οριστεί προθεσμία υποβολής ΑΠΔ.');
    }
    const submittedAt = new Date(dto.submittedAt);
    const updated = await this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        apdProtocol: dto.protocol.trim(),
        apdSubmittedAt: submittedAt,
        apdLateSubmission: isComplianceLate(
          submittedAt,
          existing.apdSubmissionDeadline,
        ),
      },
      include: PERIOD_INCLUDE,
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollPeriodApdSubmission',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async markContributionsPaid(
    tenant: TenantContext,
    id: string,
    dto: MarkContributionsPaidDto,
  ) {
    const existing = await this.findApprovedPeriod(tenant, id);
    if (!existing.contributionsPaymentDeadline) {
      throw new BadRequestException('Δεν έχει οριστεί προθεσμία πληρωμής εισφορών.');
    }
    const paymentDate = utcDate(dto.paymentDate);
    const updated = await this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        contributionsPaidAt: new Date(),
        contributionsPaymentDate: paymentDate,
        contributionsPaymentReference: dto.paymentReference.trim(),
        contributionsLatePayment: isComplianceLate(
          paymentDate,
          existing.contributionsPaymentDeadline,
        ),
      },
      include: PERIOD_INCLUDE,
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollPeriodContributionsPayment',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async completeTekaSubmission(
    tenant: TenantContext,
    id: string,
    dto: CompleteApdSubmissionDto,
  ) {
    const existing = await this.findApprovedPeriod(tenant, id);
    if (Number(existing.tekaContributionAmount) <= 0) {
      throw new BadRequestException(
        'Η περίοδος δεν περιλαμβάνει εργαζόμενο υπαγόμενο στο ΤΕΚΑ.',
      );
    }
    if (!existing.apdSubmittedAt) {
      throw new BadRequestException(
        'Η ΑΠΔ ΤΕΚΑ υποβάλλεται μετά την επιτυχή ΑΠΔ e-ΕΦΚΑ.',
      );
    }
    if (!existing.apdSubmissionDeadline) {
      throw new BadRequestException('Δεν έχει οριστεί προθεσμία υποβολής ΑΠΔ.');
    }
    const submittedAt = new Date(dto.submittedAt);
    const updated = await this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        tekaProtocol: dto.protocol.trim(),
        tekaSubmittedAt: submittedAt,
        tekaLateSubmission: isComplianceLate(
          submittedAt,
          existing.apdSubmissionDeadline,
        ),
      },
      include: PERIOD_INCLUDE,
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollPeriodTekaSubmission',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async markTekaPaid(
    tenant: TenantContext,
    id: string,
    dto: MarkContributionsPaidDto,
  ) {
    const existing = await this.findApprovedPeriod(tenant, id);
    if (!existing.tekaSubmittedAt) {
      throw new BadRequestException('Καταχωρίστε πρώτα την επιτυχή ΑΠΔ ΤΕΚΑ.');
    }
    if (!existing.contributionsPaymentDeadline) {
      throw new BadRequestException('Δεν έχει οριστεί προθεσμία πληρωμής εισφορών.');
    }
    const paymentDate = utcDate(dto.paymentDate);
    const updated = await this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        tekaPaymentDate: paymentDate,
        tekaPaymentReference: dto.paymentReference.trim(),
        tekaLatePayment: isComplianceLate(
          paymentDate,
          existing.contributionsPaymentDeadline,
        ),
      },
      include: PERIOD_INCLUDE,
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollPeriodTekaPayment',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async completeFmySubmission(
    tenant: TenantContext,
    id: string,
    dto: CompleteFmySubmissionDto,
  ) {
    const existing = await this.findApprovedPeriod(tenant, id);
    if (!existing.fmySubmissionDeadline) {
      throw new BadRequestException('Δεν έχει οριστεί προθεσμία δήλωσης ΦΜΥ.');
    }
    if (Number(existing.totalWithholdingTax) > 0 && !dto.debtId?.trim()) {
      throw new BadRequestException(
        'Για χρεωστική δήλωση ΦΜΥ απαιτείται Ταυτότητα Οφειλής.',
      );
    }
    const submittedAt = new Date(dto.submittedAt);
    const updated = await this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        fmyProtocol: dto.protocol.trim(),
        fmySubmittedAt: submittedAt,
        fmyDebtId: dto.debtId?.trim() || null,
        fmyLateSubmission: isComplianceLate(
          submittedAt,
          existing.fmySubmissionDeadline,
        ),
      },
      include: PERIOD_INCLUDE,
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollPeriodFmySubmission',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async markFmyPaid(
    tenant: TenantContext,
    id: string,
    dto: MarkFmyPaidDto,
  ) {
    const existing = await this.findApprovedPeriod(tenant, id);
    if (!existing.fmySubmittedAt) {
      throw new BadRequestException('Καταχωρίστε πρώτα την υποβολή της δήλωσης ΦΜΥ.');
    }
    if (!existing.fmySubmissionDeadline) {
      throw new BadRequestException('Δεν έχει οριστεί προθεσμία πληρωμής ΦΜΥ.');
    }
    const paymentDate = utcDate(dto.paymentDate);
    const updated = await this.prisma.payrollPeriod.update({
      where: { id },
      data: {
        fmyPaidAt: new Date(),
        fmyPaymentDate: paymentDate,
        fmyPaymentReference: dto.paymentReference.trim(),
        fmyLatePayment: isComplianceLate(
          paymentDate,
          existing.fmySubmissionDeadline,
        ),
      },
      include: PERIOD_INCLUDE,
    });
    await this.recordAudit(
      tenant,
      AuditAction.UPDATE,
      'PayrollPeriodFmyPayment',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async exportApd(tenant: TenantContext, id: string) {
    const period = await this.findPeriod(tenant, id);
    if (
      period.status !== PayrollPeriodStatus.APPROVED &&
      period.status !== PayrollPeriodStatus.PAID
    ) {
      throw new BadRequestException('Η ΑΠΔ εξάγεται μόνο μετά την έγκριση μισθοδοσίας.');
    }
    const settings = await this.prisma.payrollEmployerSettings.findFirst({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId: period.clientCompanyId,
      },
    });
    if (!settings) {
      throw new BadRequestException('Συμπληρώστε πρώτα τα στοιχεία εργοδότη ΑΠΔ.');
    }

    const buffer = this.apdExport.build({
      declarationType: period.declarationType,
      periodYear: period.periodYear,
      periodMonth: period.periodMonth,
      submittedAt: new Date(),
      employer: {
        registryNumber: settings.employerRegistryNumber,
        submissionOfficeCode: settings.submissionOfficeCode,
        submissionOfficeName: settings.submissionOfficeName,
        legalName: period.clientCompany.legalName,
        vatNumber: period.clientCompany.vatNumber,
        street: settings.street,
        streetNumber: settings.streetNumber,
        postalCode: settings.postalCode,
        city: settings.city,
      },
      entries: period.entries.map((entry) => ({
        employee: {
          insuranceRegistryNumber: entry.employee.insuranceRegistryNumber,
          amka: entry.employee.amka,
          lastName: entry.employee.lastName,
          firstName: entry.employee.firstName,
          fatherName: entry.employee.fatherName,
          motherName: entry.employee.motherName,
          birthDate: entry.employee.birthDate,
          afm: entry.employee.afm,
        },
        contract: {
          branchNumber: entry.contract.apdBranchNumber,
          kad: entry.contract.apdKad,
          fullTime: entry.contract.fullTime,
          weeklySystem: entry.contract.weeklySystem,
          specialtyCode: entry.contract.apdSpecialtyCode,
          specialInsuranceCase: entry.contract.apdSpecialInsuranceCase,
          coveragePackageCode: entry.contract.apdCoveragePackageCode,
          externalSupplementaryFund: entry.contract.externalSupplementaryFund,
          externalHealthFund: entry.contract.externalHealthFund,
          compensationType: entry.contract.compensationType,
        },
        employmentFrom: entry.employmentFrom,
        employmentTo: entry.employmentTo,
        earningsType: entry.apdEarningsType,
        insuranceDays: entry.insuranceDays,
        dailyWage:
          entry.contract.compensationType === PayrollCompensationType.DAILY
            ? Number(entry.contract.dailyWage)
            : roundMoney(Number(entry.contributionBase) / Math.max(1, entry.insuranceDays)),
        grossEarnings: Number(entry.contributionBase),
        employeeContributions: Number(entry.employeeContributions),
        employerContributions: Number(entry.employerContributions),
      })),
    });

    return {
      buffer,
      filename: `CSL01-${period.clientCompany.vatNumber}-${period.periodYear}${String(period.periodMonth).padStart(2, '0')}.txt`,
    };
  }

  async exportPayslip(tenant: TenantContext, periodId: string, entryId: string) {
    const period = await this.findApprovedPeriod(tenant, periodId);
    const entry = period.entries.find((value) => value.id === entryId);
    if (!entry) throw new NotFoundException('Η εγγραφή μισθοδοσίας δεν βρέθηκε.');
    const employeeEntries = period.entries.filter(
      (value) => value.employeeId === entry.employeeId,
    );
    const gross = sumDecimal(employeeEntries, 'grossEarnings');
    const employeeContributions = sumDecimal(
      employeeEntries,
      'employeeContributions',
    );
    const withholdingTax = sumDecimal(employeeEntries, 'withholdingTax');
    const otherDeductions = sumDecimal(employeeEntries, 'otherDeductions');
    const net = sumDecimal(employeeEntries, 'netPayable');

    const company = escapeHtml(period.clientCompany.legalName);
    const employeeName = escapeHtml(`${entry.employee.lastName} ${entry.employee.firstName}`);
    const periodLabel = `${String(period.periodMonth).padStart(2, '0')}/${period.periodYear}`;
    const html = `<!doctype html>
<html lang="el"><head><meta charset="utf-8"><title>Εκκαθαριστικό ${employeeName}</title>
<style>body{font-family:Arial,sans-serif;color:#17232d;margin:32px}h1{font-size:22px;margin-bottom:4px}.meta{color:#52606b;margin-bottom:24px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #cbd5df;padding:9px;text-align:right}th:first-child,td:first-child{text-align:left}th{background:#eef3f6}.total{font-weight:700;background:#f5f8fa}.footer{margin-top:32px;font-size:12px;color:#637381}@media print{body{margin:12mm}}</style></head>
<body><h1>Εξοφλητικό σημείωμα μισθοδοσίας</h1>
<div class="meta"><strong>${company}</strong> · ΑΦΜ ${escapeHtml(period.clientCompany.vatNumber)}<br>
Εργαζόμενος: <strong>${employeeName}</strong> · ΑΦΜ ${escapeHtml(entry.employee.afm)} · ΑΜΚΑ ${escapeHtml(entry.employee.amka)}<br>
Περίοδος: <strong>${periodLabel}</strong> · Ημέρες ασφάλισης: ${entry.insuranceDays}</div>
<table><thead><tr><th>Περιγραφή</th><th>Ποσό (€)</th></tr></thead><tbody>
<tr><td>Συμφωνημένες βασικές αποδοχές</td><td>${moneyText(entry.baseGross)}</td></tr>
${Number(entry.nightPremiumGross) ? `<tr><td>Προσαύξηση νυχτερινής εργασίας 25%</td><td>${moneyText(entry.nightPremiumGross)}</td></tr>` : ''}
${Number(entry.sundayHolidayGross) ? `<tr><td>Προσαύξηση Κυριακής/αργίας 75%</td><td>${moneyText(entry.sundayHolidayGross)}</td></tr>` : ''}
${Number(entry.extraWorkGross) ? `<tr><td>Υπερεργασία (ωρομίσθιο +20%)</td><td>${moneyText(entry.extraWorkGross)}</td></tr>` : ''}
${Number(entry.legalOvertimeGross) ? `<tr><td>Νόμιμη υπερωρία (ωρομίσθιο +40%)</td><td>${moneyText(entry.legalOvertimeGross)}</td></tr>` : ''}
${Number(entry.approvedOvertimeGross) ? `<tr><td>Υπερωρία με άδεια Υπουργείου (ωρομίσθιο +60%)</td><td>${moneyText(entry.approvedOvertimeGross)}</td></tr>` : ''}
${Number(entry.illegalOvertimeGross) ? `<tr><td>Παράνομη υπερωρία (ωρομίσθιο +120%)</td><td>${moneyText(entry.illegalOvertimeGross)}</td></tr>` : ''}
${Number(entry.partTimeExtraGross) ? `<tr><td>Πρόσθετη εργασία μερικής απασχόλησης (+12%)</td><td>${moneyText(entry.partTimeExtraGross)}</td></tr>` : ''}
${Number(entry.leaveEmployerGross) ? `<tr><td>Εργοδοτικές αποδοχές οικογενειακής άδειας</td><td>${moneyText(entry.leaveEmployerGross)}</td></tr>` : ''}
${Number(entry.bonusGross) ? `<tr><td>Bonus τακτικής εγγραφής</td><td>${moneyText(entry.bonusGross)}</td></tr>` : ''}
${Number(entry.otherGross) ? `<tr><td>Λοιπές μικτές αποδοχές τακτικής εγγραφής</td><td>${moneyText(entry.otherGross)}</td></tr>` : ''}
${employeeEntries.filter((value) => value.apdEarningsType !== '001').map((value) => `<tr><td>${escapeHtml(earningsTypeLabel(value.apdEarningsType))}</td><td>${moneyText(value.grossEarnings)}</td></tr>`).join('')}
<tr class="total"><td>Σύνολο μικτών αποδοχών</td><td>${moneyText(gross)}</td></tr>
${Number(entry.contributionExempt) ? `<tr><td>Προσαυξήσεις εκτός ασφαλιστικών εισφορών</td><td>${moneyText(entry.contributionExempt)}</td></tr><tr><td>Ασφαλιστέες αποδοχές ΑΠΔ</td><td>${moneyText(entry.contributionBase)}</td></tr>` : ''}
<tr><td>Ασφαλιστικές εισφορές εργαζομένου</td><td>-${moneyText(employeeContributions)}</td></tr>
<tr><td>Παρακρατούμενος φόρος μισθωτών υπηρεσιών</td><td>-${moneyText(withholdingTax)}</td></tr>
<tr><td>Λοιπές κρατήσεις</td><td>-${moneyText(otherDeductions)}</td></tr>
<tr class="total"><td>Καθαρό πληρωτέο</td><td>${moneyText(net)}</td></tr>
</tbody></table>
<div class="footer">Εκδόθηκε από το Open Logistirio. Το σημείωμα αποτυπώνει την εγκεκριμένη και κλειδωμένη περίοδο μισθοδοσίας.</div>
<script>window.addEventListener('load',()=>window.print())</script></body></html>`;
    return {
      buffer: Buffer.from(html, 'utf8'),
      filename: `payslip-${safeFilename(entry.employee.lastName)}-${period.periodYear}-${String(period.periodMonth).padStart(2, '0')}.html`,
      contentType: 'text/html; charset=utf-8',
    };
  }

  async exportBankPayments(tenant: TenantContext, periodId: string) {
    const period = await this.findApprovedPeriod(tenant, periodId);
    const groupedEntries = groupEmployeeEntries(period.entries);
    const missing = groupedEntries.filter(({ entry }) => !entry.employee.iban);
    if (missing.length) {
      throw new BadRequestException(
        `Λείπει IBAN για: ${missing.map(({ entry }) => `${entry.employee.lastName} ${entry.employee.firstName}`).join(', ')}.`,
      );
    }
    const periodLabel = `${String(period.periodMonth).padStart(2, '0')}/${period.periodYear}`;
    const rows = [
      ['ΑΦΜ εργοδότη', 'Εργοδότης', 'ΑΦΜ εργαζομένου', 'Δικαιούχος', 'IBAN', 'Ποσό', 'Αιτιολογία'],
      ...groupedEntries.map(({ entry, entries }) => [
        period.clientCompany.vatNumber,
        period.clientCompany.legalName,
        entry.employee.afm,
        `${entry.employee.lastName} ${entry.employee.firstName}`,
        entry.employee.iban ?? '',
        sumDecimal(entries, 'netPayable').toFixed(2).replace('.', ','),
        `ΜΙΣΘΟΔΟΣΙΑ ${periodLabel}`,
      ]),
    ];
    return {
      buffer: csvBuffer(rows),
      filename: `payroll-payments-${period.clientCompany.vatNumber}-${period.periodYear}${String(period.periodMonth).padStart(2, '0')}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  async exportWithholdingWorkpaper(tenant: TenantContext, periodId: string) {
    const period = await this.findApprovedPeriod(tenant, periodId);
    const groupedEntries = groupEmployeeEntries(period.entries);
    const rows = [
      [
        'ΑΦΜ εργοδότη',
        'Περίοδος',
        'ΑΦΜ δικαιούχου',
        'Ονοματεπώνυμο',
        'Μικτές αποδοχές',
        'Φορολογητέες αποδοχές',
        'Παρακρατηθείς φόρος',
      ],
      ...groupedEntries.map(({ entry, entries }) => [
        period.clientCompany.vatNumber,
        `${String(period.periodMonth).padStart(2, '0')}/${period.periodYear}`,
        entry.employee.afm,
        `${entry.employee.lastName} ${entry.employee.firstName}`,
        sumDecimal(entries, 'grossEarnings').toFixed(2).replace('.', ','),
        sumDecimal(entries, 'taxableEarnings').toFixed(2).replace('.', ','),
        sumDecimal(entries, 'withholdingTax').toFixed(2).replace('.', ','),
      ]),
      [
        '',
        '',
        '',
        'ΣΥΝΟΛΑ',
        Number(period.totalGross).toFixed(2).replace('.', ','),
        '',
        Number(period.totalWithholdingTax).toFixed(2).replace('.', ','),
      ],
    ];
    return {
      buffer: csvBuffer(rows),
      filename: `FMY-workpaper-${period.clientCompany.vatNumber}-${period.periodYear}${String(period.periodMonth).padStart(2, '0')}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  private async findPeriod(tenant: TenantContext, id: string) {
    const period = await this.prisma.payrollPeriod.findFirst({
      where: { id, accountingOfficeId: tenant.accountingOfficeId },
      include: PERIOD_INCLUDE,
    });
    if (!period) throw new NotFoundException('Η περίοδος μισθοδοσίας δεν βρέθηκε.');
    return period;
  }

  private async findApprovedPeriod(tenant: TenantContext, id: string) {
    const period = await this.findPeriod(tenant, id);
    if (
      period.status !== PayrollPeriodStatus.APPROVED &&
      period.status !== PayrollPeriodStatus.PAID
    ) {
      throw new BadRequestException('Το αρχείο εκδίδεται μόνο από εγκεκριμένη μισθοδοσία.');
    }
    return period;
  }

  private async ensureTenantCompany(tenant: TenantContext, clientCompanyId: string) {
    const company = await this.prisma.clientCompany.findFirst({
      where: {
        id: clientCompanyId,
        accountingOfficeId: tenant.accountingOfficeId,
        deletedAt: null,
      },
      select: { id: true, legalName: true, vatNumber: true },
    });
    if (!company) throw new NotFoundException('Η επιχείρηση δεν βρέθηκε.');
    return company;
  }

  private validateSicknessInput(
    dto: CreatePayrollEventDto,
    contract: PayrollContract,
  ): { dateFrom: Date; dateTo: Date } {
    if (dto.grossAmount !== undefined) {
      throw new BadRequestException(
        'Οι αποδοχές ασθενείας υπολογίζονται από τις ημέρες και την απόφαση e-ΕΦΚΑ, όχι με χειροκίνητο μικτό ποσό.',
      );
    }
    if (!dto.dateFrom || !dto.dateTo || !dto.leaveDays || !dto.insuranceDays) {
      throw new BadRequestException(
        'Για ασθένεια απαιτούνται διάστημα, ημέρες απουσίας και ημέρες ασφάλισης ΑΠΔ 008.',
      );
    }
    if (!dto.medicalCertificateReference?.trim()) {
      throw new BadRequestException(
        'Απαιτείται αριθμός ηλεκτρονικής ιατρικής γνωμάτευσης ή σχετική αναφορά.',
      );
    }
    if (!dto.sicknessBenefitStatus) {
      throw new BadRequestException('Επιλέξτε κατάσταση επιδόματος ασθενείας e-ΕΦΚΑ.');
    }
    if (
      dto.sicknessBenefitStatus === PayrollSicknessBenefitStatus.APPROVED &&
      !(dto.efkaBenefit && dto.efkaBenefit > 0)
    ) {
      throw new BadRequestException('Για εγκεκριμένο επίδομα απαιτείται το ποσό e-ΕΦΚΑ.');
    }
    if (
      dto.sicknessBenefitStatus !== PayrollSicknessBenefitStatus.APPROVED &&
      Number(dto.efkaBenefit ?? 0) !== 0
    ) {
      throw new BadRequestException(
        'Ποσό e-ΕΦΚΑ καταχωρίζεται μόνο όταν το επίδομα έχει εγκριθεί.',
      );
    }
    if (dto.insuranceDays > dto.leaveDays) {
      throw new BadRequestException(
        'Οι ημέρες ασφάλισης ΑΠΔ 008 δεν μπορούν να υπερβαίνουν τις ημέρες απουσίας.',
      );
    }
    const dateFrom = utcDate(dto.dateFrom);
    const dateTo = utcDate(dto.dateTo);
    if (dateTo < dateFrom) {
      throw new BadRequestException('Η λήξη ασθένειας προηγείται της έναρξης.');
    }
    const periodStart = new Date(Date.UTC(dto.periodYear, dto.periodMonth - 1, 1));
    const periodEnd = new Date(Date.UTC(dto.periodYear, dto.periodMonth, 0));
    if (dateFrom < periodStart || dateTo > periodEnd) {
      throw new BadRequestException(
        'Αναρρωτική απουσία που περνά σε άλλο μήνα καταχωρίζεται σε χωριστή εγγραφή ανά μισθολογική περίοδο.',
      );
    }
    if (
      dateFrom < contract.startDate ||
      (contract.endDate && dateTo > contract.endDate)
    ) {
      throw new BadRequestException('Το διάστημα ασθένειας είναι εκτός της σύμβασης.');
    }
    const calendarDays =
      Math.floor((dateTo.getTime() - dateFrom.getTime()) / 86_400_000) + 1;
    if (dto.leaveDays > calendarDays) {
      throw new BadRequestException(
        'Οι ημέρες απουσίας δεν μπορούν να υπερβαίνουν τις ημερολογιακές ημέρες του διαστήματος.',
      );
    }
    return { dateFrom, dateTo };
  }

  private async sicknessCalculationContext(
    employeeId: string,
    employmentStart: Date,
    compensationType: PayrollCompensationType,
    sicknessStart: Date,
    medicalCertificateReference: string,
    excludeEventId?: string,
  ): Promise<SicknessCalculationContext> {
    const workYearStart = employmentYearStart(employmentStart, sicknessStart);
    const calendarYearStart = new Date(Date.UTC(sicknessStart.getUTCFullYear(), 0, 1));
    const priorEvents = await this.prisma.payrollEvent.findMany({
      where: {
        employeeId,
        id: excludeEventId ? { not: excludeEventId } : undefined,
        type: PayrollEventType.SICKNESS,
        dateFrom: { lt: sicknessStart },
      },
      select: {
        id: true,
        dateFrom: true,
        leaveDays: true,
        medicalCertificateReference: true,
      },
    });
    const normalizedReference = medicalCertificateReference.trim().toUpperCase();
    const priorEpisodeDays = priorEvents
      .filter(
        (event) =>
          event.medicalCertificateReference?.trim().toUpperCase() ===
          normalizedReference,
      )
      .reduce((total, event) => total + Number(event.leaveDays ?? 0), 0);
    const episodeStart = priorEvents
      .filter(
        (event) =>
          event.medicalCertificateReference?.trim().toUpperCase() ===
            normalizedReference && !!event.dateFrom,
      )
      .reduce(
        (earliest, event) =>
          event.dateFrom! < earliest ? event.dateFrom! : earliest,
        sicknessStart,
      );
    const otherCalendarEpisodes = new Map<string, number>();
    priorEvents
      .filter(
        (event) =>
          !!event.dateFrom &&
          event.dateFrom >= calendarYearStart &&
          event.medicalCertificateReference?.trim().toUpperCase() !==
            normalizedReference,
      )
      .forEach((event) => {
        const key =
          event.medicalCertificateReference?.trim().toUpperCase() || event.id;
        otherCalendarEpisodes.set(
          key,
          (otherCalendarEpisodes.get(key) ?? 0) + Number(event.leaveDays ?? 0),
        );
      });
    return {
      priorEmployerLiabilityDays: priorEvents.reduce(
        (total, event) => {
          const sameEpisode =
            event.medicalCertificateReference?.trim().toUpperCase() ===
            normalizedReference;
          return total +
            (sameEpisode || (!!event.dateFrom && event.dateFrom >= workYearStart)
              ? Number(event.leaveDays ?? 0)
              : 0);
        },
        0,
      ),
      priorEpisodeDays,
      employerLiabilityLimitDays:
        completedYearsBetween(employmentStart, episodeStart) >= 1
          ? compensationType === PayrollCompensationType.MONTHLY
            ? 25
            : 26
          : compensationType === PayrollCompensationType.MONTHLY
            ? 12.5
            : 13,
      hasPriorLongSicknessInCalendarYear: [...otherCalendarEpisodes.values()].some(
        (days) => days > 3,
      ),
    };
  }

  private validateCompensation(dto: CreatePayrollContractDto, startDate: Date) {
    if (
      dto.compensationType === PayrollCompensationType.MONTHLY &&
      (dto.monthlySalary === undefined ||
        dto.dailyWage !== undefined ||
        dto.statutoryDailyWage !== undefined)
    ) {
      throw new BadRequestException('Η μηνιαία σύμβαση απαιτεί μόνο μηνιαίο μισθό.');
    }
    if (
      dto.compensationType === PayrollCompensationType.DAILY &&
      (dto.dailyWage === undefined ||
        dto.monthlySalary !== undefined ||
        dto.statutoryMonthlySalary !== undefined)
    ) {
      throw new BadRequestException('Η ημερομίσθια σύμβαση απαιτεί μόνο ημερομίσθιο.');
    }
    if (startDate.getUTCFullYear() === 2026) {
      const minimum = minimumWage2026(startDate.getUTCMonth() + 1);
      const fullTime = dto.fullTime ?? true;
      const hours = dto.weeklyHours ?? 40;
      if (
        dto.compensationType === PayrollCompensationType.MONTHLY &&
        Number(dto.monthlySalary) < minimum.monthly * (fullTime ? 1 : hours / 40)
      ) {
        throw new BadRequestException('Ο συμφωνημένος μισθός είναι κάτω από τον νόμιμο ελάχιστο.');
      }
      if (
        dto.compensationType === PayrollCompensationType.MONTHLY &&
        dto.statutoryMonthlySalary !== undefined &&
        dto.statutoryMonthlySalary <
          minimum.monthly * (fullTime ? 1 : hours / 40)
      ) {
        throw new BadRequestException(
          'Η νόμιμη βάση προσαυξήσεων είναι κάτω από τον ισχύοντα ελάχιστο μισθό.',
        );
      }
      if (
        dto.compensationType === PayrollCompensationType.DAILY &&
        Number(dto.dailyWage) <
          minimum.daily *
            dailyWorkRatio(
              fullTime,
              hours,
              dto.workDaysPerWeek ?? 5,
              dto.weeklySystem ?? 'FIVE_DAY',
            )
      ) {
        throw new BadRequestException(
          'Το συμφωνημένο ημερομίσθιο είναι κάτω από τον νόμιμο ελάχιστο.',
        );
      }
      if (
        dto.compensationType === PayrollCompensationType.DAILY &&
        dto.statutoryDailyWage !== undefined &&
        dto.statutoryDailyWage <
          minimum.daily *
            dailyWorkRatio(
              fullTime,
              hours,
              dto.workDaysPerWeek ?? 5,
              dto.weeklySystem ?? 'FIVE_DAY',
            )
      ) {
        throw new BadRequestException(
          'Το νόμιμο ημερομίσθιο προσαυξήσεων είναι κάτω από τον ισχύοντα ελάχιστο.',
        );
      }
    }
  }

  private validateContractSchedule(dto: CreatePayrollContractDto) {
    const expectedDays = dto.workDaysPerWeek ?? 5;
    const weekdays = (dto.workWeekdays ?? '1,2,3,4,5')
      .split(',')
      .map(Number);
    if (
      new Set(weekdays).size !== weekdays.length ||
      weekdays.length !== expectedDays
    ) {
      throw new BadRequestException(
        'Οι επιλεγμένες ημέρες εργασίας πρέπει να συμφωνούν με τις ημέρες εβδομαδιαίας απασχόλησης.',
      );
    }
    const toMinutes = (value: string) => {
      const [hours, minutes] = value.split(':').map(Number);
      return hours * 60 + minutes;
    };
    const start = toMinutes(dto.dailyStartTime ?? '09:00');
    const end = toMinutes(dto.dailyEndTime ?? '17:00');
    const elapsed = end > start ? end - start : end + 1_440 - start;
    if (elapsed <= 0 || elapsed > 13 * 60) {
      throw new BadRequestException(
        'Το ημερήσιο ωράριο πρέπει να έχει θετική διάρκεια έως 13 ώρες.',
      );
    }
    const breakMinutes = dto.breakMinutes ?? 0;
    const availableDailyMinutes =
      elapsed - (dto.breakWithinWorkingTime ? 0 : breakMinutes);
    if (availableDailyMinutes <= 0) {
      throw new BadRequestException(
        'Το διάλειμμα εκτός χρόνου εργασίας δεν μπορεί να καλύπτει ολόκληρο το ωράριο.',
      );
    }
    const declaredWeeklyMinutes = Number(dto.weeklyHours ?? 40) * 60;
    if (declaredWeeklyMinutes > availableDailyMinutes * expectedDays) {
      throw new BadRequestException(
        'Οι συμβατικές εβδομαδιαίες ώρες υπερβαίνουν το δηλωμένο ημερήσιο πρόγραμμα.',
      );
    }
    if (
      Number(dto.flexibleArrivalMinutes ?? 0) > 0 &&
      !dto.digitalCardEnabled
    ) {
      throw new BadRequestException(
        'Η ευέλικτη προσέλευση επιτρέπεται μόνο όταν έχει ενεργοποιηθεί η Ψηφιακή Κάρτα Εργασίας.',
      );
    }
  }

  private async ensureNoContractOverlap(
    employeeId: string,
    startDate: Date,
    endDate?: Date,
    excludeId?: string,
  ) {
    const overlapping = await this.prisma.payrollContract.findFirst({
      where: {
        employeeId,
        id: excludeId ? { not: excludeId } : undefined,
        startDate: { lte: endDate ?? new Date('9999-12-31T00:00:00.000Z') },
        OR: [{ endDate: null }, { endDate: { gte: startDate } }],
      },
    });
    if (overlapping) {
      throw new BadRequestException('Υπάρχει ήδη σύμβαση που επικαλύπτει αυτό το διάστημα.');
    }
  }

  private async findLockedPayrollEntry(employeeId?: string, contractId?: string) {
    return this.prisma.payrollEntry.findFirst({
      where: {
        employeeId,
        contractId,
        payrollPeriod: {
          status: { in: [PayrollPeriodStatus.APPROVED, PayrollPeriodStatus.PAID] },
        },
      },
      select: { id: true, employmentTo: true },
      orderBy: { employmentTo: 'desc' },
    });
  }

  private async ensurePeriodMutableForCompany(
    clientCompanyId: string,
    periodYear: number,
    periodMonth: number,
  ) {
    const locked = await this.prisma.payrollPeriod.findFirst({
      where: {
        clientCompanyId,
        periodYear,
        periodMonth,
        status: { in: [PayrollPeriodStatus.APPROVED, PayrollPeriodStatus.PAID] },
      },
      select: { id: true },
    });
    if (locked) {
      throw new BadRequestException(
        'Η περίοδος έχει εγκριθεί. Δεν επιτρέπεται μεταβολή ειδικών αποδοχών.',
      );
    }
  }

  private async ensureNoPendingErganiDeclarations(
    tenant: TenantContext,
    clientCompanyId: string,
    contractIds: string[],
    periodEnd: Date,
  ) {
    if (contractIds.length === 0) return;
    const pendingDeclarations = await this.prisma.payrollErganiDeclaration.findMany({
      where: {
        accountingOfficeId: tenant.accountingOfficeId,
        clientCompanyId,
        contractId: { in: contractIds },
        status: PayrollErganiDeclarationStatus.DRAFT,
        effectiveAt: { lte: periodEnd },
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { deadlineAt: 'asc' },
    });
    const now = new Date();
    const pending = pendingDeclarations.find((declaration) =>
      erganiDeclarationBlocksPayroll({
        type: declaration.type,
        status: declaration.status,
        effectiveAt: declaration.effectiveAt,
        deadlineAt: declaration.deadlineAt,
        periodEnd,
        now,
      }),
    );
    if (pending) {
      throw new BadRequestException(
        `${pending.employee.lastName} ${pending.employee.firstName}: εκκρεμεί υποχρεωτική δήλωση ΕΡΓΑΝΗ ΙΙ (${erganiDeclarationTypeLabel(pending.type)}). Καταχωρίστε το πραγματικό πρωτόκολλο πριν από τη μισθοδοσία.`,
      );
    }
  }

  private async recordAudit(
    tenant: TenantContext,
    action: AuditAction,
    entityType: string,
    entityId: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    await this.auditService.record({
      tenant,
      action,
      entityType,
      entityId,
      oldValue: oldValue ? toJson(oldValue) : undefined,
      newValue: newValue ? toJson(newValue) : undefined,
    });
  }
}

function minimumWage2026(month: number): { monthly: number; daily: number } {
  return month >= 4 ? { monthly: 920, daily: 41.09 } : { monthly: 880, daily: 39.3 };
}

function dailyWorkRatio(
  fullTime: boolean,
  weeklyHours: number,
  workDaysPerWeek: number,
  weeklySystem: 'FIVE_DAY' | 'SIX_DAY',
): number {
  if (fullTime) return 1;
  const standardDays = weeklySystem === 'SIX_DAY' ? 6 : 5;
  return Math.min(1, (weeklyHours / 40) * (standardDays / workDaysPerWeek));
}

function contractCoreChanged(
  existing: PayrollContract,
  merged: CreatePayrollContractDto,
  startDate: Date,
): boolean {
  return (
    startDate.getTime() !== existing.startDate.getTime() ||
    merged.compensationType !== existing.compensationType ||
    Number(merged.monthlySalary ?? 0) !== Number(existing.monthlySalary ?? 0) ||
    Number(merged.dailyWage ?? 0) !== Number(existing.dailyWage ?? 0) ||
    Number(merged.statutoryMonthlySalary ?? 0) !==
      Number(existing.statutoryMonthlySalary ?? 0) ||
    Number(merged.statutoryDailyWage ?? 0) !==
      Number(existing.statutoryDailyWage ?? 0) ||
    merged.fullTime !== existing.fullTime ||
    merged.weeklySystem !== existing.weeklySystem ||
    Number(merged.weeklyHours) !== Number(existing.weeklyHours) ||
    merged.workDaysPerWeek !== existing.workDaysPerWeek ||
    merged.workWeekdays !== existing.workWeekdays ||
    merged.dailyStartTime !== existing.dailyStartTime ||
    merged.dailyEndTime !== existing.dailyEndTime ||
    merged.breakMinutes !== existing.breakMinutes ||
    merged.breakWithinWorkingTime !== existing.breakWithinWorkingTime ||
    merged.digitalCardEnabled !== existing.digitalCardEnabled ||
    merged.flexibleArrivalMinutes !== existing.flexibleArrivalMinutes ||
    merged.apdBranchNumber !== existing.apdBranchNumber ||
    merged.apdKad !== existing.apdKad ||
    merged.apdSpecialtyCode !== existing.apdSpecialtyCode ||
    merged.apdSpecialInsuranceCase !== existing.apdSpecialInsuranceCase ||
    merged.apdCoveragePackageCode !== existing.apdCoveragePackageCode ||
    merged.externalSupplementaryFund !== existing.externalSupplementaryFund ||
    merged.externalHealthFund !== existing.externalHealthFund ||
    Number(merged.employeeContributionRate) !== Number(existing.employeeContributionRate) ||
    Number(merged.employerContributionRate) !== Number(existing.employerContributionRate)
  );
}

function erganiContractTermsChanged(
  existing: PayrollContract,
  merged: CreatePayrollContractDto,
  startDate: Date,
  endDate?: Date,
): boolean {
  return (
    startDate.getTime() !== existing.startDate.getTime() ||
    (endDate?.getTime() ?? 0) !== (existing.endDate?.getTime() ?? 0) ||
    merged.compensationType !== existing.compensationType ||
    Number(merged.monthlySalary ?? 0) !== Number(existing.monthlySalary ?? 0) ||
    Number(merged.dailyWage ?? 0) !== Number(existing.dailyWage ?? 0) ||
    merged.fullTime !== existing.fullTime ||
    merged.weeklySystem !== existing.weeklySystem ||
    Number(merged.weeklyHours) !== Number(existing.weeklyHours) ||
    merged.workDaysPerWeek !== existing.workDaysPerWeek ||
    merged.workWeekdays !== existing.workWeekdays ||
    merged.dailyStartTime !== existing.dailyStartTime ||
    merged.dailyEndTime !== existing.dailyEndTime ||
    merged.breakMinutes !== existing.breakMinutes ||
    merged.breakWithinWorkingTime !== existing.breakWithinWorkingTime ||
    merged.digitalCardEnabled !== existing.digitalCardEnabled ||
    merged.flexibleArrivalMinutes !== existing.flexibleArrivalMinutes ||
    merged.apdSpecialtyCode !== existing.apdSpecialtyCode
  );
}

function payrollContractSnapshot(contract: PayrollContract): Prisma.InputJsonObject {
  return {
    contractId: contract.id,
    employeeId: contract.employeeId,
    startDate: contract.startDate.toISOString(),
    endDate: contract.endDate?.toISOString() ?? '',
    compensationType: contract.compensationType,
    monthlySalary: Number(contract.monthlySalary ?? 0),
    dailyWage: Number(contract.dailyWage ?? 0),
    statutoryMonthlySalary: Number(contract.statutoryMonthlySalary ?? 0),
    statutoryDailyWage: Number(contract.statutoryDailyWage ?? 0),
    fullTime: contract.fullTime,
    weeklySystem: contract.weeklySystem,
    weeklyHours: Number(contract.weeklyHours),
    workDaysPerWeek: contract.workDaysPerWeek,
    workWeekdays: contract.workWeekdays,
    dailyStartTime: contract.dailyStartTime,
    dailyEndTime: contract.dailyEndTime,
    breakMinutes: contract.breakMinutes,
    breakWithinWorkingTime: contract.breakWithinWorkingTime,
    digitalCardEnabled: contract.digitalCardEnabled,
    flexibleArrivalMinutes: contract.flexibleArrivalMinutes,
    apdBranchNumber: contract.apdBranchNumber,
    apdKad: contract.apdKad,
    apdSpecialtyCode: contract.apdSpecialtyCode,
    apdCoveragePackageCode: contract.apdCoveragePackageCode,
  };
}

function erganiDeclarationTypeLabel(type: PayrollErganiDeclarationType): string {
  return {
    HIRING: 'Έναρξη εργασίας',
    INITIAL_WORK_SCHEDULE: 'Αρχική Ψηφιακή Οργάνωση Χρόνου Εργασίας',
    WORK_SCHEDULE_CHANGE: 'Αλλαγή οργάνωσης χρόνου εργασίας',
    DIGITAL_CARD_ENROLLMENT: 'Ένταξη στην ψηφιακή κάρτα',
    EXECUTIVE_STATUS_ACQUIRED: 'Κτήση ιδιότητας διευθυντικού στελέχους',
    EXECUTIVE_STATUS_LOST: 'Απώλεια ιδιότητας διευθυντικού στελέχους',
    PAY_CHANGE_AGREEMENT: 'Μεταβολή αποδοχών κατόπιν συμφωνίας',
    PAY_CHANGE_LEGISLATION: 'Μεταβολή αποδοχών λόγω νόμου ή ΣΣΕ',
    SPECIALTY_CHANGE: 'Μεταβολή ειδικότητας',
    WORKPLACE_CHANGE: 'Μεταβολή τόπου εργασίας',
    PART_TIME_TO_FULL_TIME: 'Μετατροπή σε πλήρη απασχόληση',
    FULL_TIME_TO_PART_TIME: 'Μετατροπή σε μερική απασχόληση',
    FULL_TIME_TO_ROTATING: 'Μετατροπή σε εκ περιτροπής απασχόληση',
    FULL_TIME_TO_ROTATING_UNILATERAL: 'Μονομερής εκ περιτροπής απασχόληση',
    FIXED_TO_OPEN_ENDED: 'Μετατροπή ορισμένου σε αορίστου χρόνου',
    FIXED_TERM_EXTENSION: 'Παράταση σύμβασης ορισμένου χρόνου',
    WORK_TIME_ARRANGEMENT: 'Διευθέτηση χρόνου εργασίας',
    OTHER: 'Άλλη μεταβολή',
  }[type];
}

function apdEarningsType(type: PayrollEventType): string {
  return {
    CHRISTMAS_BONUS: '003',
    EASTER_BONUS: '004',
    LEAVE_ALLOWANCE: '005',
    SICKNESS: '008',
    RETROACTIVE: '009',
    BONUS: '010',
    OVERTIME: '011',
  }[type];
}

export function calculateEventGross(
  dto: CreatePayrollEventDto,
  contract: PayrollContract,
  sicknessContext?: SicknessCalculationContext,
): {
  grossAmount: number;
  autoCalculated: boolean;
  details: Prisma.InputJsonObject;
} {
  if (dto.type === PayrollEventType.SICKNESS && dto.grossAmount !== undefined) {
    throw new BadRequestException(
      'Οι αποδοχές ασθενείας δεν δέχονται χειροκίνητο μικτό ποσό.',
    );
  }
  if (dto.grossAmount !== undefined) {
    if (dto.grossAmount <= 0) {
      throw new BadRequestException('Το ποσό ειδικής αποδοχής πρέπει να είναι μεγαλύτερο από μηδέν.');
    }
    return {
      grossAmount: roundMoney(dto.grossAmount),
      autoCalculated: false,
      details: { method: 'MANUAL_REVIEWED', rulesVersion: 'GR-PAYROLL-2026.2' },
    };
  }

  const salary = Number(contract.monthlySalary ?? 0);
  const daily = Number(contract.dailyWage ?? 0);
  const isMonthly = contract.compensationType === PayrollCompensationType.MONTHLY;
  let grossAmount = 0;
  let referenceDays = 0;
  let formula = '';

  if (dto.type === PayrollEventType.SICKNESS) {
    if (
      !dto.dateFrom ||
      !dto.leaveDays ||
      !dto.sicknessBenefitStatus ||
      !sicknessContext
    ) {
      throw new BadRequestException(
        'Για αυτόματο υπολογισμό ασθένειας απαιτούνται ημερομηνίες, ημέρες, κατάσταση e-ΕΦΚΑ και ιστορικό.',
      );
    }
    const sicknessStart = utcDate(dto.dateFrom);
    const completedServiceDays = Math.floor(
      (sicknessStart.getTime() - contract.startDate.getTime()) / 86_400_000,
    );
    if (completedServiceDays < 10) {
      throw new BadRequestException(
        'Δεν έχει συμπληρωθεί η ελάχιστη δεκαήμερη εργασία για εργοδοτικές αποδοχές ασθενείας.',
      );
    }
    const annualLiabilityLimitDays =
      sicknessContext.employerLiabilityLimitDays;
    const remainingLiabilityDays = Math.max(
      0,
      annualLiabilityLimitDays - sicknessContext.priorEmployerLiabilityDays,
    );
    const employerLiabilityDays = Math.min(dto.leaveDays, remainingLiabilityDays);
    if (employerLiabilityDays <= 0) {
      throw new BadRequestException(
        'Έχει εξαντληθεί το όριο εργοδοτικών αποδοχών ασθενείας του εργασιακού έτους.',
      );
    }
    const halfPayDays =
      sicknessContext.priorEpisodeDays > 0
        ? Math.min(
            Math.max(0, 3 - sicknessContext.priorEpisodeDays),
            employerLiabilityDays,
          )
        : dto.leaveDays <= 3
          ? employerLiabilityDays
          : sicknessContext.hasPriorLongSicknessInCalendarYear
            ? 0
            : Math.min(3, employerLiabilityDays);
    const fullPayDays = employerLiabilityDays - halfPayDays;
    const dailyRate = isMonthly ? salary / 25 : daily;
    const efkaBenefit =
      dto.sicknessBenefitStatus === PayrollSicknessBenefitStatus.APPROVED
        ? Number(dto.efkaBenefit ?? 0)
        : 0;
    grossAmount = Math.max(
      0,
      dailyRate * halfPayDays * 0.5 + dailyRate * fullPayDays - efkaBenefit,
    );
    referenceDays = employerLiabilityDays;
    formula = 'SICKNESS_FIRST_3_HALF_THEN_REGULAR_LESS_EFKA_WITH_WORK_YEAR_CAP';
    grossAmount = roundMoney(grossAmount);
    if (grossAmount <= 0) {
      throw new BadRequestException(
        'Δεν προκύπτουν θετικές εργοδοτικές αποδοχές ασθενείας μετά το επίδομα e-ΕΦΚΑ.',
      );
    }
    return {
      grossAmount,
      autoCalculated: true,
      details: {
        method: formula,
        rulesVersion: 'GR-PAYROLL-2026.3',
        sicknessBenefitStatus: dto.sicknessBenefitStatus,
        preliminary:
          dto.sicknessBenefitStatus === PayrollSicknessBenefitStatus.PENDING,
        medicalCertificateReference: dto.medicalCertificateReference ?? '',
        sicknessDays: dto.leaveDays,
        employerLiabilityDays,
        priorEmployerLiabilityDays: sicknessContext.priorEmployerLiabilityDays,
        priorEpisodeDays: sicknessContext.priorEpisodeDays,
        annualLiabilityLimitDays,
        halfPayDays,
        fullPayDays,
        dailyRate: roundMoney(dailyRate),
        efkaBenefit,
      },
    };
  } else if (dto.type === PayrollEventType.CHRISTMAS_BONUS) {
    const windowStart = new Date(Date.UTC(dto.periodYear, 4, 1));
    const windowEnd = new Date(Date.UTC(dto.periodYear, 11, 31));
    referenceDays = overlappingCalendarDays(contract, windowStart, windowEnd);
    const base = isMonthly
      ? Math.min(salary, salary * (2 / 25) * (referenceDays / 19))
      : Math.min(daily * 25, daily * 2 * (referenceDays / 19));
    grossAmount = base * 1.041666;
    formula = 'CHRISTMAS_2_25_PER_19_DAYS_PLUS_LEAVE_RATIO';
  } else if (dto.type === PayrollEventType.EASTER_BONUS) {
    const windowStart = new Date(Date.UTC(dto.periodYear, 0, 1));
    const windowEnd = new Date(Date.UTC(dto.periodYear, 3, 30));
    referenceDays = overlappingCalendarDays(contract, windowStart, windowEnd);
    const base = isMonthly
      ? Math.min(salary / 2, (salary / 30) * (referenceDays / 8))
      : Math.min(daily * 15, daily * (referenceDays / 8));
    grossAmount = base * 1.041666;
    formula = 'EASTER_1_15_HALF_SALARY_PER_8_DAYS_PLUS_LEAVE_RATIO';
  } else if (dto.type === PayrollEventType.LEAVE_ALLOWANCE) {
    if (!dto.leaveDays || dto.leaveDays <= 0) {
      throw new BadRequestException(
        'Για αυτόματο υπολογισμό επιδόματος αδείας απαιτούνται ημέρες άδειας.',
      );
    }
    grossAmount = isMonthly
      ? Math.min(salary / 2, (salary / 25) * dto.leaveDays)
      : Math.min(daily * 13, daily * dto.leaveDays);
    referenceDays = dto.leaveDays;
    formula = 'LEAVE_ALLOWANCE_CAPPED_HALF_SALARY_OR_13_DAILY_WAGES';
  } else {
    throw new BadRequestException(
      'Για αναδρομικά, bonus και υπερωρίες απαιτείται ελεγμένο μικτό ποσό.',
    );
  }

  grossAmount = roundMoney(grossAmount);
  if (grossAmount <= 0) {
    throw new BadRequestException('Δεν προκύπτει ποσό από τη διάρκεια της σύμβασης.');
  }
  return {
    grossAmount,
    autoCalculated: true,
    details: {
      method: formula,
      rulesVersion: 'GR-PAYROLL-2026.2',
      referenceDays,
      monthlySalary: salary,
      dailyWage: daily,
      leaveAllowanceRatio: 0.041666,
    },
  };
}

function overlappingCalendarDays(
  contract: PayrollContract,
  windowStart: Date,
  windowEnd: Date,
): number {
  const start = contract.startDate > windowStart ? contract.startDate : windowStart;
  const end = contract.endDate && contract.endDate < windowEnd ? contract.endDate : windowEnd;
  if (end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function annualLeaveEntitlement(input: {
  employmentStart: Date;
  fiscalYear: number;
  weeklySystem: 'FIVE_DAY' | 'SIX_DAY';
  recognizedPriorServiceYears: number;
}): number {
  const fiveDay = input.weeklySystem === 'FIVE_DAY';
  const sameEmployerYears = Math.max(0, input.fiscalYear - input.employmentStart.getUTCFullYear());
  const totalRecognizedYears = input.recognizedPriorServiceYears + sameEmployerYears;
  if (totalRecognizedYears >= 25) return fiveDay ? 26 : 31;
  if (sameEmployerYears >= 10 || totalRecognizedYears >= 12) return fiveDay ? 25 : 30;
  const calendarYear = sameEmployerYears + 1;
  if (calendarYear >= 3) return fiveDay ? 22 : 26;
  if (calendarYear === 2) return fiveDay ? 21 : 25;
  const base = fiveDay ? 20 : 24;
  const yearStart = new Date(Date.UTC(input.fiscalYear, 0, 1));
  const yearEnd = new Date(Date.UTC(input.fiscalYear, 11, 31));
  const start = input.employmentStart > yearStart ? input.employmentStart : yearStart;
  if (start > yearEnd) return 0;
  const activeDays = Math.floor((yearEnd.getTime() - start.getTime()) / 86_400_000) + 1;
  const yearDays = input.fiscalYear % 4 === 0 ? 366 : 365;
  return Math.ceil((base * activeDays) / yearDays);
}

export function calculateTerminationSeverance(input: {
  employmentStart: Date;
  terminationDate: Date;
  type: PayrollTerminationType;
  withNotice: boolean;
  regularMonthlyEarnings: number;
}) {
  if (input.terminationDate < input.employmentStart) {
    throw new BadRequestException('Η ημερομηνία λύσης προηγείται της έναρξης της σύμβασης.');
  }
  const completedServiceYears = completedYearsBetween(
    input.employmentStart,
    input.terminationDate,
  );
  const isDismissal = input.type === PayrollTerminationType.EMPLOYER_DISMISSAL;
  const fullSeveranceMonths = isDismissal
    ? dismissalSeveranceMonths(completedServiceYears)
    : 0;
  const severanceMonths = input.withNotice
    ? fullSeveranceMonths / 2
    : fullSeveranceMonths;
  const noticeMonths = isDismissal && input.withNotice
    ? dismissalNoticeMonths(completedServiceYears)
    : 0;
  const referenceMonthlyEarnings = roundMoney(input.regularMonthlyEarnings * (7 / 6));

  const reformDate = new Date('2012-11-12T00:00:00.000Z');
  const serviceYearsAtReform = input.employmentStart <= reformDate
    ? completedYearsBetween(input.employmentStart, reformDate)
    : 0;
  const legacyFullMonths = isDismissal && serviceYearsAtReform >= 17
    ? Math.min(12, serviceYearsAtReform - 16)
    : 0;
  const legacyAdditionalMonths = input.withNotice
    ? legacyFullMonths / 2
    : legacyFullMonths;
  const legacyCappedMonthlyEarnings = Math.min(referenceMonthlyEarnings, 2000);
  const statutorySeverance = roundMoney(
    referenceMonthlyEarnings * severanceMonths +
      legacyCappedMonthlyEarnings * legacyAdditionalMonths,
  );

  return {
    completedServiceYears,
    noticeMonths,
    severanceMonths: severanceMonths + legacyAdditionalMonths,
    statutorySeverance,
    details: {
      ruleVersion: 'N2112-1920_N4093-2012_N4808-2021_2026',
      regularMonthlyEarnings: roundMoney(input.regularMonthlyEarnings),
      benefitsAndLeaveRatio: 1 / 6,
      referenceMonthlyEarnings,
      baseSeveranceMonths: severanceMonths,
      noticeMonths,
      serviceYearsAt2012Reform: serviceYearsAtReform,
      legacyAdditionalMonths,
      legacyCappedMonthlyEarnings,
      statutorySeverance,
      requiresLegalProtectionReview:
        input.type === PayrollTerminationType.EMPLOYER_DISMISSAL,
    },
  };
}

function dismissalSeveranceMonths(completedServiceYears: number): number {
  if (completedServiceYears < 1) return 0;
  if (completedServiceYears < 4) return 2;
  if (completedServiceYears < 6) return 3;
  if (completedServiceYears < 8) return 4;
  if (completedServiceYears < 10) return 5;
  return Math.min(12, completedServiceYears - 4);
}

function dismissalNoticeMonths(completedServiceYears: number): number {
  if (completedServiceYears < 1) return 0;
  if (completedServiceYears < 2) return 1;
  if (completedServiceYears < 5) return 2;
  if (completedServiceYears < 10) return 3;
  return 4;
}

function completedYearsBetween(start: Date, end: Date): number {
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  const beforeAnniversary =
    end.getUTCMonth() < start.getUTCMonth() ||
    (end.getUTCMonth() === start.getUTCMonth() &&
      end.getUTCDate() < start.getUTCDate());
  if (beforeAnniversary) years -= 1;
  return Math.max(0, years);
}

function allocatedLeaveDays(
  leave: PayrollLeave,
  periodStart: Date,
  periodEnd: Date,
  workWeekdays: string,
): number {
  const weekdays = new Set(workWeekdays.split(',').map(Number));
  const count = (from: Date, to: Date) => {
    let total = 0;
    for (
      let cursor = new Date(from);
      cursor <= to;
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      const weekday = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
      if (weekdays.has(weekday)) total += 1;
    }
    return total;
  };
  const overlapFrom = leave.dateFrom > periodStart ? leave.dateFrom : periodStart;
  const overlapTo = leave.dateTo < periodEnd ? leave.dateTo : periodEnd;
  if (overlapTo < overlapFrom) return 0;
  const totalScheduledDays = count(leave.dateFrom, leave.dateTo);
  const overlapScheduledDays = count(overlapFrom, overlapTo);
  if (totalScheduledDays === 0) return 0;
  return roundMoney(
    (Number(leave.workingDays) * overlapScheduledDays) / totalScheduledDays,
  );
}

function allocateLeaveAmount(
  leave: PayrollLeave,
  periodStart: Date,
  periodEnd: Date,
  workWeekdays: string,
): number {
  const totalDays = Number(leave.workingDays);
  if (totalDays <= 0 || Number(leave.employerGrossAmount) <= 0) return 0;
  return roundMoney(
    (Number(leave.employerGrossAmount) *
      allocatedLeaveDays(leave, periodStart, periodEnd, workWeekdays)) /
      totalDays,
  );
}

function employmentYearStart(employmentStart: Date, referenceDate: Date): Date {
  let candidate = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      employmentStart.getUTCMonth(),
      employmentStart.getUTCDate(),
    ),
  );
  if (candidate > referenceDate) {
    candidate = new Date(
      Date.UTC(
        referenceDate.getUTCFullYear() - 1,
        employmentStart.getUTCMonth(),
        employmentStart.getUTCDate(),
      ),
    );
  }
  return candidate < employmentStart ? employmentStart : candidate;
}

function sum<T extends Record<K, number>, K extends keyof T>(values: T[], key: K): number {
  return roundMoney(values.reduce((total, value) => total + value[key], 0));
}

function utcDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function complianceDeadline(value: string): Date {
  return athensEndOfDay(utcDate(value));
}

function athensDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function moneyText(value: Prisma.Decimal | number | string): string {
  return Number(value).toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function safeFilename(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function csvBuffer(rows: string[][]): Buffer {
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';'))
    .join('\r\n');
  return Buffer.from(`\uFEFF${csv}\r\n`, 'utf8');
}

function earningsTypeLabel(type: string): string {
  return {
    '003': 'Δώρο Χριστουγέννων',
    '004': 'Δώρο Πάσχα',
    '005': 'Επίδομα αδείας',
    '008': 'Αποδοχές ασθενείας',
    '009': 'Αναδρομικές αποδοχές',
    '010': 'Bonus',
    '011': 'Υπερωρίες',
  }[type] ?? `Ειδικές αποδοχές ΑΠΔ ${type}`;
}

function sumDecimal<T extends Record<K, Prisma.Decimal>, K extends keyof T>(
  values: T[],
  key: K,
): number {
  return roundMoney(values.reduce((total, value) => total + Number(value[key]), 0));
}

function groupEmployeeEntries<
  T extends { employeeId: string },
>(entries: T[]): Array<{ entry: T; entries: T[] }> {
  const grouped = new Map<string, T[]>();
  entries.forEach((entry) => {
    const values = grouped.get(entry.employeeId) ?? [];
    values.push(entry);
    grouped.set(entry.employeeId, values);
  });
  return [...grouped.values()].map((values) => ({ entry: values[0], entries: values }));
}
