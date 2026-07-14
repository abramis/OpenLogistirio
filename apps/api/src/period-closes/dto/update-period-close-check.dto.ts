import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUrl, Length, ValidateNested } from 'class-validator';

export class PeriodCloseCheckAttachmentDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsUrl({ require_tld: false })
  @Length(1, 2000)
  url!: string;
}

export class UpdatePeriodCloseCheckDto {
  @ApiProperty({ example: 'SUPPORTING_DOCUMENTS_REVIEWED' })
  @IsString()
  @Length(1, 80)
  code!: string;

  @ApiProperty()
  @IsBoolean()
  completed!: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  note?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PeriodCloseCheckAttachmentDto)
  attachments?: PeriodCloseCheckAttachmentDto[];
}
