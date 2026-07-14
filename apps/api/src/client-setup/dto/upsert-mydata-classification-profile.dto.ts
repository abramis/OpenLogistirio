import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UpsertMyDataClassificationProfileDto {
  @ApiProperty({ example: 'SALES_SERVICES' })
  @IsString()
  @Length(1, 80)
  code!: string;

  @ApiProperty({ example: 'Έσοδα υπηρεσιών' })
  @IsString()
  @Length(1, 200)
  name!: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ApiPropertyOptional({ example: 'SALE_INVOICE' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  movementCode?: string;

  @ApiPropertyOptional({ example: 'VAT_24' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  vatCategory?: string;

  @ApiPropertyOptional({ example: 'SERV-001' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  itemCode?: string;

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

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(-1000)
  @Max(1000)
  priority?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
