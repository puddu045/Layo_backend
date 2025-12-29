import { IsEmail, IsNotEmpty, MinLength, IsDateString } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  email: string;

  @MinLength(8)
  password: string;

  @IsDateString()
  dateOfBirth: string;
}
