import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType, MyDataStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class FindDocumentsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientCompanyId?: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ApiPropertyOptional({ enum: MyDataStatus })
  @IsOptional()
  @IsEnum(MyDataStatus)
  myDataStatus?: MyDataStatus;

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
