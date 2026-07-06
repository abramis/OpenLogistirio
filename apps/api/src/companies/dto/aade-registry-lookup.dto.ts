import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class AadeRegistryLookupDto {
  @ApiProperty({ example: '123456789' })
  @IsString()
  @Length(9, 9)
  vatNumber!: string;
}
