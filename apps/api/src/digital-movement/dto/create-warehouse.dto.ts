import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty()
  @IsString()
  clientCompanyId!: string;

  @ApiProperty({ example: 'MAIN' })
  @IsString()
  @Length(1, 40)
  code!: string;

  @ApiProperty({ example: 'Κεντρική αποθήκη' })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  address?: string;

  @ApiPropertyOptional({ description: 'AADE branch number' })
  @IsOptional()
  @IsInt()
  @Min(0)
  branchNumber?: number;
}

export class UpdateWarehouseDto extends PartialType(
  OmitType(CreateWarehouseDto, ['clientCompanyId'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
