import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, HoldStatus, LedgerDirection, Prisma, TransactionStatus, TransactionType, Transfer, TransferStatus } from '../prisma';
import { DatabaseService } from '../database.service';
import { AuditService } from '../audit/audit.service';
import { CreateTransferDto } from './banking.dto';
import { randomBytes } from 'node:crypto';
import { LedgerService } from '../ledger/ledger.service';

interface RequestMeta { ipAddress?: string; userAgent?: string; requestId?: string; }

@Injectable()
export class BankingService {
  constructor(private readonly db: DatabaseService, private readonly audit: AuditService, private readonly ledger: LedgerService) {}

  async summary(userId: string) {
    const accounts = await this.db.account.findMany({ where: { userId, status: { not: AccountStatus.CLOSED } }, orderBy: { createdAt: 'asc' } });
    const derived = await this.ledger.balances(accounts.map((account) => account.id));
    const primaryCurrency = accounts.some((account) => account.currency === 'USD') ? 'USD' : accounts[0]?.currency ?? 'USD';
    const totalsByCurrency = new Map<string, { ledger: Prisma.Decimal; available: Prisma.Decimal }>();
    for (const account of accounts) {
      const balance = derived.get(account.id)!;
      const total = totalsByCurrency.get(account.currency) ?? { ledger: new Prisma.Decimal(0), available: new Prisma.Decimal(0) };
      total.ledger = total.ledger.plus(balance.ledgerBalance); total.available = total.available.plus(balance.availableBalance);
      totalsByCurrency.set(account.currency, total);
    }
    const primary = totalsByCurrency.get(primaryCurrency) ?? { ledger: new Prisma.Decimal(0), available: new Prisma.Decimal(0) };
    const result = {
      totalBalance: primary.ledger.toFixed(2), availableBalance: primary.available.toFixed(2), currency: primaryCurrency,
      totalsByCurrency: Object.fromEntries([...totalsByCurrency].map(([currency, value]) => [currency, { ledgerBalance: value.ledger.toFixed(2), availableBalance: value.available.toFixed(2) }])),
      accounts: accounts.map((account) => { const balance = derived.get(account.id)!; return { id: account.id, name: account.name, type: account.type, status: account.status, last4: account.accountNumberLast4, ledgerBalance: balance.ledgerBalance.toFixed(2), availableBalance: balance.availableBalance.toFixed(2), activeHolds: balance.activeHolds.toFixed(2), currency: account.currency }; }),
    };
    return result;
  }

