import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';

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
