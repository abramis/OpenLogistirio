import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientEntityType, MyDataTransmissionMode } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Demo Εμπορική ΙΚΕ' })
  @IsString()
  @Length(2, 200)
  legalName!: string;

  @ApiPropertyOptional({ example: 'Demo Trade' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  tradeName?: string;

  @ApiPropertyOptional({ enum: ClientEntityType, example: ClientEntityType.COMPANY })
  @IsOptional()
  @IsEnum(ClientEntityType)
  entityType?: ClientEntityType;

  @ApiPropertyOptional({ example: 'Λογιστής - φοροτεχνικός' })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  professionLabel?: string;

  @ApiProperty({ example: '123456789' })
  @IsString()
  @Length(9, 9)
  vatNumber!: string;

  @ApiPropertyOptional({ example: 'Α Αθηνών' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  taxOffice?: string;

  @ApiPropertyOptional({ type: [String], example: ['69200000'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activityCodes?: string[];

  @ApiPropertyOptional({ example: 'Σταδίου 10, Αθήνα' })
  @IsOptional()
  @IsString()
  @Length(1, 240)
  address?: string;

  @ApiPropertyOptional({ example: 'info@example.gr' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+302101234567' })
  @IsOptional()
  @IsString()
  @Length(5, 30)
  phone?: string;

  @ApiPropertyOptional({ example: 'NORMAL' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  vatRegime?: string;

  @ApiPropertyOptional({ example: 'SIMPLE_BOOKS' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  accountingCategory?: string;

  @ApiPropertyOptional({
    enum: MyDataTransmissionMode,
    example: MyDataTransmissionMode.ACCOUNTING_OFFICE_AUTHORIZED,
  })
  @IsOptional()
  @IsEnum(MyDataTransmissionMode)
  myDataMode?: MyDataTransmissionMode;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  myDataAuthorized?: boolean;

  @ApiPropertyOptional({
    example: 'CLIENT_111222333',
    description:
      'Environment variable prefix for client-owned AADE API credentials. Never store raw credentials.',
  })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  @Matches(/^[A-Z0-9_]+$/)
  myDataCredentialRef?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStart?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearEnd?: number;
}
