-- AlterTable
ALTER TABLE "WalletEntry" ADD COLUMN     "earned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "earnedPromo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paid" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promo" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Wallet" (
    "userId" TEXT NOT NULL,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "promo" INTEGER NOT NULL DEFAULT 0,
    "earned" INTEGER NOT NULL DEFAULT 0,
    "earnedPromo" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "WalletEntry_requestId_idx" ON "WalletEntry"("requestId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Kazanç kovaları asla eksiye düşemez (kod hatasına karşı veritabanı düzeyinde ikinci kilit).
-- paid/promo, mağaza iadesinde (CLAWBACK) geçici olarak eksiye düşebilir.
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_earned_nonnegative" CHECK ("earned" >= 0 AND "earnedPromo" >= 0);

-- Mevcut kullanıcılar: eski defterden kovalara geçiş.
-- Bozdurulabilir kısım (kazanç - bozdurulan, bakiyeyle sınırlı) "earned", kalan bakiye "paid".
INSERT INTO "Wallet" ("userId", "paid", "promo", "earned", "earnedPromo", "updatedAt")
SELECT u."id", b.balance - b.cashable, 0, b.cashable, 0, NOW()
FROM "User" u
CROSS JOIN LATERAL (
  SELECT
    COALESCE(SUM(w."amount"), 0)::int AS balance,
    GREATEST(0, LEAST(
      COALESCE(SUM(w."amount"), 0),
      COALESCE(SUM(w."amount") FILTER (WHERE w."type" IN ('EARN', 'CASHOUT', 'CASHOUT_REFUND')), 0)
    ))::int AS cashable
  FROM "WalletEntry" w
  WHERE w."userId" = u."id"
) b;

-- Açılış kaydı: kova değişimleri eski hareketlerin karşılığı; tutar 0 (bakiye değişmez).
-- Böylece "kovalar = hareketlerin kova toplamı" denetimi geçmiş veriyle de tutar.
INSERT INTO "WalletEntry" ("id", "userId", "amount", "type", "paid", "promo", "earned", "earnedPromo", "note", "createdAt")
SELECT gen_random_uuid()::text, w."userId", 0, 'OPENING', w."paid", w."promo", w."earned", w."earnedPromo", 'wallet_buckets_migration', NOW()
FROM "Wallet" w
WHERE w."paid" <> 0 OR w."earned" <> 0;
