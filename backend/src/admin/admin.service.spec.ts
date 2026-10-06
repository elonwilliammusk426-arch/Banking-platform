import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database.service';
import { KycStatus, Prisma, RiskLevel, Role } from '../prisma';
import { EncryptionService } from '../security/encryption.service';
import { SupportService } from '../support/support.service';
import { LedgerService } from '../ledger/ledger.service';
import { AdminService } from './admin.service';

function service(db: object, audit: object = { record: jest.fn() }, ledger: object = {}) {
  return new AdminService(db as DatabaseService, audit as AuditService, {} as EncryptionService, {} as SupportService, ledger as LedgerService);
}

describe('AdminService', () => {
  it('assigns a role idempotently and writes an audit record', async () => {
    const assigned = { id: 'role-1', userId: 'user-1', role: Role.SUPPORT };
    const db = { userRole: { upsert: jest.fn().mockResolvedValue(assigned) } };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };

    await expect(service(db, audit).assignRole('admin-1', 'user-1', { role: Role.SUPPORT })).resolves.toBe(assigned);
    expect(db.userRole.upsert).toHaveBeenCalledWith({ where: { userId_role: { userId: 'user-1', role: Role.SUPPORT } }, create: { userId: 'user-1', role: Role.SUPPORT }, update: {} });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 'admin-1', action: 'admin.role.assigned' }));
  });

  it('rejects an invalid KYC review transition', async () => {
    const db = { kycProfile: { update: jest.fn() } };
    await expect(service(db).reviewKyc('reviewer', 'kyc-1', { decision: KycStatus.IN_REVIEW, riskLevel: RiskLevel.LOW })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.kycProfile.update).not.toHaveBeenCalled();
  });

  it('returns only ledger-derived customer balances rather than projection values', async () => {
    const account = { id: 'account-1', name: 'Checking', balance: new Prisma.Decimal(9999), availableBalance: new Prisma.Decimal(9999) };
    const db = { user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'user-1', accounts: [account] }) } };
    const ledger = { balances: jest.fn().mockResolvedValue(new Map([['account-1', { ledgerBalance: new Prisma.Decimal(25), availableBalance: new Prisma.Decimal(20), activeHolds: new Prisma.Decimal(5) }]])) };

    const result = await service(db, undefined, ledger).customer('user-1');
    expect(result.accounts[0]).toMatchObject({ ledgerBalance: '25.00', availableBalance: '20.00', activeHolds: '5.00' });
  });

  it('summarizes operational counts and completed transfer volume', async () => {
    const db = {
      user: { count: jest.fn().mockResolvedValue(12) }, account: { count: jest.fn().mockResolvedValue(8) },
      transfer: { aggregate: jest.fn().mockResolvedValue({ _count: 3, _sum: { amount: new Prisma.Decimal('450.25') } }) },
      riskAlert: { count: jest.fn().mockResolvedValue(2) }, kycProfile: { count: jest.fn().mockResolvedValue(1) },
    };
    await expect(service(db).report()).resolves.toEqual({ customers: 12, activeAccounts: 8, completedTransfers: 3, transferVolume: '450.25', openAlerts: 2, pendingKyc: 1 });
  });
});
