import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ConfirmPasswordResetDto {
  @ApiProperty()
  @IsString()
  @Length(32, 200)
  token!: string;

  @ApiProperty()
  @IsString()
  @Length(8, 120)
  newPassword!: string;
}
