-- Customer banking, card, operations, KYC, support, and risk domains.
CREATE TYPE "Role" AS ENUM ('CUSTOMER','SUPPORT','KYC_REVIEWER','RISK_ANALYST','OPERATIONS','ADMIN','SUPER_ADMIN');
CREATE TYPE "VerificationChannel" AS ENUM ('EMAIL','PHONE');
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED','IN_PROGRESS','SUBMITTED','IN_REVIEW','APPROVED','REJECTED','EXPIRED');
CREATE TYPE "KycLevel" AS ENUM ('BASIC','STANDARD','ENHANCED');
CREATE TYPE "RiskLevel" AS ENUM ('LOW','MEDIUM','HIGH','PROHIBITED');
CREATE TYPE "IdentifierType" AS ENUM ('ACCOUNT_NUMBER','ROUTING_NUMBER','IBAN','SWIFT_BIC','SORT_CODE');
CREATE TYPE "LimitPeriod" AS ENUM ('PER_TRANSACTION','DAILY','MONTHLY');
CREATE TYPE "HoldStatus" AS ENUM ('ACTIVE','RELEASED','CAPTURED','EXPIRED');
CREATE TYPE "BeneficiaryStatus" AS ENUM ('PENDING_VERIFICATION','ACTIVE','DISABLED');
CREATE TYPE "TransferType" AS ENUM ('INTERNAL','ACH','WIRE');
CREATE TYPE "ScheduleFrequency" AS ENUM ('ONCE','WEEKLY','BIWEEKLY','MONTHLY');
CREATE TYPE "MovementDirection" AS ENUM ('DEPOSIT','WITHDRAWAL');
CREATE TYPE "MovementMethod" AS ENUM ('BANK_TRANSFER','ACH','WIRE','CARD','CASH');
CREATE TYPE "CardType" AS ENUM ('VIRTUAL','PHYSICAL');
CREATE TYPE "CardStatus" AS ENUM ('CREATED','PENDING_ACTIVATION','ACTIVE','FROZEN','EXPIRED','REPLACED','CANCELLED');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP','EMAIL','SMS','PUSH');
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED','SENT','DELIVERED','FAILED','READ');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN','IN_PROGRESS','WAITING_ON_CUSTOMER','RESOLVED','CLOSED');
CREATE TYPE "TicketPriority" AS ENUM ('LOW','NORMAL','HIGH','URGENT');
CREATE TYPE "RiskAlertStatus" AS ENUM ('OPEN','INVESTIGATING','CLEARED','ESCALATED','BLOCKED');
CREATE TYPE "StatementStatus" AS ENUM ('GENERATING','READY','FAILED');

ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3), ADD COLUMN "preferredLanguage" TEXT NOT NULL DEFAULT 'en', ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
ALTER TABLE "Account" ADD COLUMN "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "closedAt" TIMESTAMP(3);
CREATE INDEX "Account_currency_idx" ON "Account"("currency");
ALTER TABLE "Session" ADD COLUMN "deviceId" UUID;
ALTER TABLE "Transfer" ADD COLUMN "beneficiaryId" UUID, ADD COLUMN "transferType" "TransferType" NOT NULL DEFAULT 'INTERNAL', ADD COLUMN "feeAmount" DECIMAL(20,2) NOT NULL DEFAULT 0, ADD COLUMN "providerReference" TEXT, ADD COLUMN "scheduledFor" TIMESTAMP(3), ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "approvedById" UUID, ADD COLUMN "approvedAt" TIMESTAMP(3);

CREATE TABLE "Device" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "fingerprintHash" TEXT NOT NULL, "displayName" TEXT NOT NULL,
  "platform" TEXT, "browser" TEXT, "lastIpAddress" TEXT, "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trustedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Device_userId_fingerprintHash_key" ON "Device"("userId","fingerprintHash");
CREATE INDEX "Device_userId_lastSeenAt_idx" ON "Device"("userId","lastSeenAt" DESC);
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Session_deviceId_idx" ON "Session"("deviceId");

