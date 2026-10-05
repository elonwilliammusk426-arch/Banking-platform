import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsString() @MinLength(4) @MaxLength(140) subject: string;
  @IsIn(['account', 'transfer', 'card', 'identity', 'security', 'other']) category: string;
  @IsString() @MinLength(2) @MaxLength(4000) message: string;
}
export class CreateMessageDto { @IsString() @MinLength(1) @MaxLength(4000) body: string; @IsOptional() internalOnly?: boolean; }
