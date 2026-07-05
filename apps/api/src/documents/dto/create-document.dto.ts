import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty()
  @IsString()
  clientCompanyId!: string;

  @ApiProperty({ enum: DocumentType, example: DocumentType.SALES_INVOICE })
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @ApiPropertyOptional({ example: 'A' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  series?: string;

  @ApiProperty({ example: '1001' })
  @IsString()
  @Length(1, 60)
  documentNumber!: string;

  @ApiProperty({ example: '2026-07-05' })
  @IsDateString()
  issueDate!: string;

  @ApiPropertyOptional({ example: 'Demo Customer SA' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  counterpartyName?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @IsString()
  @Length(9, 20)
  counterpartyVatNumber?: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  netAmount!: number;

  @ApiProperty({ example: 24 })
  @IsNumber()
  @Min(0)
  vatAmount!: number;

  @ApiProperty({ example: 124 })
  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @ApiProperty({ example: 'VAT_24' })
  @IsString()
  @Length(1, 40)
  vatCategory!: string;
}
