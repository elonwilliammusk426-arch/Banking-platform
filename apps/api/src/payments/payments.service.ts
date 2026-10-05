import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, BeneficiaryStatus, KycStatus, LedgerDirection, MovementDirection, Prisma, ScheduleFrequency, TransactionStatus, TransactionType, TransferStatus, TransferType } from '@haven/database';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../database.service';
import { EncryptionService } from '../security/encryption.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BANK_RAIL_PROVIDER, BankRailProvider } from '../integrations/provider.interfaces';
import { BankingService } from '../banking/banking.service';
import { CreateBeneficiaryDto, CreateMovementDto, CreatePaymentDto } from './payments.dto';
import { LedgerService } from '../ledger/ledger.service';

interface Meta { requestId?: string; ipAddress?: string; userAgent?: string; }

@Injectable()
export class PaymentsService {
  constructor(private readonly db: DatabaseService, private readonly encryption: EncryptionService, private readonly audit: AuditService, private readonly notifications: NotificationsService, private readonly banking: BankingService, private readonly ledger: LedgerService, @Inject(BANK_RAIL_PROVIDER) private readonly rails: BankRailProvider) {}

  beneficiaries(userId: string) { return this.db.beneficiary.findMany({ where: { userId, status: { not: BeneficiaryStatus.DISABLED } }, orderBy: { createdAt: 'desc' }, select: { id: true, nickname: true, legalName: true, status: true, transferType: true, currency: true, bankName: true, countryCode: true, verifiedAt: true, createdAt: true } }); }
  async addBeneficiary(userId: string, dto: CreateBeneficiaryDto) {
    if (dto.transferType === TransferType.INTERNAL && !dto.internalAccountId) throw new BadRequestException('Internal account is required');
    if (dto.transferType !== TransferType.INTERNAL && (!dto.accountNumber || !dto.routingOrSwift)) throw new BadRequestException('Bank account and routing details are required');
    if (dto.internalAccountId && !(await this.db.account.findUnique({ where: { id: dto.internalAccountId } }))) throw new BadRequestException('Internal account was not found');
    const details = dto.accountNumber ? this.encryption.encryptJson({ accountNumber: dto.accountNumber, routingOrSwift: dto.routingOrSwift }) : null;
    const beneficiary = await this.db.beneficiary.create({ data: { userId, nickname: dto.nickname, legalName: dto.legalName, transferType: dto.transferType, currency: dto.currency.toUpperCase(), internalAccountId: dto.internalAccountId, encryptedBankDetails: details, bankName: dto.bankName, countryCode: dto.countryCode?.toUpperCase(), status: BeneficiaryStatus.ACTIVE, verifiedAt: new Date() } });
    await this.audit.record({ actorUserId: userId, action: 'beneficiary.created', entityType: 'beneficiary', entityId: beneficiary.id, metadata: { transferType: dto.transferType } });
    return { ...beneficiary, encryptedBankDetails: undefined };
  }

