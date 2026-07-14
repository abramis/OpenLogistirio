import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeclarationWorkpaperPeriodKind } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateVatWorkpaperDto {
  @ApiProperty()
  @IsString()
  clientCompanyId!: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2200)
  year!: number;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({
    enum: DeclarationWorkpaperPeriodKind,
    default: DeclarationWorkpaperPeriodKind.MONTHLY,
  })
  @IsOptional()
  @IsEnum(DeclarationWorkpaperPeriodKind)
  periodKind?: DeclarationWorkpaperPeriodKind;
}
