import { AuditService } from '../audit/audit.service';
import { BankingService } from '../banking/banking.service';
import { DatabaseService } from '../database.service';
import { BANK_RAIL_PROVIDER, BankRailProvider } from '../integrations/provider.interfaces';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EncryptionService } from '../security/encryption.service';
import { AccountStatus, Prisma, TransactionStatus, TransferStatus, TransferType } from '../prisma';
import { PaymentsService } from './payments.service';

describe('PaymentsService provider failure and reversal', () => {
  it('atomically restores funds, creates a reversal credit, and marks related records failed/reversed', async () => {
    const transfer = { id: 'transfer-1', status: TransferStatus.PROCESSING, amount: new Prisma.Decimal(100), feeAmount: new Prisma.Decimal(2), currency: 'USD', createdAt: new Date(), processedAt: null };
    const tx = {
      account: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue({}) },
      transfer: { create: jest.fn().mockResolvedValue(transfer), update: jest.fn().mockResolvedValue({}) },
      ledgerEntry: {
        create: jest.fn().mockResolvedValue({}),
        findFirstOrThrow: jest.fn().mockResolvedValue({ currency: 'USD', balanceBefore: new Prisma.Decimal(500), balanceAfter: new Prisma.Decimal(398) }),
      },
      transaction: { create: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      transferEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      transfer: { findUnique: jest.fn().mockResolvedValue(null), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Prisma.Decimal(0) } }), update: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue({ kycProfile: { status: 'APPROVED' } }) },
      beneficiary: { findFirst: jest.fn().mockResolvedValue({ id: 'beneficiary-1', legalName: 'Vendor', transferType: TransferType.ACH, currency: 'USD', encryptedBankDetails: 'encrypted' }) },
      account: { findFirst: jest.fn().mockResolvedValue({ id: 'account-1', status: AccountStatus.ACTIVE, currency: 'USD', version: 4 }) },
      transactionLimit: { findMany: jest.fn().mockResolvedValue([]) },
      feeSchedule: { findFirst: jest.fn().mockResolvedValue({ fixedAmount: new Prisma.Decimal(2), percentage: new Prisma.Decimal(0), minimumFee: null, maximumFee: null }) },
      $transaction: jest.fn().mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const rails = { initiate: jest.fn().mockRejectedValue(new Error('provider offline')) };
    const ledger = { balance: jest.fn().mockResolvedValue({ ledgerBalance: new Prisma.Decimal(500), availableBalance: new Prisma.Decimal(500), activeHolds: new Prisma.Decimal(0) }) };
    const service = new PaymentsService(
      db as unknown as DatabaseService, {} as EncryptionService, { record: jest.fn() } as unknown as AuditService,
      { notify: jest.fn() } as unknown as NotificationsService, {} as BankingService, ledger as unknown as LedgerService,
      rails as unknown as BankRailProvider,
    );
    expect(BANK_RAIL_PROVIDER).toBeDefined();

    await expect(service.initiate('user-1', ['pwd'], 'idempotency-key-1234', { fromAccountId: 'account-1', beneficiaryId: 'beneficiary-1', amount: 100 }, {})).rejects.toThrow('provider offline');

    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.account.update).toHaveBeenCalledWith({ where: { id: 'account-1' }, data: { balance: new Prisma.Decimal(500), availableBalance: new Prisma.Decimal(500), version: { increment: 1 } } });
    expect(tx.ledgerEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({ direction: 'CREDIT', referenceType: 'TRANSFER_REVERSAL', amount: new Prisma.Decimal(102) }) });
    expect(tx.transfer.update).toHaveBeenCalledWith({ where: { id: 'transfer-1' }, data: { status: TransferStatus.FAILED, failureReason: 'Provider initiation failed' } });
    expect(tx.transaction.updateMany).toHaveBeenCalledWith({ where: { externalReference: 'transfer-1' }, data: { status: TransactionStatus.REVERSED } });
  });
});
