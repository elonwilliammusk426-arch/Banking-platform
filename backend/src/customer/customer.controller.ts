import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CustomerService } from './customer.service';
import { UpdateProfileDto } from './customer.dto';

@Controller('customer')
@UseGuards(JwtAuthGuard)
export class CustomerController {
  constructor(private readonly customer: CustomerService) {}
  @Get('profile') profile(@CurrentUser() user: AuthenticatedUser) { return this.customer.profile(user.id); }
  @Patch('profile') update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) { return this.customer.update(user.id, dto); }
  @Get('sessions') sessions(@CurrentUser() user: AuthenticatedUser) { return this.customer.sessions(user.id); }
  @Delete('sessions/:id') revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.customer.revokeSession(user.id, id); }
}