  async transactions(userId: string, accountId?: string, cursor?: string) {
    if (accountId && !(await this.db.account.findFirst({ where: { id: accountId, userId } }))) throw new NotFoundException('Account not found');
    const items = await this.db.transaction.findMany({
      where: { account: { userId }, ...(accountId ? { accountId } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 26,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > 25; const page = items.slice(0, 25);
    return { items: page.map((item) => ({ ...item, amount: item.amount.toFixed(2) })), nextCursor: hasMore ? page.at(-1)?.id : null };
  }

  async transfer(userId: string, idempotencyKey: string, dto: CreateTransferDto, meta: RequestMeta, amr: string[] = ['pwd']) {
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) throw new BadRequestException('A valid Idempotency-Key header is required');
    const customer = await this.db.user.findUnique({ where: { id: userId }, include: { kycProfile: true } });
    if (customer?.kycProfile?.status !== 'APPROVED') throw new ForbiddenException('KYC approval is required for transfers');
    if (!dto.toAccountId) throw new BadRequestException('Direct transfers support Haven accounts only; add a beneficiary for bank transfers');
    if (dto.toAccountId === dto.fromAccountId) throw new BadRequestException('Source and destination accounts must differ');
    const existing = await this.db.transfer.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.initiatedBy !== userId) throw new ConflictException('Idempotency key already used');
      return this.serializeTransfer(existing);
    }

    const amount = new Prisma.Decimal(dto.amount.toFixed(2));
    if (amount.greaterThanOrEqualTo(1000) && !amr.includes('mfa')) throw new ForbiddenException('MFA is required to authorize this transfer');
    let created: Transfer | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { created = await this.createTransferTransaction(userId, idempotencyKey, dto, amount); break; }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const replay = await this.db.transfer.findUnique({ where: { idempotencyKey } });
          if (replay?.initiatedBy === userId) return this.serializeTransfer(replay);
        }
        throw error;
      }
    }
    if (!created) throw new ConflictException('Transfer could not be completed');
    await this.db.$transaction([
      this.db.transferEvent.create({ data: { transferId: created.id, fromStatus: TransferStatus.CREATED, toStatus: TransferStatus.COMPLETED, actorUserId: userId } }),
      this.db.transactionReceipt.upsert({ where: { transferId: created.id }, create: { transferId: created.id, receiptNumber: `HVN-${new Date().getUTCFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}` }, update: {} }),
    ]);
    await this.audit.record({ actorUserId: userId, action: 'banking.transfer.created', entityType: 'transfer', entityId: created.id, ...meta, metadata: { fromAccountId: dto.fromAccountId, toAccountId: dto.toAccountId ?? null, amount: amount.toFixed(2), currency: 'USD' } });
    return this.serializeTransfer(created);
  }

  private createTransferTransaction(userId: string, idempotencyKey: string, dto: CreateTransferDto, amount: Prisma.Decimal) {
    return this.db.$transaction(async (tx) => {
      const source = await tx.account.findFirst({ where: { id: dto.fromAccountId, userId } });
      if (!source) throw new NotFoundException('Source account not found');
      if (source.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Source account is unavailable');
      const sourceBalance = await this.transactionBalance(tx, source.id);
      if (sourceBalance.available.lessThan(amount)) throw new BadRequestException('Insufficient available funds');
      const target = dto.toAccountId ? await tx.account.findUnique({ where: { id: dto.toAccountId } }) : null;
      if (dto.toAccountId && !target) throw new NotFoundException('Destination account not found');
      if (target && (target.status !== AccountStatus.ACTIVE || target.currency !== source.currency)) throw new BadRequestException('Destination account cannot receive this transfer');

      const sourceAfter = sourceBalance.ledger.minus(amount);
      const debited = await tx.account.updateMany({
        where: { id: source.id, version: source.version, status: AccountStatus.ACTIVE },
        data: { balance: sourceAfter, availableBalance: sourceBalance.available.minus(amount), version: { increment: 1 } },
      });
      if (debited.count !== 1) throw new ConflictException('Account balance changed; retry transfer');
      let targetBefore: Prisma.Decimal | null = null; let targetAfter: Prisma.Decimal | null = null;
      if (target) {
        const targetBalance = await this.transactionBalance(tx, target.id);
        targetBefore = targetBalance.ledger; targetAfter = targetBalance.ledger.plus(amount);
        await tx.account.update({ where: { id: target.id }, data: { balance: targetAfter, availableBalance: targetBalance.available.plus(amount), version: { increment: 1 } } });
      }
      const transfer = await tx.transfer.create({ data: {
        idempotencyKey, fromAccountId: source.id, toAccountId: target?.id,
        externalRecipientName: target ? undefined : dto.externalRecipientName,
        amount, currency: source.currency, note: dto.note?.trim(), initiatedBy: userId,
        status: TransferStatus.COMPLETED, processedAt: new Date(),
      }});
      await tx.ledgerEntry.create({ data: { transferId: transfer.id, accountId: source.id, direction: LedgerDirection.DEBIT, amount, currency: source.currency, balanceBefore: sourceBalance.ledger, balanceAfter: sourceAfter, referenceType: 'TRANSFER', referenceId: transfer.id, description: dto.note ?? 'Internal transfer debit' } });
      if (target && targetBefore && targetAfter) await tx.ledgerEntry.create({ data: { transferId: transfer.id, accountId: target.id, direction: LedgerDirection.CREDIT, amount, currency: target.currency, balanceBefore: targetBefore, balanceAfter: targetAfter, referenceType: 'TRANSFER', referenceId: transfer.id, description: dto.note ?? 'Internal transfer credit' } });
      await tx.transaction.create({ data: { accountId: source.id, type: TransactionType.TRANSFER, status: TransactionStatus.COMPLETED, amount: amount.negated(), currency: source.currency, description: dto.externalRecipientName ? `Transfer to ${dto.externalRecipientName}` : 'Account transfer', category: 'Transfers', externalReference: transfer.id, postedAt: new Date() } });
      if (target) await tx.transaction.create({ data: { accountId: target.id, type: TransactionType.TRANSFER, status: TransactionStatus.COMPLETED, amount, currency: target.currency, description: 'Incoming account transfer', category: 'Transfers', externalReference: transfer.id, postedAt: new Date() } });
      return transfer;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async transactionBalance(tx: Prisma.TransactionClient, accountId: string) {
    const [credits, debits, holds] = await Promise.all([
      tx.ledgerEntry.aggregate({ where: { accountId, direction: LedgerDirection.CREDIT }, _sum: { amount: true } }),
      tx.ledgerEntry.aggregate({ where: { accountId, direction: LedgerDirection.DEBIT }, _sum: { amount: true } }),
      tx.accountHold.aggregate({ where: { accountId, status: HoldStatus.ACTIVE }, _sum: { amount: true } }),
    ]);
    const ledger = new Prisma.Decimal(credits._sum.amount ?? 0).minus(debits._sum.amount ?? 0);
    return { ledger, available: ledger.minus(holds._sum.amount ?? 0) };
  }

  private serializeTransfer(transfer: { id: string; status: TransferStatus; amount: Prisma.Decimal; currency: string; createdAt: Date; processedAt: Date | null }) {
    return { id: transfer.id, status: transfer.status, amount: transfer.amount.toFixed(2), currency: transfer.currency, createdAt: transfer.createdAt, processedAt: transfer.processedAt };
  }
}
