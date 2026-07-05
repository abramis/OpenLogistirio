import { ApiPropertyOptional } from '@nestjs/swagger';
import { ObligationStatus, ObligationType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class FindObligationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientCompanyId?: string;

  @ApiPropertyOptional({ enum: ObligationType })
  @IsOptional()
  @IsEnum(ObligationType)
  type?: ObligationType;

  @ApiPropertyOptional({ enum: ObligationStatus })
  @IsOptional()
  @IsEnum(ObligationStatus)
  status?: ObligationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueTo?: string;
}
