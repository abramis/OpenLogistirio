import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsString, Length } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.gr' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Ελένη Λογίστρια' })
  @IsString()
  @Length(2, 160)
  fullName!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ACCOUNTANT })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @Length(8, 120)
  password!: string;
}
