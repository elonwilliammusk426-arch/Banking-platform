import { Injectable, NotFoundException } from '@nestjs/common';
import { interval, map, merge, Subject } from 'rxjs';
import { DatabaseService } from '../database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMessageDto, CreateTicketDto } from './support.dto';

@Injectable()
export class SupportService {
  private readonly streams = new Map<string, Subject<MessageEvent>>();
  constructor(private readonly db: DatabaseService, private readonly notifications: NotificationsService) {}
  list(userId: string) { return this.db.supportTicket.findMany({ where: { customerId: userId }, include: { messages: { where: { internalOnly: false }, orderBy: { createdAt: 'asc' }, take: 10 } }, orderBy: { updatedAt: 'desc' } }); }
  async create(userId: string, dto: CreateTicketDto) { return this.db.supportTicket.create({ data: { customerId: userId, subject: dto.subject, category: dto.category, messages: { create: { authorUserId: userId, body: dto.message } } }, include: { messages: true } }); }
  async messages(userId: string, ticketId: string) { await this.owned(userId, ticketId); return this.db.supportMessage.findMany({ where: { ticketId, internalOnly: false }, orderBy: { createdAt: 'asc' } }); }
  async message(userId: string, ticketId: string, dto: CreateMessageDto, staff = false) { const ticket = staff ? await this.db.supportTicket.findUnique({ where: { id: ticketId } }) : await this.owned(userId, ticketId); if (!ticket) throw new NotFoundException('Ticket not found'); const message = await this.db.supportMessage.create({ data: { ticketId, authorUserId: userId, body: dto.body, internalOnly: staff ? Boolean(dto.internalOnly) : false } }); await this.db.supportTicket.update({ where: { id: ticketId }, data: { updatedAt: new Date(), status: staff ? 'WAITING_ON_CUSTOMER' : 'OPEN' } }); if (!message.internalOnly) this.stream(ticketId).next({ data: message } as MessageEvent); if (staff) await this.notifications.notify(ticket.customerId, { templateKey: 'support_reply', title: 'New support reply', body: `There is a new reply on “${ticket.subject}”.` }); return message; }
  async eventStream(userId: string, ticketId: string) { await this.owned(userId, ticketId); return merge(this.stream(ticketId).asObservable(), interval(25_000).pipe(map(() => ({ type: 'heartbeat', data: { at: new Date().toISOString() } } as MessageEvent)))); }
  private stream(id: string) { let subject = this.streams.get(id); if (!subject) { subject = new Subject<MessageEvent>(); this.streams.set(id, subject); } return subject; }
  private async owned(userId: string, id: string) { const ticket = await this.db.supportTicket.findFirst({ where: { id, customerId: userId } }); if (!ticket) throw new NotFoundException('Ticket not found'); return ticket; }
}
