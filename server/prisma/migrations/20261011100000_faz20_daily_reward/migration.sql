-- Faz 20: günlük giriş ödülü
CREATE TABLE "DailyClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "streakDay" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL,
    "bonusCoins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyClaim_userId_day_key" ON "DailyClaim"("userId", "day");
CREATE INDEX "DailyClaim_userId_createdAt_idx" ON "DailyClaim"("userId", "createdAt");

ALTER TABLE "DailyClaim" ADD CONSTRAINT "DailyClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
