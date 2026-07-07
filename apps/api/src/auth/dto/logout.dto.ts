import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class LogoutDto {
  @ApiProperty()
  @IsString()
  @Length(20, 2000)
  refreshToken!: string;
}
