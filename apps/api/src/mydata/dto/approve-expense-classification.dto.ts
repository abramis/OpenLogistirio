import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  Equals,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export enum ExpenseClassificationApprovalActionDto {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ApproveExpenseClassificationDto {
  @IsEnum(ExpenseClassificationApprovalActionDto)
  action!: ExpenseClassificationApprovalActionDto;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  notes?: string;
}

export class BatchApproveExpenseClassificationDto extends ApproveExpenseClassificationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  documentIds!: string[];
}

export class SendExpenseClassificationBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  documentIds!: string[];

  @Equals('SEND_TO_AADE')
  confirmation!: 'SEND_TO_AADE';
}
