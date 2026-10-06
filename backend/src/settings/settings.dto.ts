import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class UpdateUserPreferenceDto {
  @IsOptional() @IsString() @Matches(/^[a-z]{2}(-[A-Z]{2})?$/) language?: string;
  @IsOptional() @IsString() @MaxLength(80) timezone?: string;
  @IsOptional() @IsIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']) dateFormat?: string;
  @IsOptional() @IsIn(['LIGHT', 'DARK', 'SYSTEM']) theme?: string;
  @IsOptional() @IsBoolean() emailNotifications?: boolean;
  @IsOptional() @IsBoolean() pushNotifications?: boolean;
  @IsOptional() @IsBoolean() smsNotifications?: boolean;
  @IsOptional() @IsBoolean() marketingMessages?: boolean;
}

export class UpdateSecuritySettingDto {
  @IsOptional() @IsBoolean() loginAlerts?: boolean;
  @IsOptional() @IsBoolean() transactionAlerts?: boolean;
  @IsOptional() @IsBoolean() trustedDeviceAlerts?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(1440) sessionTimeoutMinutes?: number;
}

export class UpdateAccountSettingDto {
  @IsOptional() @IsString() @MaxLength(60) nickname?: string;
  @IsOptional() @IsBoolean() paperlessStatements?: boolean;
  @IsOptional() @IsBoolean() transactionAlerts?: boolean;
  @IsOptional() @IsBoolean() lowBalanceAlert?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) lowBalanceThreshold?: number;
}

export class SetDeviceTrustDto {
  @IsBoolean() trusted!: boolean;
}
