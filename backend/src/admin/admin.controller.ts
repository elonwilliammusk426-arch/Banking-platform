import { Body, Controller, Get, Header, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role, TransferStatus } from '../prisma';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../security/roles.decorator';
import { RolesGuard } from '../security/roles.guard';
import { CreateMessageDto } from '../support/support.dto';
import { AdminService } from './admin.service';
import { AssignRoleDto, CreateFeeDto, ReviewKycDto, SetConfigDto, UpdateRiskAlertDto, UpdateTicketDto } from './admin.dto';

@Controller('admin') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT, Role.KYC_REVIEWER, Role.RISK_ANALYST, Role.OPERATIONS)
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('reports/summary') report() { return this.admin.report(); }
  @Get('customers') customers(@Query('search') search?: string) { return this.admin.customers(search); }
  @Get('customers/:id') @Header('Cache-Control', 'no-store, private') customer(@Param('id') id: string) { return this.admin.customer(id); }
  @Post('customers/:id/roles') @Roles(Role.ADMIN, Role.SUPER_ADMIN) role(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: AssignRoleDto) { return this.admin.assignRole(actor.id, id, dto); }
  @Get('kyc') @Roles(Role.KYC_REVIEWER, Role.ADMIN, Role.SUPER_ADMIN) kyc() { return this.admin.kycQueue(); }
  @Patch('kyc/:id') @Roles(Role.KYC_REVIEWER, Role.ADMIN, Role.SUPER_ADMIN) review(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReviewKycDto) { return this.admin.reviewKyc(actor.id, id, dto); }
  @Get('transactions') transactions() { return this.admin.transactions(); }
  @Get('transfers') transfers(@Query('status') status?: TransferStatus) { return this.admin.transfers(status); }
  @Post('transfers/:id/approve') @Roles(Role.OPERATIONS, Role.ADMIN, Role.SUPER_ADMIN) approve(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) { return this.admin.approveTransfer(actor.id, id); }
  @Get('risk-alerts') alerts() { return this.admin.alerts(); }
  @Patch('risk-alerts/:id') updateAlert(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateRiskAlertDto) { return this.admin.updateAlert(actor.id, id, dto); }
  @Get('cards') cards() { return this.admin.cards(); }
  @Get('tickets') tickets() { return this.admin.tickets(); }
  @Patch('tickets/:id') ticket(@Param('id') id: string, @Body() dto: UpdateTicketDto) { return this.admin.updateTicket(id, dto); }
  @Post('tickets/:id/messages') reply(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateMessageDto) { return this.admin.replyTicket(actor.id, id, dto); }
  @Get('fees') fees() { return this.admin.fees(); }
  @Post('fees') @Roles(Role.ADMIN, Role.SUPER_ADMIN) fee(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateFeeDto) { return this.admin.createFee(actor.id, dto); }
  @Get('audit-logs') @Roles(Role.ADMIN, Role.SUPER_ADMIN) audits() { return this.admin.auditLogs(); }
  @Post('config') @Roles(Role.SUPER_ADMIN) config(@CurrentUser() actor: AuthenticatedUser, @Body() dto: SetConfigDto) { return this.admin.setConfig(actor.id, dto); }
}
