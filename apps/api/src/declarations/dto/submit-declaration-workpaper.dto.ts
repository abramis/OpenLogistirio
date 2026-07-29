import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  ValidateNested,
  Max,
  Min,
} from 'class-validator';

export class DeclarationAttachmentDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsUrl({ require_tld: false })
  @Length(1, 2000)
  url!: string;
}

export class VatTaxPaymentDto {
  @IsInt()
  @Min(1)
  @Max(2)
  installmentNumber!: number;

  @IsDateString()
  dueDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}

export class VatDeclarationResultDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  payableAmount!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditCarryForward!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  refundClaim!: number;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  debtId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VatTaxPaymentDto)
  payments!: VatTaxPaymentDto[];
}

export class SubmitDeclarationWorkpaperDto {
  @ApiProperty({ example: '123456789012' })
  @IsString()
  @Length(1, 160)
  submissionReference!: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsDateString()
  submissionDate!: string;

  @ApiPropertyOptional({ type: [DeclarationAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeclarationAttachmentDto)
  attachments?: DeclarationAttachmentDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 4000)
  notes?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  submissionDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => VatDeclarationResultDto)
  vatResult?: VatDeclarationResultDto;
}

export class PayDeclarationTaxPaymentDto {
  @IsDateString()
  paidAt!: string;

  @IsString()
  @Length(1, 160)
  paymentReference!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;
}
