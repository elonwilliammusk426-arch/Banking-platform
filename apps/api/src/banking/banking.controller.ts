import { Body, Controller, Get, Header, Headers, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BankingService } from './banking.service';
import { CreateTransferDto } from './banking.dto';

interface ContextRequest extends Request { requestId?: string; }

@Controller('banking')
@UseGuards(JwtAuthGuard)
export class BankingController {
  constructor(private readonly banking: BankingService) {}

  @Get('summary')
  @Header('Cache-Control', 'no-store, private')
  summary(@CurrentUser() user: AuthenticatedUser) { return this.banking.summary(user.id); }

  @Get('transactions')
  transactions(@CurrentUser() user: AuthenticatedUser, @Query('accountId') accountId?: string, @Query('cursor') cursor?: string) {
    return this.banking.transactions(user.id, accountId, cursor);
  }

  @Post('transfers')
  transfer(@CurrentUser() user: AuthenticatedUser, @Headers('idempotency-key') key: string, @Body() dto: CreateTransferDto, @Req() req: ContextRequest) {
    return this.banking.transfer(user.id, key, dto, { ipAddress: req.ip, userAgent: req.header('user-agent'), requestId: req.requestId }, user.amr);
  }
}
