import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CounterpartyType } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class CreateCounterpartyDto {
  @ApiProperty()
  @IsString()
  clientCompanyId!: string;

  @ApiProperty({ enum: CounterpartyType, example: CounterpartyType.SUPPLIER })
  @IsEnum(CounterpartyType)
  type!: CounterpartyType;

  @ApiProperty({ example: 'Demo Supplier OE' })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  vatNumber?: string;

  @ApiPropertyOptional({ example: 'GR' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  taxOffice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 240)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(5, 30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 500)
  notes?: string;
}
