import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Length, NotEquals } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty()
  @IsString()
  warehouseId!: string;

  @ApiProperty()
  @IsString()
  itemId!: string;

  @ApiProperty({ example: 25, description: 'Signed adjustment quantity' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @NotEquals(0)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}
