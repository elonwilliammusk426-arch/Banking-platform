import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, AccountType, IdentifierType, KycStatus } from '@haven/database';
import { randomInt } from 'node:crypto';
import { DatabaseService } from '../database.service';
import { EncryptionService } from '../security/encryption.service';
import { AuditService } from '../audit/audit.service';
import { OpenAccountDto } from './accounts.dto';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class AccountsService {
  constructor(private readonly db: DatabaseService, private readonly encryption: EncryptionService, private readonly audit: AuditService, private readonly ledger: LedgerService) {}

  async list(userId: string) {
    const accounts = await this.db.account.findMany({ where: { userId, status: { not: AccountStatus.CLOSED } }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, type: true, status: true, currency: true, accountNumberLast4: true, openedAt: true } });
    const derived = await this.ledger.balances(accounts.map((account) => account.id));
    return accounts.map((account) => { const balance = derived.get(account.id)!; return { ...account, ledgerBalance: balance.ledgerBalance.toFixed(2), availableBalance: balance.availableBalance.toFixed(2), activeHolds: balance.activeHolds.toFixed(2) }; });
  }
  async detail(userId: string, id: string) {
    const account = await this.db.account.findFirst({ where: { id, userId }, select: { id: true, name: true, type: true, status: true, currency: true, accountNumberLast4: true, openedAt: true, closedAt: true, holds: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } }, limits: { where: { active: true } } } });
    if (!account) throw new NotFoundException('Account not found');
    const balance = await this.ledger.balance(account.id);
    return { ...account, ledgerBalance: balance.ledgerBalance.toFixed(2), availableBalance: balance.availableBalance.toFixed(2), activeHolds: balance.activeHolds.toFixed(2) };
  }
  async identifiers(userId: string, id: string) {
    const account = await this.db.account.findFirst({ where: { id, userId }, include: { identifiers: true } });
    if (!account) throw new NotFoundException('Account not found');
    return account.identifiers.map((item) => ({ type: item.type, value: this.encryption.decryptJson<string>(item.encryptedValue), last4: item.last4, countryCode: item.countryCode }));
  }
  async transactions(userId: string, id: string, cursor?: string) {
    if (!(await this.db.account.findFirst({ where: { id, userId } }))) throw new NotFoundException('Account not found');
    const items = await this.db.transaction.findMany({ where: { accountId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    return { items: items.slice(0, 50), nextCursor: items.length > 50 ? items[49]?.id : null };
  }
  async statements(userId: string, id: string) {
    if (!(await this.db.account.findFirst({ where: { id, userId } }))) throw new NotFoundException('Account not found');
    return this.db.statement.findMany({ where: { accountId: id }, orderBy: { periodEnd: 'desc' }, take: 36 });
  }
  async open(userId: string, dto: OpenAccountDto) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId }, include: { kycProfile: true } });
    if (user.kycProfile?.status !== KycStatus.APPROVED) throw new BadRequestException('Complete KYC before opening an account');
    if (![AccountType.CHECKING, AccountType.SAVINGS, AccountType.VAULT].includes(dto.type)) throw new BadRequestException('Unsupported account type');
    const number = Array.from({ length: 12 }, () => randomInt(0, 10)).join('');
    const account = await this.db.account.create({ data: { userId, name: dto.name ?? (dto.type === AccountType.SAVINGS ? 'Growth savings' : 'Everyday checking'), type: dto.type, currency: dto.currency, accountNumberLast4: number.slice(-4), identifiers: { create: [
      { type: IdentifierType.ACCOUNT_NUMBER, encryptedValue: this.encryption.encryptJson(number), last4: number.slice(-4), countryCode: 'US' },
      { type: IdentifierType.ROUTING_NUMBER, encryptedValue: this.encryption.encryptJson('021000021'), last4: '0021', countryCode: 'US' },
      ...(dto.currency !== 'USD' ? [{ type: IdentifierType.SWIFT_BIC, encryptedValue: this.encryption.encryptJson('HAVNUS33'), last4: 'US33', countryCode: 'US' }] : []),
    ] } } });
    await this.audit.record({ actorUserId: userId, action: 'account.opened', entityType: 'account', entityId: account.id, metadata: { type: dto.type, currency: dto.currency } });
    const { balance: _projectionBalance, availableBalance: _projectionAvailable, ...safeAccount } = account;
    const balance = await this.ledger.balance(account.id);
    return { ...safeAccount, ledgerBalance: balance.ledgerBalance.toFixed(2), availableBalance: balance.availableBalance.toFixed(2), activeHolds: balance.activeHolds.toFixed(2) };
  }
}
