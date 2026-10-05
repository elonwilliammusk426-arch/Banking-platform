import { Injectable } from '@nestjs/common';
import { HoldStatus, LedgerDirection, Prisma } from '../prisma';
import { DatabaseService } from '../database.service';

export interface DerivedBalance {
  ledgerBalance: Prisma.Decimal;
  availableBalance: Prisma.Decimal;
  activeHolds: Prisma.Decimal;
}

@Injectable()
export class LedgerService {
  constructor(private readonly db: DatabaseService) {}

  async balances(accountIds: string[]): Promise<Map<string, DerivedBalance>> {
    const result = new Map<string, DerivedBalance>();
    for (const id of accountIds) result.set(id, { ledgerBalance: new Prisma.Decimal(0), availableBalance: new Prisma.Decimal(0), activeHolds: new Prisma.Decimal(0) });
    if (!accountIds.length) return result;

    const [entries, holds] = await Promise.all([
      this.db.ledgerEntry.groupBy({ by: ['accountId', 'direction'], where: { accountId: { in: accountIds } }, _sum: { amount: true } }),
      this.db.accountHold.groupBy({ by: ['accountId'], where: { accountId: { in: accountIds }, status: HoldStatus.ACTIVE }, _sum: { amount: true } }),
    ]);

    for (const entry of entries) {
      const current = result.get(entry.accountId)!;
      const amount = entry._sum.amount ?? new Prisma.Decimal(0);
      current.ledgerBalance = entry.direction === LedgerDirection.CREDIT ? current.ledgerBalance.plus(amount) : current.ledgerBalance.minus(amount);
    }
    for (const hold of holds) result.get(hold.accountId)!.activeHolds = hold._sum.amount ?? new Prisma.Decimal(0);
    for (const balance of result.values()) balance.availableBalance = balance.ledgerBalance.minus(balance.activeHolds);
    return result;
  }

  async balance(accountId: string) {
    return (await this.balances([accountId])).get(accountId)!;
  }
}
