import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import {
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateDocumentLineDto } from './create-document-line.dto';
import { CreateDocumentPaymentDto } from './create-document-payment.dto';

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

  @ApiPropertyOptional({ example: 'SALE_INVOICE' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  movementCode?: string;

  @ApiPropertyOptional({ example: 'SALES' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  journalCode?: string;

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

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 8, default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  paymentMethodType?: number;

  @ApiPropertyOptional({ type: [CreateDocumentPaymentDto] })
  @IsOptional()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentPaymentDto)
  payments?: CreateDocumentPaymentDto[];

  @ApiPropertyOptional({ example: 27, minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  vatExemptionCategory?: number;

  @ApiPropertyOptional({ example: '400001234567890' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  @Matches(/^\d+$/, { message: 'correlatedInvoiceMark must contain digits only.' })
  correlatedInvoiceMark?: string;

  @ApiPropertyOptional({ example: 20, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  withheldAmount?: number;

  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 18 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(18)
  withheldCategory?: number;

  @ApiPropertyOptional({ example: 0.07, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  feesAmount?: number;

  @ApiPropertyOptional({ example: 8, minimum: 1, maximum: 22 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(22)
  feesCategory?: number;

  @ApiPropertyOptional({ example: 1.2, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stampDutyAmount?: number;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  stampDutyCategory?: number;

  @ApiPropertyOptional({ example: 5, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  otherTaxesAmount?: number;

  @ApiPropertyOptional({ example: 17, minimum: 1, maximum: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  otherTaxesCategory?: number;

  @ApiPropertyOptional({ example: 2, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deductionsAmount?: number;

  @ApiPropertyOptional({ description: 'Cancelled document replaced by this invoice.' })
  @IsOptional()
  @IsString()
  replacesDocumentId?: string;

  @ApiPropertyOptional({ description: 'Original document corrected by this credit note.' })
  @IsOptional()
  @IsString()
  correctsDocumentId?: string;

  @ApiPropertyOptional({ type: [CreateDocumentLineDto] })
  @IsOptional()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDocumentLineDto)
  lines?: CreateDocumentLineDto[];
}
