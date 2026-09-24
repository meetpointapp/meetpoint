-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "flag" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "hiddenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "restrictedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TrafficLog" (
    "id" BIGSERIAL NOT NULL,
    "batchId" BIGINT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrafficLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficBatch" (
    "id" BIGSERIAL NOT NULL,
    "count" INTEGER NOT NULL,
    "rowsHash" TEXT NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrafficBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sanction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sanction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "sanctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "answer" TEXT NOT NULL DEFAULT '',
    "decidedBy" TEXT NOT NULL DEFAULT '',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL DEFAULT '',
    "details" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT NOT NULL DEFAULT '',
    "resolvedBy" TEXT NOT NULL DEFAULT '',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalRequest" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "authority" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL,
    "subjectUsers" JSONB NOT NULL DEFAULT '[]',
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "actions" TEXT NOT NULL DEFAULT '',
    "handledBy" TEXT NOT NULL DEFAULT '',
    "closedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrafficLog_userId_createdAt_idx" ON "TrafficLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TrafficLog_ip_createdAt_idx" ON "TrafficLog"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "TrafficLog_createdAt_idx" ON "TrafficLog"("createdAt");

-- CreateIndex
CREATE INDEX "TrafficLog_batchId_idx" ON "TrafficLog"("batchId");

-- CreateIndex
CREATE INDEX "TrafficBatch_createdAt_idx" ON "TrafficBatch"("createdAt");

-- CreateIndex
CREATE INDEX "Sanction_userId_createdAt_idx" ON "Sanction"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appeal_sanctionId_key" ON "Appeal"("sanctionId");

-- CreateIndex
CREATE INDEX "Appeal_status_createdAt_idx" ON "Appeal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationFlag_status_priority_createdAt_idx" ON "ModerationFlag"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationFlag_userId_kind_createdAt_idx" ON "ModerationFlag"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "LegalRequest_status_dueAt_idx" ON "LegalRequest"("status", "dueAt");

-- AddForeignKey
ALTER TABLE "Sanction" ADD CONSTRAINT "Sanction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_sanctionId_fkey" FOREIGN KEY ("sanctionId") REFERENCES "Sanction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationFlag" ADD CONSTRAINT "ModerationFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trafik kayıtları ve partileri değiştirilemez, silinemez (sadece saklama süresi dolanı imha işi siler:
-- o işlem bu tetikleyiciyi geçici olarak aşmak için "meetpoint.retention" ayarını açar)
CREATE OR REPLACE FUNCTION traffic_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('meetpoint.retention', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Trafik kayıtları değiştirilemez veya silinemez';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER traffic_log_append_only BEFORE UPDATE OR DELETE ON "TrafficLog"
  FOR EACH ROW EXECUTE FUNCTION traffic_append_only();
CREATE TRIGGER traffic_batch_append_only BEFORE UPDATE OR DELETE ON "TrafficBatch"
  FOR EACH ROW EXECUTE FUNCTION traffic_append_only();
