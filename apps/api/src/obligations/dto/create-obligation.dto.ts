import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ObligationRecurrence, ObligationStatus, ObligationType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateObligationDto {
  @ApiProperty()
  @IsString()
  clientCompanyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @ApiProperty({ enum: ObligationType, example: ObligationType.VAT_RETURN })
  @IsEnum(ObligationType)
  type!: ObligationType;

  @ApiProperty({ example: 'Περιοδική ΦΠΑ 07/2026' })
  @IsString()
  @Length(2, 200)
  title!: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2200)
  periodYear!: number;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth?: number;

  @ApiProperty({ example: '2026-08-31' })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ enum: ObligationStatus })
  @IsOptional()
  @IsEnum(ObligationStatus)
  status?: ObligationStatus;

  @ApiPropertyOptional({ enum: ObligationRecurrence })
  @IsOptional()
  @IsEnum(ObligationRecurrence)
  recurrence?: ObligationRecurrence;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  notes?: string;
}
