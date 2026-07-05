import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FixedAssetCategory } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateFixedAssetDto {
  @ApiProperty()
  @IsString()
  clientCompanyId!: string;

  @ApiProperty({ example: 'FA-0001' })
  @IsString()
  @Length(1, 40)
  code!: string;

  @ApiProperty({ example: 'Laptop Lenovo ThinkPad' })
  @IsString()
  @Length(2, 200)
  description!: string;

  @ApiPropertyOptional({ enum: FixedAssetCategory, example: FixedAssetCategory.EQUIPMENT })
  @IsOptional()
  @IsEnum(FixedAssetCategory)
  category?: FixedAssetCategory;

  @ApiProperty({ example: '2026-07-01' })
  @IsDateString()
  acquisitionDate!: string;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  depreciationStartDate?: string;

  @ApiPropertyOptional({ example: 'ΤΠΥ-145' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  acquisitionDocumentNumber?: string;

  @ApiPropertyOptional({ example: 'Demo Supplier OE' })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  supplierName?: string;

  @ApiProperty({ example: 1200 })
  @IsNumber()
  @Min(0)
  netValue!: number;

  @ApiProperty({ example: 288 })
  @IsNumber()
  @Min(0)
  vatAmount!: number;

  @ApiProperty({ example: 1488 })
  @IsNumber()
  @Min(0)
  totalValue!: number;

  @ApiProperty({ example: 20 })
  @IsNumber()
  @Min(0)
  @Max(100)
  depreciationRate!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  notes?: string;
}
