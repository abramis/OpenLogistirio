import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateCollectiveAgreementDto {
  @IsOptional()
  @IsString()
  clientCompanyId?: string;
  @IsString()
  @Length(1, 80)
  code!: string;
  @IsString()
  @Length(1, 300)
  title!: string;
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  sourceUrl?: string;
  @IsArray()
  @IsString({ each: true })
  activityCodes!: string[];
  @IsArray()
  @IsString({ each: true })
  specialtyCodes!: string[];
  @IsBoolean()
  mandatory!: boolean;
  @IsInt()
  priority!: number;
}

export class CollectiveAgreementWageRuleDto {
  @IsString()
  @Length(1, 40)
  specialtyCode!: string;
  @IsString()
  @Length(1, 200)
  specialtyTitle!: string;
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumMonthlySalary?: number;
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumDailyWage?: number;
  @IsArray()
  allowanceRules!: Array<Record<string, unknown>>;
}

export class CreateCollectiveAgreementVersionDto {
  @IsString()
  @Length(1, 100)
  versionLabel!: string;
  @IsDateString()
  validFrom!: string;
  @IsOptional()
  @IsDateString()
  validTo?: string;
  @IsOptional()
  @IsNumber()
  @Min(1)
  weeklyHours?: number;
  @IsOptional()
  @IsString()
  notes?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectiveAgreementWageRuleDto)
  wageRules!: CollectiveAgreementWageRuleDto[];
}

export class EvaluateCollectiveAgreementDto {
  @IsString()
  clientCompanyId!: string;
  @IsString()
  @Length(1, 40)
  specialtyCode!: string;
  @IsDateString()
  onDate!: string;
  @IsOptional()
  @IsNumber()
  @Min(0)
  statutoryMonthlySalary?: number;
  @IsOptional()
  @IsNumber()
  @Min(0)
  statutoryDailyWage?: number;
  @IsInt()
  @Min(0)
  priorServiceYears!: number;
  @IsObject()
  allowanceInputs!: Record<string, boolean | number | string>;
}

export class ApplyCollectiveAgreementDto extends EvaluateCollectiveAgreementDto {}