CREATE TABLE "LoginEvent" (
  "id" UUID NOT NULL, "userId" UUID, "emailHash" TEXT NOT NULL, "successful" BOOLEAN NOT NULL, "suspicious" BOOLEAN NOT NULL DEFAULT false,
  "riskScore" INTEGER NOT NULL DEFAULT 0, "reason" TEXT, "ipAddress" TEXT, "userAgent" TEXT, "countryCode" CHAR(2), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoginEvent_userId_createdAt_idx" ON "LoginEvent"("userId","createdAt" DESC);
CREATE INDEX "LoginEvent_suspicious_createdAt_idx" ON "LoginEvent"("suspicious","createdAt" DESC);
ALTER TABLE "LoginEvent" ADD CONSTRAINT "LoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "UserRole" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "role" "Role" NOT NULL DEFAULT 'CUSTOMER', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId","role");
CREATE INDEX "UserRole_role_idx" ON "UserRole"("role");
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VerificationCode" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "channel" "VerificationChannel" NOT NULL, "destinationHash" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VerificationCode_userId_channel_consumedAt_idx" ON "VerificationCode"("userId","channel","consumedAt");
CREATE INDEX "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "KycProfile" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "status" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED', "level" "KycLevel" NOT NULL DEFAULT 'BASIC',
  "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW', "encryptedPayload" TEXT, "providerReference" TEXT, "rejectionReason" TEXT,
  "submittedAt" TIMESTAMP(3), "reviewedAt" TIMESTAMP(3), "reviewedById" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KycProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KycProfile_userId_key" ON "KycProfile"("userId");
CREATE INDEX "KycProfile_status_submittedAt_idx" ON "KycProfile"("status","submittedAt");
CREATE INDEX "KycProfile_riskLevel_idx" ON "KycProfile"("riskLevel");
ALTER TABLE "KycProfile" ADD CONSTRAINT "KycProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycProfile" ADD CONSTRAINT "KycProfile_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "KycDocument" (
  "id" UUID NOT NULL, "kycProfileId" UUID NOT NULL, "fileObjectId" UUID NOT NULL, "documentType" TEXT NOT NULL, "countryCode" CHAR(2) NOT NULL,
  "verifiedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KycDocument_kycProfileId_idx" ON "KycDocument"("kycProfileId");
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_kycProfileId_fkey" FOREIGN KEY ("kycProfileId") REFERENCES "KycProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_fileObjectId_fkey" FOREIGN KEY ("fileObjectId") REFERENCES "FileObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AccountIdentifier" (
  "id" UUID NOT NULL, "accountId" UUID NOT NULL, "type" "IdentifierType" NOT NULL, "encryptedValue" TEXT NOT NULL, "last4" TEXT, "countryCode" CHAR(2), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountIdentifier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccountIdentifier_accountId_type_key" ON "AccountIdentifier"("accountId","type");
