import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @Length(8, 120)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @Length(8, 120)
  newPassword!: string;
}
