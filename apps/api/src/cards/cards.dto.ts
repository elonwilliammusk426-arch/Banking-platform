import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { CardType } from '@haven/database';

export class IssueCardDto { @IsUUID() accountId: string; @IsEnum(CardType) type: CardType; }
export class ActivateCardDto { @IsString() last4: string; }
export class UpdateCardControlsDto {
  @IsOptional() @IsBoolean() onlineEnabled?: boolean;
  @IsOptional() @IsBoolean() internationalEnabled?: boolean;
  @IsOptional() @IsBoolean() contactlessEnabled?: boolean;
  @IsOptional() @IsBoolean() atmEnabled?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(100000) perTransactionLimit?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(250000) dailyLimit?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(1000000) monthlyLimit?: number;
}
