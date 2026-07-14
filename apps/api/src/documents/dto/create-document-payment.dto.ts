import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CreateDocumentPaymentDto {
  @ApiProperty({ example: 3, minimum: 1, maximum: 8 })
  @IsInt()
  @Min(1)
  @Max(8)
  type!: number;

  @ApiProperty({ example: 124 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'POS front desk' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  paymentMethodInfo?: string;

  @ApiPropertyOptional({ example: 'txn-1234' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  transactionId?: string;

  @ApiPropertyOptional({ example: 'POS-001' })
  @IsOptional()
  @IsString()
  @Length(1, 200)
  tid?: string;

  @ApiPropertyOptional({ example: 'provider-id' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  providerSigningAuthor?: string;

  @ApiPropertyOptional({ example: 'provider-signature' })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  providerSignature?: string;

  @ApiPropertyOptional({ example: 'ECR123' })
  @IsOptional()
  @IsString()
  @Length(1, 15)
  ecrSigningAuthor?: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  ecrSessionNumber?: string;
}
