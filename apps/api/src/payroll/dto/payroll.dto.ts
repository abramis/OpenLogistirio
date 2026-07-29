import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  ApdDeclarationType,
  PayrollCompensationType,
  PayrollEmployeeStatus,
  PayrollErganiAcceptanceMethod,
  PayrollErganiDeclarationType,
  PayrollEventType,
  PayrollLeavePaymentSource,
  PayrollLeaveType,
  PayrollSicknessBenefitStatus,
  PayrollTerminationType,
  PayrollWeeklySystem,
} from '@prisma/client';
import { OmitType, PartialType } from '@nestjs/swagger';

export class UpsertPayrollEmployerSettingsDto {
  @IsString()
  clientCompanyId!: string;

  @Matches(/^\d{10}$/)
  employerRegistryNumber!: string;

  @Matches(/^\d{1,10}$/)
  submissionOfficeCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  submissionOfficeName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  street!: string;

  @IsString()
  @MaxLength(10)
  streetNumber!: string;

  @Matches(/^\d{5}$/)
  postalCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  city!: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9]{23}$/)
  efkaPaymentRf?: string;

  @IsOptional()
  @Matches(/^[A-Za-z0-9]{25}$/)
  tekaPaymentRf?: string;
}

export class CreatePayrollEmployeeDto {
  @IsString()
  clientCompanyId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;

  @IsOptional()
  @IsEnum(PayrollEmployeeStatus)
  status?: PayrollEmployeeStatus;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  fatherName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  motherName!: string;

  @IsDateString()
  birthDate!: string;

  @Matches(/^\d{9}$/)
  afm!: string;

  @Matches(/^\d{11}$/)
  amka!: string;

  @Matches(/^\d{9}$/)
  insuranceRegistryNumber!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  dependentChildren?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  recognizedPriorServiceYears?: number;

  @IsOptional()
  @IsBoolean()
  tekaInsured?: boolean;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @Matches(/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/)
  iban?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePayrollContractDto {
  @IsString()
  employeeId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  erganiEffectiveAt!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsEnum(PayrollCompensationType)
  compensationType!: PayrollCompensationType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlySalary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  dailyWage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  statutoryMonthlySalary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  statutoryDailyWage?: number;

  @IsOptional()
  @IsBoolean()
  fullTime?: boolean;

  @IsOptional()
  @IsEnum(PayrollWeeklySystem)
  weeklySystem?: PayrollWeeklySystem;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(40)
  weeklyHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  workDaysPerWeek?: number;

  @IsOptional()
  @Matches(/^[1-7](,[1-7])*$/)
  workWeekdays?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  dailyStartTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  dailyEndTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  breakMinutes?: number;

  @IsOptional()
  @IsBoolean()
  breakWithinWorkingTime?: boolean;

  @IsOptional()
  @IsBoolean()
  digitalCardEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  flexibleArrivalMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  apdBranchNumber?: number;

  @Matches(/^\d{4}$/)
  apdKad!: string;

  @Matches(/^\d{6}$/)
  apdSpecialtyCode!: string;

  @IsOptional()
  @Matches(/^\d{2}$/)
  apdSpecialInsuranceCase?: string;

  @IsOptional()
  @Matches(/^\d{1,4}$/)
  apdCoveragePackageCode?: string;

  @IsOptional()
  @Matches(/^\d{2}$/)
  externalSupplementaryFund?: string;

  @IsOptional()
  @Matches(/^\d{2}$/)
  externalHealthFund?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100)
  employeeContributionRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100)
  employerContributionRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PayrollEntryOverrideDto {
  @IsString()
  employeeId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(31)
  insuranceDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  overtimeGross?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(744)
  nightHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(744)
  sundayHolidayHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(80)
  extraWorkHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(124)
  legalOvertimeHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(124)
  approvedOvertimeHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(124)
  illegalOvertimeHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(124)
  partTimeAdditionalHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  overtimeErganiProtocol?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  bonusGross?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otherGross?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otherDeductions?: number;

  @IsOptional()
  @Matches(/^\d{3}$/)
  apdEarningsType?: string;
}

