import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { MovementMethod, ScheduleFrequency, TransferType } from '../prisma';

export class CreateBeneficiaryDto {
  @IsString() @MaxLength(60) nickname: string;
  @IsString() @MaxLength(120) legalName: string;
  @IsEnum(TransferType) transferType: TransferType;
  @IsString() @MaxLength(3) currency: string;
  @IsOptional() @IsUUID() internalAccountId?: string;
  @IsOptional() @IsString() @MaxLength(120) bankName?: string;
  @IsOptional() @IsString() @MaxLength(34) accountNumber?: string;
  @IsOptional() @IsString() @MaxLength(34) routingOrSwift?: string;
  @IsOptional() @IsString() @MaxLength(2) countryCode?: string;
}
export class CreatePaymentDto {
  @IsUUID() fromAccountId: string;
  @IsUUID() beneficiaryId: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
  @IsOptional() @IsString() @MaxLength(140) note?: string;
  @IsOptional() @IsISO8601() executeAt?: string;
  @IsOptional() @IsEnum(ScheduleFrequency) frequency?: ScheduleFrequency;
}
export class CreateMovementDto {
  @IsUUID() accountId: string;
  @IsEnum(MovementMethod) method: MovementMethod;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
}
