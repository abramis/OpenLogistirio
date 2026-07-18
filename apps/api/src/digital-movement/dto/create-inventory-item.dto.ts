import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateInventoryItemDto {
  @ApiProperty()
  @IsString()
  clientCompanyId!: string;

  @ApiProperty({ example: 'ITEM-001' })
  @IsString()
  @Length(1, 50)
  code!: string;

  @ApiProperty({ example: 'Εμπόρευμα Α' })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  description?: string;

  @ApiProperty({ example: 1, description: 'AADE quantity type (1-7)' })
  @IsInt()
  @Min(1)
  @Max(7)
  measurementUnit!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;
}

export class UpdateInventoryItemDto extends PartialType(
  OmitType(CreateInventoryItemDto, ['clientCompanyId'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
