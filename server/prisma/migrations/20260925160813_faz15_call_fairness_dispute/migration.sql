-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "calleeJoinedAt" TIMESTAMP(3),
ADD COLUMN     "callerJoinedAt" TIMESTAMP(3),
ADD COLUMN     "disputeStatus" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "mediaConfirmDeadline" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CallDispute" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "refunded" INTEGER NOT NULL DEFAULT 0,
    "adminNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CallDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallDispute_status_createdAt_idx" ON "CallDispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CallDispute_callId_idx" ON "CallDispute"("callId");

-- CreateIndex
CREATE INDEX "Call_status_mediaConfirmDeadline_idx" ON "Call"("status", "mediaConfirmDeadline");

-- AddForeignKey
ALTER TABLE "CallDispute" ADD CONSTRAINT "CallDispute_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallDispute" ADD CONSTRAINT "CallDispute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
