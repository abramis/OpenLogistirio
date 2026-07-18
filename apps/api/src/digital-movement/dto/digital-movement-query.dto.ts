import { ApiPropertyOptional } from '@nestjs/swagger';
import { DispatchNoteStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CompanyScopedQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientCompanyId?: string;
}

export class FindDispatchNotesQueryDto extends CompanyScopedQueryDto {
  @ApiPropertyOptional({ enum: DispatchNoteStatus })
  @IsOptional()
  @IsEnum(DispatchNoteStatus)
  status?: DispatchNoteStatus;
}

export class FindStockMovementsQueryDto extends CompanyScopedQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
