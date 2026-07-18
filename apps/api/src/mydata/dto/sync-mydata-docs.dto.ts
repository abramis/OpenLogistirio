import { Type } from 'class-transformer';
import { MyDataReconciliationStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export enum SyncMyDataDocsSourceDto {
  REQUEST_DOCS = 'REQUEST_DOCS',
  REQUEST_TRANSMITTED_DOCS = 'REQUEST_TRANSMITTED_DOCS',
}

export class SyncMyDataDocsDto {
  @IsString()
  clientCompanyId!: string;

  @IsEnum(SyncMyDataDocsSourceDto)
  source: SyncMyDataDocsSourceDto = SyncMyDataDocsSourceDto.REQUEST_DOCS;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  mark?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  counterVatNumber?: string;

  @IsOptional()
  @IsString()
  invType?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  maxMark?: string;

  @IsOptional()
  @IsString()
  nextPartitionKey?: string;

  @IsOptional()
  @IsString()
  nextRowKey?: string;
}

export class SyncOfficeMyDataDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clientCompanyIds?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(SyncMyDataDocsSourceDto, { each: true })
  sources?: SyncMyDataDocsSourceDto[];

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxPages?: number = 10;

  @IsOptional()
  @IsBoolean()
  incremental?: boolean = false;
}

export class OfficeMyDataDashboardQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(SyncMyDataDocsSourceDto)
  source?: SyncMyDataDocsSourceDto;

  @IsOptional()
  @IsEnum(MyDataReconciliationStatus)
  status?: MyDataReconciliationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number = 100;
}

export class FindMyDataReconciliationQueryDto {
  @IsString()
  clientCompanyId!: string;

  @IsOptional()
  @IsEnum(SyncMyDataDocsSourceDto)
  source?: SyncMyDataDocsSourceDto;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  take?: number;
}
