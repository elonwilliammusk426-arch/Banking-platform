import { LedgerDirection, Prisma } from '@haven/database';
import { DatabaseService } from '../database.service';
import { LedgerService } from './ledger.service';

describe('LedgerService', () => {
  function setup(entries: unknown[] = [], holds: unknown[] = []) {
    const db = {
      ledgerEntry: { groupBy: jest.fn().mockResolvedValue(entries) },
      accountHold: { groupBy: jest.fn().mockResolvedValue(holds) },
    };
    return { db, service: new LedgerService(db as unknown as DatabaseService) };
  }

  it('derives ledger balance as credits minus debits and available balance minus active holds', async () => {
    const { service } = setup(
      [
        { accountId: 'account-a', direction: LedgerDirection.CREDIT, _sum: { amount: new Prisma.Decimal('150.00') } },
        { accountId: 'account-a', direction: LedgerDirection.DEBIT, _sum: { amount: new Prisma.Decimal('40.25') } },
        { accountId: 'account-b', direction: LedgerDirection.CREDIT, _sum: { amount: new Prisma.Decimal('70.00') } },
      ],
      [{ accountId: 'account-a', _sum: { amount: new Prisma.Decimal('10.50') } }],
    );

    const balances = await service.balances(['account-a', 'account-b']);

    expect(balances.get('account-a')?.ledgerBalance.toFixed(2)).toBe('109.75');
    expect(balances.get('account-a')?.activeHolds.toFixed(2)).toBe('10.50');
    expect(balances.get('account-a')?.availableBalance.toFixed(2)).toBe('99.25');
    expect(balances.get('account-b')?.ledgerBalance.toFixed(2)).toBe('70.00');
    expect(balances.get('account-b')?.availableBalance.toFixed(2)).toBe('70.00');
  });

  it('returns a zero derived balance for an account without ledger activity', async () => {
    const { service } = setup();

    const balance = await service.balance('empty-account');

    expect(balance.ledgerBalance.toFixed(2)).toBe('0.00');
    expect(balance.availableBalance.toFixed(2)).toBe('0.00');
    expect(balance.activeHolds.toFixed(2)).toBe('0.00');
  });

  it('does not query PostgreSQL when no account ids are requested', async () => {
    const { db, service } = setup();

    const balances = await service.balances([]);

    expect(balances.size).toBe(0);
    expect(db.ledgerEntry.groupBy).not.toHaveBeenCalled();
    expect(db.accountHold.groupBy).not.toHaveBeenCalled();
  });
});
