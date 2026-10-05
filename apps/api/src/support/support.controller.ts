import { Body, Controller, Get, MessageEvent, Param, Post, Sse, UseGuards } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMessageDto, CreateTicketDto } from './support.dto';
import { SupportService } from './support.service';

@Controller('support') @UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly support: SupportService) {}
  @Get('tickets') list(@CurrentUser() user: AuthenticatedUser) { return this.support.list(user.id); }
  @Post('tickets') create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTicketDto) { return this.support.create(user.id, dto); }
  @Get('tickets/:id/messages') messages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.support.messages(user.id, id); }
  @Post('tickets/:id/messages') message(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateMessageDto) { return this.support.message(user.id, id, dto); }
  @Sse('tickets/:id/stream') async stream(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Observable<MessageEvent>> { return this.support.eventStream(user.id, id); }
}
