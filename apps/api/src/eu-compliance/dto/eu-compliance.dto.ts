import { IntrastatFlow, ViesReturnKind } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class GenerateViesReturnDto {
  @IsString()
  clientCompanyId!: string;
  @IsInt()
  @Min(2011)
  @Max(2100)
  periodYear!: number;
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;
  @IsEnum(ViesReturnKind)
  kind!: ViesReturnKind;
}

export class UpsertViesLineDto {
  @IsString()
  @Length(2, 2)
  countryCode!: string;
  @IsString()
  @Length(2, 20)
  vatNumber!: string;
  @IsOptional()
  @IsString()
  @Length(1, 200)
  counterpartyName?: string;
  @IsInt()
  @Min(0)
  goodsAmount!: number;
  @IsInt()
  @Min(0)
  triangularAmount!: number;
  @IsInt()
  @Min(0)
  servicesAmount!: number;
}

export class GenerateIntrastatReturnDto {
  @IsString()
  clientCompanyId!: string;
  @IsInt()
  @Min(2000)
  @Max(2100)
  periodYear!: number;
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;
  @ApiProperty({ enum: IntrastatFlow })
  @IsEnum(IntrastatFlow)
  flow!: IntrastatFlow;
}

export class UpsertIntrastatLineDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50000)
  lineNumber?: number;
  @Matches(/^[A-Z]{2}$/)
  countryCode!: string;
  @Matches(/^\d{2}$/)
  transactionNature!: string;
  @Matches(/^[1-5789]$/)
  transportMode!: string;
  @Matches(/^\d{8}$/)
  commodityCode!: string;
  @IsInt()
  @Min(1)
  netMassKg!: number;
  @IsInt()
  @Min(0)
  supplementaryUnits!: number;
  @IsInt()
  @Min(1)
  invoicedAmount!: number;
  @IsInt()
  @Min(1)
  statisticalValue!: number;
  @IsOptional()
  @IsString()
  @Length(1, 20)
  partnerVatNumber?: string;
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  countryOfOrigin?: string;
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  deliveryTerms?: string;
  @IsOptional()
  @IsString()
  sourceDocumentId?: string;
}

export class SubmitComplianceReturnDto {
  @IsDateString()
  submittedAt!: string;
  @IsString()
  @Length(1, 160)
  submissionProtocol!: string;
}