  async initiate(userId: string, amr: string[], idempotencyKey: string, dto: CreatePaymentDto, meta: Meta) {
    if (!idempotencyKey || idempotencyKey.length < 16) throw new BadRequestException('A valid Idempotency-Key header is required');
    const replay = await this.db.transfer.findUnique({ where: { idempotencyKey } });
    if (replay) { if (replay.initiatedBy !== userId) throw new ForbiddenException(); return this.transferView(replay); }
    const customer = await this.db.user.findUnique({ where: { id: userId }, include: { kycProfile: true } });
    if (customer?.kycProfile?.status !== KycStatus.APPROVED) throw new ForbiddenException('KYC approval is required for transfers');
    const beneficiary = await this.db.beneficiary.findFirst({ where: { id: dto.beneficiaryId, userId, status: BeneficiaryStatus.ACTIVE } });
    if (!beneficiary) throw new NotFoundException('Beneficiary not found');
    const account = await this.db.account.findFirst({ where: { id: dto.fromAccountId, userId, status: AccountStatus.ACTIVE } });
    if (!account) throw new NotFoundException('Source account not found');
    if (account.currency !== beneficiary.currency) throw new BadRequestException('Currency conversion is not available for this transfer');
    const amount = new Prisma.Decimal(dto.amount.toFixed(2));
    if (amount.greaterThanOrEqualTo(1000) && !amr.includes('mfa')) throw new ForbiddenException('MFA is required to authorize this transfer');
    await this.enforceLimits(account.id, beneficiary.transferType, amount);
    const executeAt = dto.executeAt ? new Date(dto.executeAt) : null;
    if (executeAt && executeAt > new Date(Date.now() + 60_000)) {
      const schedule = await this.db.scheduledTransfer.create({ data: { userId, fromAccountId: account.id, beneficiaryId: beneficiary.id, amount, currency: account.currency, frequency: dto.frequency ?? ScheduleFrequency.ONCE, nextRunAt: executeAt, note: dto.note } });
      await this.audit.record({ actorUserId: userId, action: 'transfer.scheduled', entityType: 'scheduled_transfer', entityId: schedule.id, ...meta });
      return { scheduled: true, schedule };
    }
    if (amount.greaterThan(25_000)) {
      const transfer = await this.db.transfer.create({ data: { idempotencyKey, fromAccountId: account.id, beneficiaryId: beneficiary.id, transferType: beneficiary.transferType, externalRecipientName: beneficiary.legalName, amount, currency: account.currency, status: TransferStatus.CREATED, note: dto.note, initiatedBy: userId, riskScore: 85 } });
      await this.db.riskAlert.create({ data: { customerId: userId, transferId: transfer.id, severity: 'HIGH', ruleKey: 'high_value_transfer', title: 'High-value transfer requires review', description: `Transfer ${transfer.id} exceeded the automatic approval threshold`, score: 85 } });
      await this.db.transferEvent.create({ data: { transferId: transfer.id, toStatus: TransferStatus.CREATED, reason: 'Awaiting operations approval', actorUserId: userId } });
      return { ...this.transferView(transfer), pendingApproval: true };
    }
    if (beneficiary.transferType === TransferType.INTERNAL) {
      const result = await this.banking.transfer(userId, idempotencyKey, { fromAccountId: account.id, toAccountId: beneficiary.internalAccountId!, amount: dto.amount, note: dto.note }, meta, amr);
      await this.db.transfer.update({ where: { id: result.id }, data: { beneficiaryId: beneficiary.id, transferType: TransferType.INTERNAL } });
      return result;
    }
    const derived = await this.ledger.balance(account.id);
    return this.externalTransfer(userId, idempotencyKey, { ...account, balance: derived.ledgerBalance, availableBalance: derived.availableBalance }, beneficiary, amount, dto.note, meta);
  }

