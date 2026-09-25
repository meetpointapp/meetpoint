-- AlterTable
ALTER TABLE "WalletEntry" ADD COLUMN     "reclaimedPromo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundedCoins" INTEGER NOT NULL DEFAULT 0;
