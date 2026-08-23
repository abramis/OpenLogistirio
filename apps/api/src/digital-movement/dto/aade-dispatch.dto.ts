import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { DeliveryOutcome } from '@prisma/client';

export class RegisterAadeTransferDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  transportType!: number;

  @IsString()
  @Length(9, 9)
  carrierVatNumber!: string;

  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @IsOptional()
  @IsString()
  pNumber?: string;
}

export class ConfirmAadeDeliveryDto {
  @IsEnum(DeliveryOutcome)
  outcome!: DeliveryOutcome;

  @IsOptional()
  @IsBoolean()
  deliveredWithoutRecipient?: boolean;
}

export class RejectAadeDeliveryDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
