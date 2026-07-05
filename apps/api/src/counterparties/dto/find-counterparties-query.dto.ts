import { ApiPropertyOptional } from '@nestjs/swagger';
import { CounterpartyType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class FindCounterpartiesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientCompanyId?: string;

  @ApiPropertyOptional({ enum: CounterpartyType })
  @IsOptional()
  @IsEnum(CounterpartyType)
  type?: CounterpartyType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
