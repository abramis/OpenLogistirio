import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString, Length } from 'class-validator';

export class UpdatePeriodCloseCheckDto {
  @ApiProperty({ example: 'SUPPORTING_DOCUMENTS_REVIEWED' })
  @IsString()
  @Length(1, 80)
  code!: string;

  @ApiProperty()
  @IsBoolean()
  completed!: boolean;
}
