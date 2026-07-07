import { IsBoolean, IsOptional } from 'class-validator';

export class SendMyDataDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
