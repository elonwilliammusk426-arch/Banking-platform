import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, Min, IsNumber, ValidateIf } from 'class-validator';

export class CreateTransferDto {
  @IsUUID() fromAccountId: string;
  @IsOptional() @IsUUID() toAccountId?: string;
  @ValidateIf((value) => !value.toAccountId)
  @IsString() @MaxLength(120) externalRecipientName?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2, allowInfinity: false, allowNaN: false }) @Min(0.01) amount: number;
  @IsOptional() @IsString() @MaxLength(140) note?: string;
}
