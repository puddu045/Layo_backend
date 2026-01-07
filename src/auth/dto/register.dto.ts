import {
  IsEmail,
  IsNotEmpty,
  IsDateString,
  IsStrongPassword,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'First name is required' })
  @MinLength(2, { message: 'First name must be at least 2 characters long' })
  @MaxLength(50, { message: 'First name must be at most 50 characters long' })
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message: 'First name can only contain letters',
  })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Last name is required' })
  @MinLength(2, { message: 'Last name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Last name must be at most 50 characters long' })
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message: 'Last name can only contain letters',
  })
  lastName: string;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  @Transform(({ value }) => value.toLowerCase().trim())
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsStrongPassword(
    {
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    { message: 'Password is not strong enough' },
  )
  password: string;

  @IsDateString()
  dateOfBirth: string;
}
