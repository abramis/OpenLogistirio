import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class ApplyClientSetupTemplateDto {
  @ApiProperty({ example: 'SIMPLE_BOOKS_ELP' })
  @IsString()
  templateId!: string;

  @ApiPropertyOptional({ type: [String], example: ['JOURNAL', 'MOVEMENT_CODE'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includeKinds?: string[];
}
