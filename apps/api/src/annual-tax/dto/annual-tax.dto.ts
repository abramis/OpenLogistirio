import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AnnualTaxReturnKind } from '@prisma/client';

export class GenerateAnnualTaxReturnDto {
  @IsString()
  clientCompanyId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  fiscalYear!: number;

  @IsOptional()
  @IsEnum(AnnualTaxReturnKind)
  kind?: AnnualTaxReturnKind;

  @IsOptional()
  @IsBoolean()
  createAmending?: boolean;
}

export class AnnualTaxChecklistDto {
  @IsBoolean()
  booksReconciled!: boolean;

  @IsBoolean()
  myDataReviewed!: boolean;

  @IsBoolean()
  depreciationsReviewed!: boolean;

  @IsBoolean()
  inventoryReviewed!: boolean;

  @IsBoolean()
  taxAdjustmentsReviewed!: boolean;

  @IsBoolean()
  formsReviewed!: boolean;
}

export class UpdateAnnualTaxReturnDto {
  @IsOptional()
  @IsBoolean()
  includesE2?: boolean;

  @IsOptional()
  @IsBoolean()
  includesE3?: boolean;

  @IsOptional()
  @IsDateString()
  submissionDeadline?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  nonDeductibleExpenses?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxExemptIncome?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otherTaxAdditions?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otherTaxDeductions?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  priorTaxLosses?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AnnualTaxChecklistDto)
  checklist?: AnnualTaxChecklistDto;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  adjustmentNotes?: string;
}

export class AnnualTaxInstallmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  installmentNumber!: number;

  @IsDateString()
  dueDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;
}

export class SubmitAnnualTaxReturnDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  submissionReference!: string;

  @IsDateString()
  submittedAt!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  assessmentReference!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  debtId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  assessedIncomeTax!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  taxPrepayment!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  otherAssessedAmounts!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalPayable!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  refundAmount!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnnualTaxInstallmentDto)
  installments!: AnnualTaxInstallmentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  submissionNotes?: string;
}

export class PayAnnualTaxInstallmentDto {
  @IsDateString()
  paidAt!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  paymentReference!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
