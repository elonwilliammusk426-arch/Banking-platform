import {
  PrismaClient, AccountType, BeneficiaryStatus, CardStatus, CardType, KycLevel,
  KycStatus, LedgerDirection, RiskLevel, Role, TransactionStatus, TransactionType, TransferType, UserStatus,
} from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required to seed the database');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const passwordHash = await argon2.hash('ChangeMe!123456', { type: argon2.argon2id });
  const user = await prisma.user.upsert({
    where: { email: 'alex@haven.demo' },
    update: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), phoneVerifiedAt: new Date() },
    create: {
      email: 'alex@haven.demo', phone: '+14155550182', firstName: 'Alex', lastName: 'Morgan',
      passwordHash, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), phoneVerifiedAt: new Date(),
      roles: { create: { role: Role.CUSTOMER } },
      kycProfile: { create: { status: KycStatus.APPROVED, level: KycLevel.STANDARD, riskLevel: RiskLevel.LOW, submittedAt: new Date(), reviewedAt: new Date() } },
    },
  });
  await prisma.userRole.upsert({ where: { userId_role: { userId: user.id, role: Role.CUSTOMER } }, create: { userId: user.id, role: Role.CUSTOMER }, update: {} });
  await prisma.kycProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, status: KycStatus.APPROVED, level: KycLevel.STANDARD, riskLevel: RiskLevel.LOW }, update: { status: KycStatus.APPROVED } });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@haven.demo' }, update: {},
    create: { email: 'admin@haven.demo', phone: '+14155550199', firstName: 'Operations', lastName: 'Admin', passwordHash, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), phoneVerifiedAt: new Date(), roles: { create: [{ role: Role.CUSTOMER }, { role: Role.SUPER_ADMIN }] }, kycProfile: { create: { status: KycStatus.APPROVED, level: KycLevel.ENHANCED } } },
  });
  await prisma.userRole.upsert({ where: { userId_role: { userId: admin.id, role: Role.SUPER_ADMIN } }, create: { userId: admin.id, role: Role.SUPER_ADMIN }, update: {} });

  let checking = await prisma.account.findFirst({ where: { userId: user.id, type: AccountType.CHECKING } });
  if (!checking) checking = await prisma.account.create({ data: { userId: user.id, name: 'Everyday checking', type: AccountType.CHECKING, accountNumberLast4: '1930', balance: 14860.42, availableBalance: 14860.42 } });
  let savings = await prisma.account.findFirst({ where: { userId: user.id, type: AccountType.SAVINGS } });
  if (!savings) savings = await prisma.account.create({ data: { userId: user.id, name: 'Growth savings', type: AccountType.SAVINGS, accountNumberLast4: '5527', balance: 10000, availableBalance: 10000 } });

  for (const account of [checking, savings]) {
    const reference = { accountId: account.id, referenceType: 'OPENING_BALANCE', referenceId: account.id, direction: LedgerDirection.CREDIT };
    if (account.balance.greaterThan(0) && !(await prisma.ledgerEntry.findUnique({ where: { accountId_referenceType_referenceId_direction: reference } }))) {
      await prisma.ledgerEntry.create({
        data: {
          accountId: account.id,
          direction: LedgerDirection.CREDIT,
          amount: account.balance,
          currency: account.currency,
          balanceBefore: 0,
          balanceAfter: account.balance,
          referenceType: 'OPENING_BALANCE',
          referenceId: account.id,
          description: 'Seeded opening balance',
        },
      });
    }
  }

  if (!(await prisma.transaction.findFirst({ where: { accountId: checking.id } }))) await prisma.transaction.createMany({ data: [
    { accountId: checking.id, type: TransactionType.CARD_PAYMENT, status: TransactionStatus.COMPLETED, amount: -84.20, description: 'Aesop', merchantName: 'Aesop', category: 'Shopping', postedAt: new Date() },
    { accountId: checking.id, type: TransactionType.DEPOSIT, status: TransactionStatus.COMPLETED, amount: 4250, description: 'Salary deposit', category: 'Income', postedAt: new Date() },
    { accountId: checking.id, type: TransactionType.CARD_PAYMENT, status: TransactionStatus.COMPLETED, amount: -12, description: 'Notion Labs', merchantName: 'Notion Labs', category: 'Software', postedAt: new Date() },
  ] });
  if (!(await prisma.beneficiary.findFirst({ where: { userId: user.id, internalAccountId: savings.id } }))) await prisma.beneficiary.create({ data: { userId: user.id, nickname: 'Travel savings', legalName: 'Alex Morgan', status: BeneficiaryStatus.ACTIVE, transferType: TransferType.INTERNAL, currency: 'USD', internalAccountId: savings.id, verifiedAt: new Date() } });
  if (!(await prisma.card.findFirst({ where: { userId: user.id } }))) await prisma.card.create({ data: { userId: user.id, accountId: checking.id, type: CardType.PHYSICAL, status: CardStatus.ACTIVE, providerReference: 'card_demo_1930', last4: '1930', network: 'VISA', expiryMonth: 8, expiryYear: 2029, cardholderName: 'ALEX MORGAN', activatedAt: new Date(), controls: { create: { perTransactionLimit: 2500, dailyLimit: 5000, monthlyLimit: 10000 } } } });
  if (!(await prisma.feeSchedule.findFirst())) await prisma.feeSchedule.createMany({ data: [
    { transferType: TransferType.ACH, currency: 'USD', fixedAmount: 0, percentage: 0, activeFrom: new Date() },
    { transferType: TransferType.WIRE, currency: 'USD', fixedAmount: 25, percentage: 0, activeFrom: new Date() },
  ] });
}

main().finally(() => prisma.$disconnect());
