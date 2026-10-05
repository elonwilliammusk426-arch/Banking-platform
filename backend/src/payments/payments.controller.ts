import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { MovementDirection } from '../prisma';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateBeneficiaryDto, CreateMovementDto, CreatePaymentDto } from './payments.dto';
import { PaymentsService } from './payments.service';

interface ContextRequest extends Request { requestId?: string; }
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Get('beneficiaries') beneficiaries(@CurrentUser() user: AuthenticatedUser) { return this.payments.beneficiaries(user.id); }
  @Post('beneficiaries') beneficiary(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBeneficiaryDto) { return this.payments.addBeneficiary(user.id, dto); }
  @Post('transfers') transfer(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') key: string, @Body() dto: CreatePaymentDto, @Req() req: ContextRequest) { return this.payments.initiate(user.id, user.amr, key, dto, { requestId: req.requestId, ipAddress: req.ip, userAgent: req.header('user-agent') }); }
  @Get('transfers/:id/receipt') receipt(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.payments.receipt(user.id, id); }
  @Get('schedules') schedules(@CurrentUser() user: AuthenticatedUser) { return this.payments.schedules(user.id); }
  @Post('deposits') deposit(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') key: string, @Body() dto: CreateMovementDto) { return this.payments.movement(user.id, user.amr, key, MovementDirection.DEPOSIT, dto); }
  @Post('withdrawals') withdraw(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') key: string, @Body() dto: CreateMovementDto) { return this.payments.movement(user.id, user.amr, key, MovementDirection.WITHDRAWAL, dto); }
}
