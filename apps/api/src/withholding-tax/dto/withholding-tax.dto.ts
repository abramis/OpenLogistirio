import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { WithholdingTaxCategory } from '@prisma/client';

export class GenerateWithholdingTaxReturnDto {
  @IsString()
  clientCompanyId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  periodYear!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsEnum(WithholdingTaxCategory)
  category!: WithholdingTaxCategory;

  @IsOptional()
  @IsBoolean()
  createAmending?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  declarantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  declarantFirstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  declarantFatherName?: string;

  @IsOptional()
  @IsBoolean()
  declarantIsLegalEntity?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  businessActivity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  streetNumber?: string;

  @IsOptional()
  @Matches(/^\d{5}$/)
  postalCode?: string;
}

export class UpdateWithholdingTaxReturnDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  declarantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  declarantFirstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  declarantFatherName?: string;

  @IsOptional()
  @IsBoolean()
  declarantIsLegalEntity?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  businessActivity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  street?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  streetNumber?: string;

  @IsOptional()
  @Matches(/^\d{5}$/)
  postalCode?: string;

  @IsOptional()
  @IsDateString()
  submissionDeadline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string;
}

export class UpsertWithholdingTaxLineDto {
  @IsOptional()
  @Matches(/^\d{9}$/)
  beneficiaryVatNumber?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(18)
  beneficiaryLastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  beneficiaryFirstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  beneficiaryFatherName?: string;

  @IsOptional()
  @Matches(/^\d{11}$/)
  beneficiarySocialSecurity?: string;

  @IsOptional()
  @IsBoolean()
  foreignWithoutGreekVat?: boolean;

  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @Matches(/^\d{1,2}$/)
  incomeCode!: string;

  @IsDateString()
  paymentDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  grossAmount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deductionsAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100)
  withholdingRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  withheldTaxAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @IsIn([0, 1.2, 2.4, 3.6])
  digitalFeeRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  digitalFeeOgaAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  exemptionLawArticle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  exemptionLawNumber?: string;

  @IsOptional()
  @Matches(/^\d{4}$/)
  exemptionLawYear?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class SubmitWithholdingTaxReturnDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  fileProtocol!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  submissionReference!: string;

  @IsDateString()
  submittedAt!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  payableAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  debtId?: string;
}

export class PayWithholdingTaxReturnDto {
  @IsDateString()
  paidAt!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  paymentReference!: string;
}
