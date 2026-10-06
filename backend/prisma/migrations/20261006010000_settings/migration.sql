-- User-level presentation and notification preferences.
CREATE TABLE "UserPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dateFormat" TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
    "theme" TEXT NOT NULL DEFAULT 'SYSTEM',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "marketingMessages" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecuritySetting" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "loginAlerts" BOOLEAN NOT NULL DEFAULT true,
    "transactionAlerts" BOOLEAN NOT NULL DEFAULT true,
    "trustedDeviceAlerts" BOOLEAN NOT NULL DEFAULT true,
    "sessionTimeoutMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SecuritySetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountSetting" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "nickname" TEXT,
    "paperlessStatements" BOOLEAN NOT NULL DEFAULT true,
    "transactionAlerts" BOOLEAN NOT NULL DEFAULT true,
    "lowBalanceAlert" BOOLEAN NOT NULL DEFAULT false,
    "lowBalanceThreshold" DECIMAL(20,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AccountSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");
CREATE UNIQUE INDEX "SecuritySetting_userId_key" ON "SecuritySetting"("userId");
CREATE UNIQUE INDEX "AccountSetting_accountId_key" ON "AccountSetting"("accountId");

ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecuritySetting" ADD CONSTRAINT "SecuritySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountSetting" ADD CONSTRAINT "AccountSetting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
