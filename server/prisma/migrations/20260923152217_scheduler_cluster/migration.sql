-- DropIndex
DROP INDEX "Call_status_idx";

-- AlterTable
ALTER TABLE "Call" ADD COLUMN     "calleeGraceAt" TIMESTAMP(3),
ADD COLUMN     "callerGraceAt" TIMESTAMP(3),
ADD COLUMN     "nextBillingAt" TIMESTAMP(3),
ADD COLUMN     "ringDeadline" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "socket_io_attachments" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" BYTEA
);

-- CreateIndex
CREATE INDEX "RateLimitHit_resetAt_idx" ON "RateLimitHit"("resetAt");

-- CreateIndex
CREATE UNIQUE INDEX "socket_io_attachments_id_key" ON "socket_io_attachments"("id");

-- CreateIndex
CREATE INDEX "Call_status_ringDeadline_idx" ON "Call"("status", "ringDeadline");

-- CreateIndex
CREATE INDEX "Call_status_nextBillingAt_idx" ON "Call"("status", "nextBillingAt");
