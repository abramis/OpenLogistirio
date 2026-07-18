import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateDispatchNoteLineDto {
  @ApiProperty()
  @IsString()
  itemId!: string;

  @ApiProperty({ example: 5 })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  movePurposeLine?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 150)
  otherMovePurposeLineTitle?: string;
}

export class CreateDispatchNoteDto {
  @ApiProperty()
  @IsString()
  clientCompanyId!: string;

  @ApiProperty({ example: 'ΔΑ' })
  @IsString()
  @Length(1, 40)
  series!: string;

  @ApiProperty({ example: '000001' })
  @IsString()
  @Length(1, 80)
  number!: string;

  @ApiProperty({ example: '2026-07-18' })
  @IsDateString()
  issueDate!: string;

  @ApiProperty({ example: '2026-07-18T12:30:00+03:00' })
  @IsDateString()
  plannedDispatchAt!: string;

  @ApiProperty({ minimum: 1, maximum: 20, description: 'AADE movePurpose code' })
  @IsInt()
  @Min(1)
  @Max(20)
  movePurpose!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 150)
  otherMovePurposeTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  counterpartyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  recipientName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20)
  recipientVatNumber?: string;

  @ApiProperty()
  @IsString()
  loadingWarehouseId!: string;

  @ApiPropertyOptional({ description: 'Set for warehouse-to-warehouse transfer' })
  @IsOptional()
  @IsString()
  deliveryWarehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 150)
  vehicleNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  loadingAddress?: string;

  @ApiProperty()
  @IsString()
  @Length(1, 500)
  deliveryAddress!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;

  @ApiProperty({ type: [CreateDispatchNoteLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDispatchNoteLineDto)
  lines!: CreateDispatchNoteLineDto[];
}

export class UpdateDispatchNoteDto extends PartialType(
  OmitType(CreateDispatchNoteDto, ['clientCompanyId'] as const),
) {}
