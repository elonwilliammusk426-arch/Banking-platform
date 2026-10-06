import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database.service';
import { AccountStatus, Prisma, TransferStatus } from '../prisma';
import { LedgerService } from '../ledger/ledger.service';
import { BankingService } from './banking.service';

const source = { id: 'source', userId: 'user-1', status: AccountStatus.ACTIVE, currency: 'USD', version: 2 };
const target = { id: 'target', status: AccountStatus.ACTIVE, currency: 'USD' };
const created = { id: 'transfer-1', status: TransferStatus.COMPLETED, amount: new Prisma.Decimal(25), currency: 'USD', createdAt: new Date(), processedAt: new Date(), initiatedBy: 'user-1' };

function setup(options: { updateCount?: number; credits?: string; debits?: string; holds?: string } = {}) {
  const tx = {
    account: {
      findFirst: jest.fn().mockResolvedValue(source), findUnique: jest.fn().mockResolvedValue(target),
      updateMany: jest.fn().mockResolvedValue({ count: options.updateCount ?? 1 }), update: jest.fn().mockResolvedValue({}),
    },
    ledgerEntry: {
      aggregate: jest.fn().mockImplementation(({ where }: { where: { accountId: string; direction: string } }) => {
        if (where.accountId === 'source' && where.direction === 'CREDIT') return { _sum: { amount: new Prisma.Decimal(options.credits ?? '100') } };
        if (where.accountId === 'source' && where.direction === 'DEBIT') return { _sum: { amount: new Prisma.Decimal(options.debits ?? '10') } };
        return { _sum: { amount: new Prisma.Decimal(0) } };
      }),
      create: jest.fn().mockResolvedValue({}),
    },
    accountHold: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(options.holds ?? '5') } }) },
    transfer: { create: jest.fn().mockResolvedValue(created) },
    transaction: { create: jest.fn().mockResolvedValue({}) },
  };
  const db = {
    user: { findUnique: jest.fn().mockResolvedValue({ kycProfile: { status: 'APPROVED' } }) },
    transfer: { findUnique: jest.fn().mockResolvedValue(null) }, transferEvent: { create: jest.fn().mockReturnValue({ op: 'event' }) },
    transactionReceipt: { upsert: jest.fn().mockReturnValue({ op: 'receipt' }) },
    $transaction: jest.fn().mockImplementation(async (input: unknown, config?: unknown) => typeof input === 'function' ? input(tx) : input),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return { db, tx, audit, service: new BankingService(db as unknown as DatabaseService, audit as unknown as AuditService, {} as LedgerService) };
}

const dto = { fromAccountId: 'source', toAccountId: 'target', amount: 25, note: 'Savings' };

describe('BankingService database transactions', () => {
  it('executes debit, credit, double-entry ledger writes, and transfer rows in one serializable transaction', async () => {
    const { db, tx, service } = setup();
    await expect(service.transfer('user-1', 'idempotency-key-1234', dto, {}, ['pwd'])).resolves.toMatchObject({ id: 'transfer-1', amount: '25.00' });

    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    expect(tx.account.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'source', version: 2, status: AccountStatus.ACTIVE } }));
    expect(tx.ledgerEntry.create).toHaveBeenCalledTimes(2);
    expect(tx.transaction.create).toHaveBeenCalledTimes(2);
    expect(tx.transfer.create).toHaveBeenCalledTimes(1);
  });

  it('fails before writes when active holds leave insufficient available funds', async () => {
    const { tx, service } = setup({ credits: '30', debits: '0', holds: '10' });
    await expect(service.transfer('user-1', 'idempotency-key-1234', dto, {}, ['pwd'])).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.account.updateMany).not.toHaveBeenCalled();
    expect(tx.transfer.create).not.toHaveBeenCalled();
  });

  it('aborts on optimistic concurrency conflict so no ledger entry is written', async () => {
    const { tx, service } = setup({ updateCount: 0 });
    await expect(service.transfer('user-1', 'idempotency-key-1234', dto, {}, ['pwd'])).rejects.toBeInstanceOf(ConflictException);
    expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
    expect(tx.transfer.create).not.toHaveBeenCalled();
  });

  it('requires MFA for high-value transfers before opening a database transaction', async () => {
    const { db, service } = setup();
    await expect(service.transfer('user-1', 'idempotency-key-1234', { ...dto, amount: 1000 }, {}, ['pwd'])).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('returns an owned idempotent replay without creating duplicate ledger entries', async () => {
    const { db, tx, service } = setup();
    db.transfer.findUnique.mockResolvedValue(created);
    await expect(service.transfer('user-1', 'idempotency-key-1234', dto, {}, ['pwd'])).resolves.toMatchObject({ id: 'transfer-1' });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
  });
});
