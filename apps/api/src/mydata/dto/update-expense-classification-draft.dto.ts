import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

const EXPENSE_CATEGORIES = [
  'category2_1',
  'category2_2',
  'category2_3',
  'category2_4',
  'category2_5',
  'category2_6',
  'category2_7',
  'category2_8',
  'category2_9',
  'category2_10',
  'category2_11',
  'category2_12',
  'category2_13',
  'category2_14',
  'category2_95',
] as const;

const VAT_CLASSIFICATION_TYPES = [
  'VAT_361',
  'VAT_362',
  'VAT_363',
  'VAT_364',
  'VAT_365',
  'VAT_366',
] as const;

export class ExpenseClassificationDraftLineDto {
  @IsInt()
  @Min(1)
  lineNumber!: number;

  @IsString()
  @Length(1, 40)
  expenseClassificationType!: string;

  @IsIn(EXPENSE_CATEGORIES)
  expenseClassificationCategory!: (typeof EXPENSE_CATEGORIES)[number];

  @IsOptional()
  @IsIn(VAT_CLASSIFICATION_TYPES)
  vatClassificationType?: (typeof VAT_CLASSIFICATION_TYPES)[number] | null;
}

export class UpdateExpenseClassificationDraftDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseClassificationDraftLineDto)
  lines!: ExpenseClassificationDraftLineDto[];
}
