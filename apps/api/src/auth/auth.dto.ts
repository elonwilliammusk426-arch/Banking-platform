import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(2) @MaxLength(60) firstName: string;
  @IsString() @MinLength(2) @MaxLength(60) lastName: string;
  @IsString() @Matches(/^\+[1-9]\d{7,14}$/, { message: 'Phone must use E.164 format' }) phone: string;
  @IsString() @MinLength(12) @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, { message: 'Password must include upper, lower, number, and symbol' })
  password: string;
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @IsNotEmpty() @MaxLength(128) password: string;
}

export class VerifyMfaDto {
  @IsString() @MinLength(6) @MaxLength(32) code: string;
  @IsString() @MinLength(20) challengeToken: string;
}

export class ConfirmMfaSetupDto {
  @IsString() @Matches(/^\d{6}$/) code: string;
}