  private async externalTransfer(userId: string, idempotencyKey: string, account: { id: string; balance: Prisma.Decimal; availableBalance: Prisma.Decimal; version: number; currency: string }, beneficiary: { id: string; legalName: string; transferType: TransferType; encryptedBankDetails: string | null }, amount: Prisma.Decimal, note: string | undefined, meta: Meta) {
    if (!beneficiary.encryptedBankDetails) throw new BadRequestException('Beneficiary bank details are missing');
    const fee = await this.calculateFee(beneficiary.transferType, account.currency, amount); const total = amount.plus(fee);
    if (account.availableBalance.lessThan(total)) throw new BadRequestException('Insufficient available funds');
    const transfer = await this.db.$transaction(async (tx) => {
      const debit = await tx.account.updateMany({ where: { id: account.id, version: account.version, availableBalance: { gte: total } }, data: { balance: account.balance.minus(total), availableBalance: account.availableBalance.minus(total), version: { increment: 1 } } });
      if (!debit.count) throw new BadRequestException('Balance changed; retry transfer');
      const created = await tx.transfer.create({ data: { idempotencyKey, fromAccountId: account.id, beneficiaryId: beneficiary.id, transferType: beneficiary.transferType, externalRecipientName: beneficiary.legalName, amount, feeAmount: fee, currency: account.currency, status: TransferStatus.PROCESSING, note, initiatedBy: userId } });
      await tx.ledgerEntry.create({ data: { transferId: created.id, accountId: account.id, direction: LedgerDirection.DEBIT, amount: total, currency: account.currency, balanceBefore: account.balance, balanceAfter: account.balance.minus(total), referenceType: 'TRANSFER', referenceId: created.id, description: `${beneficiary.transferType} transfer debit` } });
      await tx.transaction.create({ data: { accountId: account.id, type: TransactionType.TRANSFER, status: TransactionStatus.PENDING, amount: total.negated(), currency: account.currency, description: `${beneficiary.transferType} transfer to ${beneficiary.legalName}`, category: 'Transfers', externalReference: created.id } });
      await tx.transferEvent.create({ data: { transferId: created.id, fromStatus: TransferStatus.CREATED, toStatus: TransferStatus.PROCESSING, actorUserId: userId } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    try {
      const provider = await this.rails.initiate({ transferId: transfer.id, rail: beneficiary.transferType as 'ACH' | 'WIRE', amount: amount.toFixed(2), currency: account.currency, encryptedDestination: beneficiary.encryptedBankDetails });
      const status = provider.status === 'COMPLETED' ? TransferStatus.COMPLETED : TransferStatus.PROCESSING;
      const updated = await this.db.transfer.update({ where: { id: transfer.id }, data: { providerReference: provider.reference, status, processedAt: status === TransferStatus.COMPLETED ? new Date() : null } });
      await this.createReceiptAndEvent(transfer.id, userId, status);
      await this.notifications.notify(userId, { templateKey: 'transfer_started', title: 'Transfer started', body: `${amount.toFixed(2)} ${account.currency} is on its way.` });
      await this.audit.record({ actorUserId: userId, action: 'bank_transfer.initiated', entityType: 'transfer', entityId: transfer.id, ...meta, metadata: { rail: beneficiary.transferType, amount: amount.toFixed(2), fee: fee.toFixed(2) } });
      return this.transferView(updated);
    } catch (error) {
      await this.reverseFailedTransfer(transfer.id, account.id, total);
      throw error;
    }
  }

  private async reverseFailedTransfer(transferId: string, accountId: string, total: Prisma.Decimal) {
    await this.db.$transaction(async (tx) => {
      const debit = await tx.ledgerEntry.findFirstOrThrow({ where: { transferId, accountId, direction: LedgerDirection.DEBIT } });
      await tx.account.update({ where: { id: accountId }, data: { balance: debit.balanceBefore, availableBalance: debit.balanceBefore, version: { increment: 1 } } });
      await tx.ledgerEntry.create({ data: { transferId, accountId, direction: LedgerDirection.CREDIT, amount: total, currency: debit.currency, balanceBefore: debit.balanceAfter, balanceAfter: debit.balanceBefore, referenceType: 'TRANSFER_REVERSAL', referenceId: transferId, description: 'Automatic reversal after provider failure' } });
      await tx.transfer.update({ where: { id: transferId }, data: { status: TransferStatus.FAILED, failureReason: 'Provider initiation failed' } });
      await tx.transferEvent.create({ data: { transferId, fromStatus: TransferStatus.PROCESSING, toStatus: TransferStatus.FAILED, reason: 'Provider initiation failed' } });
      await tx.transaction.updateMany({ where: { externalReference: transferId }, data: { status: TransactionStatus.REVERSED } });
    });
  }

  async movement(userId: string, amr: string[], idempotencyKey: string, direction: MovementDirection, dto: CreateMovementDto) {
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128) throw new BadRequestException('A valid Idempotency-Key header is required');
    const existing = await this.db.moneyMovement.findUnique({ where: { idempotencyKey } }); if (existing) { if (existing.userId !== userId) throw new ForbiddenException(); return existing; }
    const account = await this.db.account.findFirst({ where: { id: dto.accountId, userId, status: AccountStatus.ACTIVE } }); if (!account) throw new NotFoundException('Account not found');
    const amount = new Prisma.Decimal(dto.amount.toFixed(2));
    const derived = await this.ledger.balance(account.id);
    if (direction === MovementDirection.WITHDRAWAL && !amr.includes('mfa')) throw new ForbiddenException('MFA is required for withdrawals');
    if (direction === MovementDirection.WITHDRAWAL && derived.availableBalance.lessThan(amount)) throw new BadRequestException('Insufficient funds');
    return this.db.$transaction(async (tx) => {
      const movement = await tx.moneyMovement.create({ data: { idempotencyKey, userId, accountId: account.id, direction, method: dto.method, amount, currency: account.currency, status: TransferStatus.PROCESSING } });
      if (direction === MovementDirection.WITHDRAWAL) {
        const after = derived.ledgerBalance.minus(amount);
        const updated = await tx.account.updateMany({ where: { id: account.id, version: account.version }, data: { balance: after, availableBalance: derived.availableBalance.minus(amount), version: { increment: 1 } } });
        if (!updated.count) throw new BadRequestException('Balance changed; retry withdrawal');
        await tx.ledgerEntry.create({ data: { accountId: account.id, direction: LedgerDirection.DEBIT, amount, currency: account.currency, balanceBefore: derived.ledgerBalance, balanceAfter: after, referenceType: 'WITHDRAWAL', referenceId: movement.id, description: `${dto.method} withdrawal` } });
        await tx.transaction.create({ data: { accountId: account.id, type: TransactionType.WITHDRAWAL, status: TransactionStatus.PENDING, amount: amount.negated(), currency: account.currency, description: `${dto.method} withdrawal`, category: 'Withdrawals', externalReference: movement.id } });
      }
      return movement;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  receipt(userId: string, transferId: string) { return this.db.transactionReceipt.findFirst({ where: { transferId, transfer: { initiatedBy: userId } }, include: { transfer: { select: { id: true, amount: true, feeAmount: true, currency: true, status: true, externalRecipientName: true, createdAt: true, processedAt: true } } } }); }
  schedules(userId: string) { return this.db.scheduledTransfer.findMany({ where: { userId, active: true }, include: { beneficiary: { select: { nickname: true, legalName: true } }, fromAccount: { select: { name: true, accountNumberLast4: true } } }, orderBy: { nextRunAt: 'asc' } }); }

  private async calculateFee(type: TransferType, currency: string, amount: Prisma.Decimal) { const fee = await this.db.feeSchedule.findFirst({ where: { transferType: type, currency, activeFrom: { lte: new Date() }, OR: [{ activeTo: null }, { activeTo: { gt: new Date() } }] }, orderBy: { activeFrom: 'desc' } }); if (!fee) return new Prisma.Decimal(0); let value = fee.fixedAmount.plus(amount.mul(fee.percentage)); if (fee.minimumFee && value.lessThan(fee.minimumFee)) value = fee.minimumFee; if (fee.maximumFee && value.greaterThan(fee.maximumFee)) value = fee.maximumFee; return value; }
  private async enforceLimits(accountId: string, type: TransferType, amount: Prisma.Decimal) { const limits = await this.db.transactionLimit.findMany({ where: { accountId, active: true, OR: [{ transferType: type }, { transferType: null }] } }); const per = limits.find((item) => item.period === 'PER_TRANSACTION'); if (per && amount.greaterThan(per.amount)) throw new BadRequestException('Transfer exceeds the per-transaction limit'); const start = new Date(); start.setHours(0,0,0,0); const spent = await this.db.transfer.aggregate({ where: { fromAccountId: accountId, createdAt: { gte: start }, status: { in: [TransferStatus.PROCESSING, TransferStatus.COMPLETED] } }, _sum: { amount: true } }); const daily = limits.find((item) => item.period === 'DAILY'); if (daily && new Prisma.Decimal(spent._sum.amount ?? 0).plus(amount).greaterThan(daily.amount)) throw new BadRequestException('Transfer exceeds the daily limit'); const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)); const monthlySpent = await this.db.transfer.aggregate({ where: { fromAccountId: accountId, createdAt: { gte: monthStart }, status: { in: [TransferStatus.PROCESSING, TransferStatus.COMPLETED] } }, _sum: { amount: true } }); const monthly = limits.find((item) => item.period === 'MONTHLY'); if (monthly && new Prisma.Decimal(monthlySpent._sum.amount ?? 0).plus(amount).greaterThan(monthly.amount)) throw new BadRequestException('Transfer exceeds the monthly limit'); }
  private async createReceiptAndEvent(transferId: string, actorUserId: string, status: TransferStatus) { await this.db.$transaction([this.db.transferEvent.create({ data: { transferId, toStatus: status, actorUserId } }), this.db.transactionReceipt.upsert({ where: { transferId }, create: { transferId, receiptNumber: `HVN-${new Date().getUTCFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}` }, update: {} })]); }
  private transferView(transfer: { id: string; status: TransferStatus; amount: Prisma.Decimal; feeAmount: Prisma.Decimal; currency: string; createdAt: Date; processedAt: Date | null }) { return { id: transfer.id, status: transfer.status, amount: transfer.amount.toFixed(2), fee: transfer.feeAmount.toFixed(2), currency: transfer.currency, createdAt: transfer.createdAt, processedAt: transfer.processedAt }; }
}
