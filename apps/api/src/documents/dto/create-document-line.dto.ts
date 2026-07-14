import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateDocumentLineDto {
  @ApiPropertyOptional({ example: 'SERV-001' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  itemCode?: string;

  @ApiPropertyOptional({ example: 'Υπηρεσίες λογιστικής υποστήριξης' })
  @IsOptional()
  @IsString()
  @Length(1, 300)
  description?: string;

  @ApiPropertyOptional({ example: 2, minimum: 0.001 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity?: number;

  @ApiPropertyOptional({ example: 1, description: 'AADE measurement unit (1-7)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  measurementUnit?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  netAmount!: number;

  @ApiProperty({ example: 24 })
  @IsNumber()
  @Min(0)
  vatAmount!: number;

  @ApiProperty({ example: 'VAT_24' })
  @IsString()
  @Length(1, 40)
  vatCategory!: string;

  @ApiPropertyOptional({ example: 27, minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  vatExemptionCategory?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  discountOption?: boolean;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  withheldAmount?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(18)
  withheldCategory?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  feesAmount?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(22)
  feesCategory?: number;

  @ApiPropertyOptional({ example: 1.2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stampDutyAmount?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  stampDutyCategory?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  otherTaxesAmount?: number;

  @ApiPropertyOptional({ example: 17 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  otherTaxesCategory?: number;

  @ApiPropertyOptional({ example: 0.2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  deductionsAmount?: number;

  @ApiPropertyOptional({ example: 'E3_561_001' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  incomeClassificationType?: string;

  @ApiPropertyOptional({ example: 'category1_1' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  incomeClassificationCategory?: string;

  @ApiPropertyOptional({ example: 'E3_102_001' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  expenseClassificationType?: string;

  @ApiPropertyOptional({ example: 'category2_4' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  expenseClassificationCategory?: string;

  @ApiPropertyOptional({ example: 'VAT_361' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  vatClassificationType?: string;
}
