import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class GenerateMonthlyObligationsDto {
  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2200)
  year!: number;

  @ApiProperty({ example: 7 })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}
