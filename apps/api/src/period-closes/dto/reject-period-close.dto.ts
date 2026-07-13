import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RejectPeriodCloseDto {
  @ApiProperty()
  @IsString()
  @Length(3, 1000)
  reason!: string;
}
