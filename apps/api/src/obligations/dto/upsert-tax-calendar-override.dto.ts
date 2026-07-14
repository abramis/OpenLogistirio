import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
} from 'class-validator';

export class UpsertTaxCalendarOverrideDto {
  @IsString() taxCalendarRuleId!: string;
  @IsInt() @Min(2000) @Max(2200) periodYear!: number;
  @IsInt() @Min(1) @Max(12) periodMonth!: number;
  @IsDateString() dueDate!: string;
  @IsOptional() @IsUrl({ require_tld: false }) sourceUrl?: string;
  @IsOptional() @IsString() @Length(1, 4000) notes?: string;
}
