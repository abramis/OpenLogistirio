import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateJournalEntryLineDto {
  @ApiProperty({ example: '30.00' })
  @IsString()
  @Length(1, 40)
  accountCode!: string;

  @ApiPropertyOptional({ example: 'Πελάτης παραστατικού' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  description?: string;

  @ApiPropertyOptional({ example: 124 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  debit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  credit?: number;

  @ApiPropertyOptional({ example: 'VAT_24' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  taxCode?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty()
  @IsString()
  clientCompanyId!: string;

  @ApiProperty({ example: '2026-07-07' })
  @IsDateString()
  entryDate!: string;

  @ApiProperty({ example: 'Τακτοποιητική εγγραφή' })
  @IsString()
  @Length(2, 200)
  description!: string;

  @ApiPropertyOptional({ example: 'MAN-2026-0001' })
  @IsOptional()
  @IsString()
  @Length(1, 80)
  reference?: string;

  @ApiProperty({ type: [CreateJournalEntryLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryLineDto)
  lines!: CreateJournalEntryLineDto[];
}
