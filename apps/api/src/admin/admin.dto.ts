import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { KycStatus, RiskAlertStatus, RiskLevel, Role, TicketStatus, TransferType } from '@haven/database';

export class ReviewKycDto { @IsEnum(KycStatus) decision: KycStatus; @IsEnum(RiskLevel) riskLevel: RiskLevel; @IsOptional() @IsString() @MaxLength(500) reason?: string; }
export class UpdateRiskAlertDto { @IsEnum(RiskAlertStatus) status: RiskAlertStatus; @IsOptional() @IsUUID() assignedToId?: string; }
export class AssignRoleDto { @IsEnum(Role) role: Role; }
export class CreateFeeDto { @IsEnum(TransferType) transferType: TransferType; @IsString() currency: string; @Type(() => Number) @IsNumber() @Min(0) fixedAmount: number; @Type(() => Number) @IsNumber() @Min(0) @Max(1) percentage: number; }
export class SetConfigDto { @IsString() @MaxLength(100) key: string; @IsString() @MaxLength(5000) value: string; @IsOptional() @IsString() @MaxLength(300) description?: string; }
export class UpdateTicketDto { @IsOptional() @IsUUID() assignedToId?: string; @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus; }
