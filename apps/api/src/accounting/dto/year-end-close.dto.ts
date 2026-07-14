import { IsInt, IsString, Length, Max, Min } from 'class-validator';

export class YearEndCloseDto {
  @IsString()
  clientCompanyId!: string;

  @IsInt()
  @Min(2000)
  @Max(2200)
  fiscalYear!: number;

  @IsString()
  @Length(1, 40)
  resultAccountCode!: string;

  @IsString()
  @Length(1, 40)
  retainedEarningsAccountCode!: string;
}
