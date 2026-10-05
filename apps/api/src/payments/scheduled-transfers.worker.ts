import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ScheduleFrequency } from '@haven/database';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database.service';
import { RedisService } from '../redis/redis.service';
import { PaymentsService } from './payments.service';

@Injectable()
export class ScheduledTransfersWorker {
  constructor(private readonly db: DatabaseService, private readonly redis: RedisService, private readonly payments: PaymentsService) {}

  @Cron('0 * * * * *')
  async processDue() {
    const lock = await this.redis.setNx('worker:scheduled-transfers', randomUUID(), 55).catch(() => null);
    if (!lock) return;
    const due = await this.db.scheduledTransfer.findMany({ where: { active: true, nextRunAt: { lte: new Date() }, OR: [{ endAt: null }, { endAt: { gte: new Date() } }] }, orderBy: { nextRunAt: 'asc' }, take: 25 });
    for (const schedule of due) {
      const runAt = schedule.nextRunAt;
      try {
        await this.payments.initiate(schedule.userId, ['pwd', 'mfa'], `scheduled:${schedule.id}:${runAt.toISOString()}`, { fromAccountId: schedule.fromAccountId, beneficiaryId: schedule.beneficiaryId, amount: schedule.amount.toNumber(), note: schedule.note ?? undefined }, {});
        const next = this.nextRun(runAt, schedule.frequency);
        await this.db.scheduledTransfer.update({ where: { id: schedule.id }, data: { lastRunAt: new Date(), active: schedule.frequency !== ScheduleFrequency.ONCE && (!schedule.endAt || next <= schedule.endAt), nextRunAt: next } });
      } catch {
        // Keep the item due for retry. Idempotency prevents a duplicate financial write.
      }
    }
  }

  private nextRun(current: Date, frequency: ScheduleFrequency) {
    const next = new Date(current);
    if (frequency === ScheduleFrequency.WEEKLY) next.setUTCDate(next.getUTCDate() + 7);
    else if (frequency === ScheduleFrequency.BIWEEKLY) next.setUTCDate(next.getUTCDate() + 14);
    else if (frequency === ScheduleFrequency.MONTHLY) next.setUTCMonth(next.getUTCMonth() + 1);
    else next.setUTCFullYear(next.getUTCFullYear() + 100);
    return next;
  }
}
