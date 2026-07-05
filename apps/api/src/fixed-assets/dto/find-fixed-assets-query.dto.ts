import { ApiPropertyOptional } from '@nestjs/swagger';
import { FixedAssetCategory, FixedAssetStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class FindFixedAssetsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientCompanyId?: string;

  @ApiPropertyOptional({ enum: FixedAssetCategory })
  @IsOptional()
  @IsEnum(FixedAssetCategory)
  category?: FixedAssetCategory;

  @ApiPropertyOptional({ enum: FixedAssetStatus })
  @IsOptional()
  @IsEnum(FixedAssetStatus)
  status?: FixedAssetStatus;
}