ALTER TABLE "AccountIdentifier" ADD CONSTRAINT "AccountIdentifier_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TransactionLimit" (
  "id" UUID NOT NULL, "accountId" UUID NOT NULL, "transferType" "TransferType", "period" "LimitPeriod" NOT NULL, "amount" DECIMAL(20,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'USD', "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransactionLimit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TransactionLimit_accountId_transferType_period_currency_key" ON "TransactionLimit"("accountId","transferType","period","currency");
ALTER TABLE "TransactionLimit" ADD CONSTRAINT "TransactionLimit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AccountHold" (
  "id" UUID NOT NULL, "accountId" UUID NOT NULL, "amount" DECIMAL(20,2) NOT NULL, "currency" CHAR(3) NOT NULL DEFAULT 'USD', "reason" TEXT NOT NULL,
  "status" "HoldStatus" NOT NULL DEFAULT 'ACTIVE', "expiresAt" TIMESTAMP(3), "releasedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountHold_pkey" PRIMARY KEY ("id"), CONSTRAINT "AccountHold_amount_positive" CHECK ("amount" > 0)
);
CREATE INDEX "AccountHold_accountId_status_idx" ON "AccountHold"("accountId","status");
CREATE INDEX "AccountHold_expiresAt_idx" ON "AccountHold"("expiresAt");
ALTER TABLE "AccountHold" ADD CONSTRAINT "AccountHold_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Statement" (
  "id" UUID NOT NULL, "accountId" UUID NOT NULL, "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL,
  "openingBalance" DECIMAL(20,2) NOT NULL, "closingBalance" DECIMAL(20,2) NOT NULL, "status" "StatementStatus" NOT NULL DEFAULT 'GENERATING',
  "fileObjectId" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Statement_accountId_periodStart_periodEnd_key" ON "Statement"("accountId","periodStart","periodEnd");
CREATE INDEX "Statement_accountId_periodEnd_idx" ON "Statement"("accountId","periodEnd" DESC);
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_fileObjectId_fkey" FOREIGN KEY ("fileObjectId") REFERENCES "FileObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Beneficiary" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "nickname" TEXT NOT NULL, "legalName" TEXT NOT NULL, "status" "BeneficiaryStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "transferType" "TransferType" NOT NULL, "currency" CHAR(3) NOT NULL DEFAULT 'USD', "internalAccountId" UUID, "encryptedBankDetails" TEXT,
  "bankName" TEXT, "countryCode" CHAR(2), "verifiedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Beneficiary_userId_status_idx" ON "Beneficiary"("userId","status");
CREATE INDEX "Beneficiary_internalAccountId_idx" ON "Beneficiary"("internalAccountId");
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_initiatedBy_fkey" FOREIGN KEY ("initiatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Transfer_beneficiaryId_idx" ON "Transfer"("beneficiaryId");
CREATE INDEX "Transfer_scheduledFor_status_idx" ON "Transfer"("scheduledFor","status");

CREATE TABLE "ScheduledTransfer" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "fromAccountId" UUID NOT NULL, "beneficiaryId" UUID NOT NULL, "amount" DECIMAL(20,2) NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'USD', "frequency" "ScheduleFrequency" NOT NULL DEFAULT 'ONCE', "nextRunAt" TIMESTAMP(3) NOT NULL, "endAt" TIMESTAMP(3),
  "note" TEXT, "active" BOOLEAN NOT NULL DEFAULT true, "lastRunAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduledTransfer_pkey" PRIMARY KEY ("id"), CONSTRAINT "ScheduledTransfer_amount_positive" CHECK ("amount" > 0)
);
CREATE INDEX "ScheduledTransfer_active_nextRunAt_idx" ON "ScheduledTransfer"("active","nextRunAt");
CREATE INDEX "ScheduledTransfer_userId_idx" ON "ScheduledTransfer"("userId");
ALTER TABLE "ScheduledTransfer" ADD CONSTRAINT "ScheduledTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduledTransfer" ADD CONSTRAINT "ScheduledTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduledTransfer" ADD CONSTRAINT "ScheduledTransfer_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "Beneficiary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TransferEvent" (
  "id" UUID NOT NULL, "transferId" UUID NOT NULL, "fromStatus" "TransferStatus", "toStatus" "TransferStatus" NOT NULL, "reason" TEXT,
  "actorUserId" UUID, "providerPayload" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "TransferEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TransferEvent_transferId_createdAt_idx" ON "TransferEvent"("transferId","createdAt");
ALTER TABLE "TransferEvent" ADD CONSTRAINT "TransferEvent_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TransactionReceipt" (
  "id" UUID NOT NULL, "transferId" UUID NOT NULL, "receiptNumber" TEXT NOT NULL, "fileObjectId" UUID, "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TransactionReceipt_transferId_key" ON "TransactionReceipt"("transferId");
CREATE UNIQUE INDEX "TransactionReceipt_receiptNumber_key" ON "TransactionReceipt"("receiptNumber");
ALTER TABLE "TransactionReceipt" ADD CONSTRAINT "TransactionReceipt_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionReceipt" ADD CONSTRAINT "TransactionReceipt_fileObjectId_fkey" FOREIGN KEY ("fileObjectId") REFERENCES "FileObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MoneyMovement" (
  "id" UUID NOT NULL, "idempotencyKey" TEXT NOT NULL, "userId" UUID NOT NULL, "accountId" UUID NOT NULL, "direction" "MovementDirection" NOT NULL,
  "method" "MovementMethod" NOT NULL, "amount" DECIMAL(20,2) NOT NULL, "feeAmount" DECIMAL(20,2) NOT NULL DEFAULT 0, "currency" CHAR(3) NOT NULL DEFAULT 'USD',
  "status" "TransferStatus" NOT NULL DEFAULT 'CREATED', "providerReference" TEXT, "failureReason" TEXT, "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "MoneyMovement_pkey" PRIMARY KEY ("id"), CONSTRAINT "MoneyMovement_amount_positive" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "MoneyMovement_idempotencyKey_key" ON "MoneyMovement"("idempotencyKey");
CREATE INDEX "MoneyMovement_userId_createdAt_idx" ON "MoneyMovement"("userId","createdAt" DESC);
CREATE INDEX "MoneyMovement_accountId_status_idx" ON "MoneyMovement"("accountId","status");
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Card" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "accountId" UUID NOT NULL, "type" "CardType" NOT NULL, "status" "CardStatus" NOT NULL DEFAULT 'CREATED',
  "providerReference" TEXT NOT NULL, "last4" CHAR(4) NOT NULL, "network" TEXT NOT NULL, "expiryMonth" INTEGER NOT NULL, "expiryYear" INTEGER NOT NULL,
  "cardholderName" TEXT NOT NULL, "activatedAt" TIMESTAMP(3), "frozenAt" TIMESTAMP(3), "replacedById" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Card_providerReference_key" ON "Card"("providerReference");
CREATE INDEX "Card_userId_status_idx" ON "Card"("userId","status");
CREATE INDEX "Card_accountId_idx" ON "Card"("accountId");
ALTER TABLE "Card" ADD CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Card" ADD CONSTRAINT "Card_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CardControl" (
  "id" UUID NOT NULL, "cardId" UUID NOT NULL, "onlineEnabled" BOOLEAN NOT NULL DEFAULT true, "internationalEnabled" BOOLEAN NOT NULL DEFAULT false,
  "contactlessEnabled" BOOLEAN NOT NULL DEFAULT true, "atmEnabled" BOOLEAN NOT NULL DEFAULT true, "perTransactionLimit" DECIMAL(20,2),
  "dailyLimit" DECIMAL(20,2), "monthlyLimit" DECIMAL(20,2), "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "CardControl_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CardControl_cardId_key" ON "CardControl"("cardId");
ALTER TABLE "CardControl" ADD CONSTRAINT "CardControl_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CardTransaction" (
  "id" UUID NOT NULL, "cardId" UUID NOT NULL, "providerReference" TEXT NOT NULL, "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(20,2) NOT NULL, "currency" CHAR(3) NOT NULL, "merchantName" TEXT NOT NULL, "merchantCategory" TEXT, "merchantCountry" CHAR(2),
  "authorizedAt" TIMESTAMP(3) NOT NULL, "postedAt" TIMESTAMP(3), "reversedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CardTransaction_providerReference_key" ON "CardTransaction"("providerReference");
CREATE INDEX "CardTransaction_cardId_authorizedAt_idx" ON "CardTransaction"("cardId","authorizedAt" DESC);
CREATE INDEX "CardTransaction_status_idx" ON "CardTransaction"("status");
ALTER TABLE "CardTransaction" ADD CONSTRAINT "CardTransaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CardEvent" (
  "id" UUID NOT NULL, "cardId" UUID NOT NULL, "action" TEXT NOT NULL, "actorUserId" UUID, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CardEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CardEvent_cardId_createdAt_idx" ON "CardEvent"("cardId","createdAt" DESC);
ALTER TABLE "CardEvent" ADD CONSTRAINT "CardEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Notification" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "channel" "NotificationChannel" NOT NULL, "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
  "templateKey" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "data" JSONB, "sentAt" TIMESTAMP(3), "readAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId","readAt","createdAt" DESC);
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status","createdAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SupportTicket" (
  "id" UUID NOT NULL, "customerId" UUID NOT NULL, "assignedToId" UUID, "subject" TEXT NOT NULL, "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL', "category" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "resolvedAt" TIMESTAMP(3), CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportTicket_customerId_createdAt_idx" ON "SupportTicket"("customerId","createdAt" DESC);
CREATE INDEX "SupportTicket_status_priority_idx" ON "SupportTicket"("status","priority");
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SupportMessage" (
  "id" UUID NOT NULL, "ticketId" UUID NOT NULL, "authorUserId" UUID NOT NULL, "body" TEXT NOT NULL, "internalOnly" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId","createdAt");
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RiskAlert" (
  "id" UUID NOT NULL, "customerId" UUID, "transferId" UUID, "assignedToId" UUID, "status" "RiskAlertStatus" NOT NULL DEFAULT 'OPEN', "severity" "RiskLevel" NOT NULL,
  "ruleKey" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL, "score" INTEGER NOT NULL, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "resolvedAt" TIMESTAMP(3), CONSTRAINT "RiskAlert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RiskAlert_status_severity_createdAt_idx" ON "RiskAlert"("status","severity","createdAt" DESC);
CREATE INDEX "RiskAlert_customerId_idx" ON "RiskAlert"("customerId");
CREATE INDEX "RiskAlert_transferId_idx" ON "RiskAlert"("transferId");
ALTER TABLE "RiskAlert" ADD CONSTRAINT "RiskAlert_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RiskAlert" ADD CONSTRAINT "RiskAlert_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RiskAlert" ADD CONSTRAINT "RiskAlert_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FeeSchedule" (
  "id" UUID NOT NULL, "transferType" "TransferType" NOT NULL, "currency" CHAR(3) NOT NULL, "fixedAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
  "percentage" DECIMAL(8,5) NOT NULL DEFAULT 0, "minimumFee" DECIMAL(20,2), "maximumFee" DECIMAL(20,2), "activeFrom" TIMESTAMP(3) NOT NULL,
  "activeTo" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "FeeSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FeeSchedule_transferType_currency_activeFrom_idx" ON "FeeSchedule"("transferType","currency","activeFrom");

CREATE TABLE "SystemConfig" (
  "key" TEXT NOT NULL, "encryptedValue" TEXT NOT NULL, "description" TEXT, "updatedById" UUID, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- Additional immutable event streams used for disputes and compliance investigations.
CREATE TRIGGER "TransferEvent_append_only" BEFORE UPDATE OR DELETE ON "TransferEvent" FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();
CREATE TRIGGER "CardEvent_append_only" BEFORE UPDATE OR DELETE ON "CardEvent" FOR EACH ROW EXECUTE FUNCTION prevent_append_only_mutation();
