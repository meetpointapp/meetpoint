-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "leaderboardOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EarningEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EarningEvent_startAt_endAt_idx" ON "EarningEvent"("startAt", "endAt");

