-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentMarketingAt" TIMESTAMP(3),
ADD COLUMN     "consentOverseasAt" TIMESTAMP(3),
ADD COLUMN     "consentSelfieAt" TIMESTAMP(3),
ADD COLUMN     "consentSpecialAt" TIMESTAMP(3),
ADD COLUMN     "deleteAfter" TIMESTAMP(3),
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "inactivityWarnedAt" TIMESTAMP(3),
ADD COLUMN     "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "privacyVersion" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL DEFAULT '',
    "path" TEXT NOT NULL DEFAULT '',
    "size" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),

    CONSTRAINT "DataExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DsrRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "answer" TEXT NOT NULL DEFAULT '',
    "answeredBy" TEXT NOT NULL DEFAULT '',
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DsrRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DestructionLog" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DestructionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreachRecord" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dataCategories" JSONB NOT NULL DEFAULT '[]',
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "measures" TEXT NOT NULL DEFAULT '',
    "authorityNotifiedAt" TIMESTAMP(3),
    "usersNotifiedAt" TIMESTAMP(3),
    "usersNotifiedCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreachRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Consent_userId_kind_createdAt_idx" ON "Consent"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "DataExport_userId_createdAt_idx" ON "DataExport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DataExport_status_idx" ON "DataExport"("status");

-- CreateIndex
CREATE INDEX "DataExport_tokenHash_idx" ON "DataExport"("tokenHash");

-- CreateIndex
CREATE INDEX "DsrRequest_status_dueAt_idx" ON "DsrRequest"("status", "dueAt");

-- CreateIndex
CREATE INDEX "DestructionLog_createdAt_idx" ON "DestructionLog"("createdAt");

-- CreateIndex
CREATE INDEX "User_deleteAfter_idx" ON "User"("deleteAfter");

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExport" ADD CONSTRAINT "DataExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DsrRequest" ADD CONSTRAINT "DsrRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- İmha kaydı değiştirilemez ve silinemez (denetim kanıtı)
CREATE OR REPLACE FUNCTION destruction_log_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'DestructionLog kayıtları değiştirilemez veya silinemez';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER destruction_log_no_update_delete
  BEFORE UPDATE OR DELETE ON "DestructionLog"
  FOR EACH ROW EXECUTE FUNCTION destruction_log_append_only();

-- Mevcut hesaplar: son etkinlik = son oturum kullanımı (yoksa kayıt tarihi)
UPDATE "User" u SET "lastActiveAt" = COALESCE(
  (SELECT MAX(s."lastUsedAt") FROM "Session" s WHERE s."userId" = u."id"), u."createdAt");
