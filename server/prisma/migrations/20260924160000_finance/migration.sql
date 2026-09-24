-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "exportedAt" TIMESTAMP(3),
ADD COLUMN     "netUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "riskFlags" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "withholdingUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "kycName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "kycStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "kycTcHash" TEXT,
ADD COLUMN     "kycVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WalletEntry" ADD COLUMN     "counterpartyId" TEXT,
ADD COLUMN     "reclaimedCoins" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "KycSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "tcNo" TEXT NOT NULL,
    "tcHash" TEXT NOT NULL,
    "documentPath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT NOT NULL DEFAULT '',
    "reviewedBy" TEXT NOT NULL DEFAULT '',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "storeFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "cashoutUsdPerCoin" DOUBLE PRECISION NOT NULL DEFAULT 0.01,
    "cashoutMinCoins" INTEGER NOT NULL DEFAULT 2000,
    "withholdingRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maturityDays" INTEGER NOT NULL DEFAULT 14,
    "monthlyPayoutCapUsd" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "usdTryRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinPack" (
    "id" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "usd" DOUBLE PRECISION NOT NULL,
    "tryPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinPack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KycSubmission_status_createdAt_idx" ON "KycSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "KycSubmission_userId_createdAt_idx" ON "KycSubmission"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_kycTcHash_key" ON "User"("kycTcHash");

-- CreateIndex
CREATE INDEX "WalletEntry_counterpartyId_createdAt_idx" ON "WalletEntry"("counterpartyId", "createdAt");

-- AddForeignKey
ALTER TABLE "KycSubmission" ADD CONSTRAINT "KycSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Varsayılan ayarlar ve bugünkü paketler
INSERT INTO "FinanceSettings" ("id", "updatedAt") VALUES (1, NOW()) ON CONFLICT DO NOTHING;
INSERT INTO "CoinPack" ("id", "coins", "usd", "popular", "sortOrder", "updatedAt") VALUES
  ('coins_500', 500, 9.99, false, 1, NOW()),
  ('coins_1000', 1000, 18.99, true, 2, NOW()),
  ('coins_2500', 2500, 44.99, false, 3, NOW()),
  ('coins_6000', 6000, 99.99, false, 4, NOW())
ON CONFLICT DO NOTHING;

-- Mevcut ödeme kayıtları: stopaj yoktu, net = brüt
UPDATE "Payout" SET "netUsd" = "usd" WHERE "netUsd" = 0;
