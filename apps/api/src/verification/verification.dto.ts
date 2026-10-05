import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { VerificationChannel } from '@haven/database';

export class RequestVerificationDto {
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsEnum(VerificationChannel) channel: VerificationChannel;
}
export class ConfirmVerificationDto {
  @IsUUID() challengeId: string;
  @IsString() @Matches(/^\d{6}$/) code: string;
}
