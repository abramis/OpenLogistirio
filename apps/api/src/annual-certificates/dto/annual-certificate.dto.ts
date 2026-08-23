import { AnnualCertificateKind } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class GenerateAnnualCertificateDto {
  @ApiProperty()
  @IsString()
  clientCompanyId!: string;

  @ApiProperty({ example: 2025 })
  @IsInt()
  @Min(2019)
  @Max(2100)
  fiscalYear!: number;

  @ApiProperty({ enum: AnnualCertificateKind })
  @IsEnum(AnnualCertificateKind)
  kind!: AnnualCertificateKind;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  createAmending?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 30)
  declarantName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 9)
  declarantFirstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 3)
  declarantFatherName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  declarantIsLegalEntity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 16)
  businessActivity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 10)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 16)
  street?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 5)
  streetNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{5}$/)
  postalCode?: string;
}

export class SubmitAnnualCertificateDto {
  @IsDateString()
  submittedAt!: string;

  @IsString()
  @Length(1, 160)
  submissionProtocol!: string;
}
