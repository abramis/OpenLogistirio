import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SeedDefaultChartDto {
  @ApiProperty()
  @IsString()
  clientCompanyId!: string;

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2200)
  fiscalYear?: number;
}
