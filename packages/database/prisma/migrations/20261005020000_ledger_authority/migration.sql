-- Make the append-only ledger the authoritative source for displayed balances.
-- Existing transfer entries are assigned stable source references. A controlled
-- reconciliation entry preserves each account's pre-migration balance exactly.

ALTER TABLE "LedgerEntry"
  ALTER COLUMN "transferId" DROP NOT NULL,
  ADD COLUMN "referenceType" TEXT NOT NULL DEFAULT 'TRANSFER',
  ADD COLUMN "referenceId" TEXT,
  ADD COLUMN "description" TEXT;

-- The baseline trigger intentionally rejects row mutations. Disable it only for
-- this controlled metadata backfill, then restore append-only enforcement.
ALTER TABLE "LedgerEntry" DISABLE TRIGGER "LedgerEntry_append_only";

UPDATE "LedgerEntry"
SET "referenceId" = "transferId"::TEXT
WHERE "referenceId" IS NULL
  AND "transferId" IS NOT NULL;

-- Defensive fallback for legacy rows whose source transfer was not retained.
UPDATE "LedgerEntry"
SET
  "referenceType" = 'LEGACY',
  "referenceId" = "id"::TEXT
WHERE "referenceId" IS NULL;

ALTER TABLE "LedgerEntry" ENABLE TRIGGER "LedgerEntry_append_only";

ALTER TABLE "LedgerEntry"
  ALTER COLUMN "referenceId" SET NOT NULL;

CREATE UNIQUE INDEX "LedgerEntry_accountId_referenceType_referenceId_direction_key"
  ON "LedgerEntry"("accountId", "referenceType", "referenceId", "direction");

-- Account.balance was the projection used before this migration. Reconcile the
-- append-only ledger to that point-in-time value without double-counting any
-- transfer entries that already exist. Positive differences become opening
-- credits; the defensive negative branch records an explicit migration debit.
WITH "ledgerTotals" AS (
  SELECT
    entry."accountId",
    COALESCE(SUM(CASE WHEN entry."direction" = 'CREDIT' THEN entry."amount" ELSE -entry."amount" END), 0) AS "ledgerBalance"
  FROM "LedgerEntry" AS entry
  GROUP BY entry."accountId"
),
"reconciliation" AS (
  SELECT
    account.*,
    COALESCE(totals."ledgerBalance", 0) AS "ledgerBalance",
    account."balance" - COALESCE(totals."ledgerBalance", 0) AS "difference"
  FROM "Account" AS account
  LEFT JOIN "ledgerTotals" AS totals ON totals."accountId" = account."id"
)
INSERT INTO "LedgerEntry" (
  "id", "transferId", "accountId", "direction", "amount", "currency",
  "balanceBefore", "balanceAfter", "referenceType", "referenceId",
  "description", "createdAt"
)
SELECT
  MD5('opening-balance:' || account."id"::TEXT)::UUID,
  NULL,
  account."id",
  'CREDIT'::"LedgerDirection",
  account."difference",
  account."currency",
  account."ledgerBalance",
  account."balance",
  'OPENING_BALANCE',
  account."id"::TEXT,
  'Opening balance migrated to the authoritative ledger',
  CURRENT_TIMESTAMP
FROM "reconciliation" AS account
WHERE account."difference" > 0
ON CONFLICT ("accountId", "referenceType", "referenceId", "direction") DO NOTHING;

WITH "ledgerTotals" AS (
  SELECT
    entry."accountId",
    COALESCE(SUM(CASE WHEN entry."direction" = 'CREDIT' THEN entry."amount" ELSE -entry."amount" END), 0) AS "ledgerBalance"
  FROM "LedgerEntry" AS entry
  GROUP BY entry."accountId"
),
"reconciliation" AS (
  SELECT
    account.*,
    COALESCE(totals."ledgerBalance", 0) AS "ledgerBalance",
    account."balance" - COALESCE(totals."ledgerBalance", 0) AS "difference"
  FROM "Account" AS account
  LEFT JOIN "ledgerTotals" AS totals ON totals."accountId" = account."id"
)
INSERT INTO "LedgerEntry" (
  "id", "transferId", "accountId", "direction", "amount", "currency",
  "balanceBefore", "balanceAfter", "referenceType", "referenceId",
  "description", "createdAt"
)
SELECT
  MD5('balance-migration-debit:' || account."id"::TEXT)::UUID,
  NULL,
  account."id",
  'DEBIT'::"LedgerDirection",
  ABS(account."difference"),
  account."currency",
  account."ledgerBalance",
  account."balance",
  'BALANCE_MIGRATION',
  account."id"::TEXT,
  'Defensive debit recorded while migrating ledger authority',
  CURRENT_TIMESTAMP
FROM "reconciliation" AS account
WHERE account."difference" < 0
ON CONFLICT ("accountId", "referenceType", "referenceId", "direction") DO NOTHING;
