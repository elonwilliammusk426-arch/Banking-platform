import { Prisma } from '../prisma';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database.service';
import { LedgerService } from '../ledger/ledger.service';
import { BankingService } from './banking.service';

describe('BankingService balance summary', () => {
  it('returns only ledger-derived balances and groups totals by currency', async () => {
    const accounts = [
      {
        id: 'usd-account', userId: 'user-1', name: 'Checking', type: 'CHECKING', status: 'ACTIVE',
        currency: 'USD', accountNumberLast4: '1234', balance: new Prisma.Decimal('999999.00'),
        availableBalance: new Prisma.Decimal('999999.00'), version: 0, openedAt: new Date(),
        closedAt: null, createdAt: new Date(), updatedAt: new Date(),
      },
      {
        id: 'eur-account', userId: 'user-1', name: 'Euro savings', type: 'SAVINGS', status: 'ACTIVE',
        currency: 'EUR', accountNumberLast4: '5678', balance: new Prisma.Decimal('888888.00'),
        availableBalance: new Prisma.Decimal('888888.00'), version: 0, openedAt: new Date(),
        closedAt: null, createdAt: new Date(), updatedAt: new Date(),
      },
    ];
    const db = { account: { findMany: jest.fn().mockResolvedValue(accounts) } };
    const ledger = {
      balances: jest.fn().mockResolvedValue(new Map([
        ['usd-account', { ledgerBalance: new Prisma.Decimal('125.50'), availableBalance: new Prisma.Decimal('115.50'), activeHolds: new Prisma.Decimal('10.00') }],
        ['eur-account', { ledgerBalance: new Prisma.Decimal('70.25'), availableBalance: new Prisma.Decimal('70.25'), activeHolds: new Prisma.Decimal('0.00') }],
      ])),
    };
    const service = new BankingService(
      db as unknown as DatabaseService,
      {} as AuditService,
      ledger as unknown as LedgerService,
    );

    const summary = await service.summary('user-1');

    expect(summary.totalBalance).toBe('125.50');
    expect(summary.availableBalance).toBe('115.50');
    expect(summary.totalsByCurrency).toEqual({
      USD: { ledgerBalance: '125.50', availableBalance: '115.50' },
      EUR: { ledgerBalance: '70.25', availableBalance: '70.25' },
    });
    expect(summary.accounts[0]).toMatchObject({ ledgerBalance: '125.50', availableBalance: '115.50', activeHolds: '10.00' });
    expect(summary.accounts[0]).not.toHaveProperty('balance');
    expect(JSON.stringify(summary)).not.toContain('999999.00');
    expect(JSON.stringify(summary)).not.toContain('888888.00');
  });
});
