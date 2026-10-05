import { Body, Controller, ForbiddenException, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { AccountsService } from './accounts.service';
import { OpenAccountDto } from './accounts.dto';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}
  @Get()
  @Header('Cache-Control', 'no-store, private')
  list(@CurrentUser() user: AuthenticatedUser) { return this.accounts.list(user.id); }
  @Post() open(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenAccountDto) { return this.accounts.open(user.id, dto); }
  @Get(':id')
  @Header('Cache-Control', 'no-store, private')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.accounts.detail(user.id, id); }
  @Get(':id/identifiers') identifiers(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { if (!user.amr.includes('mfa')) throw new ForbiddenException('MFA is required to reveal account details'); return this.accounts.identifiers(user.id, id); }
  @Get(':id/transactions') transactions(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query('cursor') cursor?: string) { return this.accounts.transactions(user.id, id, cursor); }
  @Get(':id/statements') statements(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.accounts.statements(user.id, id); }
}
