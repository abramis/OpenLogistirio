import { ApiPropertyOptional } from '@nestjs/swagger';
import { ObligationRecurrence, ObligationType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpsertTaxCalendarRuleDto {
  @IsString() @Length(1, 80) code!: string;
  @IsString() @Length(1, 200) name!: string;
  @IsEnum(ObligationType) obligationType!: ObligationType;
  @IsEnum(ObligationRecurrence) recurrence!: ObligationRecurrence;
  @IsInt() @Min(0) @Max(24) dueMonthOffset!: number;
  @IsInt() @Min(0) @Max(31) dueDay!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 80) applicableMonths?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 40) accountingCategory?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 40) vatRegime?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) sourceUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 4000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
