import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateDocumentCounterpartyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  counterpartyName?: string;

  @IsString()
  @Length(9, 20)
  counterpartyVatNumber!: string;
}
