import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccountType } from '../prisma';

export class OpenAccountDto {
  @IsEnum(AccountType) type: AccountType;
  @IsIn(['USD', 'EUR', 'GBP', 'CAD']) currency: string;
  @IsOptional() @IsString() @MaxLength(60) name?: string;
}
