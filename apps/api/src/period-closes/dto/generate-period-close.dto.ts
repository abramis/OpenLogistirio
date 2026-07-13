import { ApiProperty } from '@nestjs/swagger';
import { PeriodCloseKind } from '@prisma/client';
import { IsEnum, IsInt, IsString, Max, Min } from 'class-validator';

export class GeneratePeriodCloseDto {
  @ApiProperty()
  @IsString()
  clientCompanyId!: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2200)
  year!: number;

  @ApiProperty({ enum: PeriodCloseKind })
  @IsEnum(PeriodCloseKind)
  kind!: PeriodCloseKind;

  @ApiProperty({ example: 7, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  endMonth!: number;
}
