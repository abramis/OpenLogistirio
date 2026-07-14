import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  ValidateNested,
} from 'class-validator';

export class DeclarationAttachmentDto {
  @IsString()
  @Length(1, 160)
  name!: string;

  @IsUrl({ require_tld: false })
  @Length(1, 2000)
  url!: string;
}

export class SubmitDeclarationWorkpaperDto {
  @ApiProperty({ example: '123456789012' })
  @IsString()
  @Length(1, 160)
  submissionReference!: string;

  @ApiProperty({ example: '2026-07-31' })
  @IsDateString()
  submissionDate!: string;

  @ApiPropertyOptional({ type: [DeclarationAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeclarationAttachmentDto)
  attachments?: DeclarationAttachmentDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 4000)
  notes?: string;
}
