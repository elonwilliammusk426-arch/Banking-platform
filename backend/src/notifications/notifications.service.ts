import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationStatus, Prisma } from '../prisma';
import { DatabaseService } from '../database.service';
import { MESSAGE_PROVIDER, MessageProvider } from '../integrations/provider.interfaces';

@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService, @Inject(MESSAGE_PROVIDER) private readonly provider: MessageProvider) {}

  async notify(userId: string, input: { channel?: NotificationChannel; templateKey: string; title: string; body: string; data?: Record<string, unknown> }) {
    const channel = input.channel ?? NotificationChannel.IN_APP;
    const notification = await this.db.notification.create({ data: { userId, channel, templateKey: input.templateKey, title: input.title, body: input.body, data: input.data as Prisma.InputJsonValue | undefined } });
    if (channel === NotificationChannel.IN_APP) return this.db.notification.update({ where: { id: notification.id }, data: { status: NotificationStatus.DELIVERED, sentAt: new Date() } });
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    const destination = channel === NotificationChannel.SMS ? user.phone : user.email;
    if (!destination) return this.db.notification.update({ where: { id: notification.id }, data: { status: NotificationStatus.FAILED } });
    try {
      await this.provider.send({ channel: channel === NotificationChannel.SMS ? 'PHONE' : channel === NotificationChannel.PUSH ? 'PUSH' : 'EMAIL', destination, template: input.templateKey, variables: { title: input.title, body: input.body } });
      return this.db.notification.update({ where: { id: notification.id }, data: { status: NotificationStatus.SENT, sentAt: new Date() } });
    } catch {
      return this.db.notification.update({ where: { id: notification.id }, data: { status: NotificationStatus.FAILED } });
    }
  }

  list(userId: string) { return this.db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 }); }
  async markRead(userId: string, id: string) {
    const updated = await this.db.notification.updateMany({ where: { id, userId }, data: { status: NotificationStatus.READ, readAt: new Date() } });
    if (!updated.count) throw new NotFoundException('Notification not found');
    return { success: true };
  }
}