export class CalculatePayrollPeriodDto {
  @IsString()
  clientCompanyId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2026)
  @Max(2026)
  periodYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsOptional()
  @IsEnum(ApdDeclarationType)
  declarationType?: ApdDeclarationType;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PayrollEntryOverrideDto)
  overrides?: PayrollEntryOverrideDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class MarkPayrollPaidDto {
  @IsDateString()
  paymentDate!: string;
}

export class UpdatePayrollComplianceDeadlinesDto {
  @IsOptional()
  @IsDateString()
  apdSubmissionDeadline?: string;

  @IsOptional()
  @IsDateString()
  contributionsPaymentDeadline?: string;

  @IsOptional()
  @IsDateString()
  fmySubmissionDeadline?: string;
}

export class CompleteApdSubmissionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  protocol!: string;

  @IsDateString()
  submittedAt!: string;
}

export class MarkContributionsPaidDto {
  @IsDateString()
  paymentDate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  paymentReference!: string;
}

export class CompleteFmySubmissionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  protocol!: string;

  @IsDateString()
  submittedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  debtId?: string;
}

export class MarkFmyPaidDto {
  @IsDateString()
  paymentDate!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  paymentReference!: string;
}

export class UpdatePayrollEmployeeDto extends PartialType(
  OmitType(CreatePayrollEmployeeDto, ['clientCompanyId'] as const),
) {}

export class UpdatePayrollContractDto extends PartialType(
  OmitType(CreatePayrollContractDto, ['employeeId'] as const),
) {
  @IsOptional()
  @IsEnum(PayrollErganiDeclarationType)
  erganiDeclarationType?: PayrollErganiDeclarationType;
}

export class CreatePayrollErganiDeclarationDto {
  @IsString()
  employeeId!: string;

  @IsEnum(PayrollErganiDeclarationType)
  type!: PayrollErganiDeclarationType;

  @IsDateString()
  effectiveAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompletePayrollErganiDeclarationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  erganiProtocol!: string;

  @IsDateString()
  erganiSubmittedAt!: string;

  @IsOptional()
  @IsEnum(PayrollErganiAcceptanceMethod)
  acceptanceMethod?: PayrollErganiAcceptanceMethod;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  acceptanceReference?: string;

  @IsOptional()
  @IsDateString()
  acceptedAt?: string;
}

export class CreatePayrollEventDto {
  @IsString()
  employeeId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2026)
  @Max(2026)
  periodYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsEnum(PayrollEventType)
  type!: PayrollEventType;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(31)
  insuranceDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(31)
  leaveDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  efkaBenefit?: number;

  @IsOptional()
  @IsEnum(PayrollSicknessBenefitStatus)
  sicknessBenefitStatus?: PayrollSicknessBenefitStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  medicalCertificateReference?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  grossAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePayrollSicknessDto {
  @IsEnum(PayrollSicknessBenefitStatus)
  sicknessBenefitStatus!: PayrollSicknessBenefitStatus;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  efkaBenefit!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(31)
  insuranceDays?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  medicalCertificateReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePayrollLeaveDto {
  @IsString()
  employeeId!: string;

  @IsEnum(PayrollLeaveType)
  type!: PayrollLeaveType;

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(366)
  workingDays!: number;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @IsEnum(PayrollLeavePaymentSource)
  paymentSource?: PayrollLeavePaymentSource;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  employerGrossAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  employeeRequestReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  externalBenefitReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  erganiProtocol?: string;

  @IsOptional()
  @IsDateString()
  erganiSubmittedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePayrollTerminationDto {
  @IsString()
  employeeId!: string;

  @IsEnum(PayrollTerminationType)
  type!: PayrollTerminationType;

  @IsDateString()
  terminationDate!: string;

  @IsOptional()
  @IsBoolean()
  withNotice?: boolean;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  regularMonthlyEarnings!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  severanceAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompletePayrollTerminationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  erganiProtocol!: string;

  @IsDateString()
  erganiSubmittedAt!: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentReference?: string;
}
