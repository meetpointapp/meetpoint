-- Faz 20: mesaj isteğinde jeton emaneti + günlük beğeni hakkı
ALTER TABLE "ContactRequest" ADD COLUMN "escrow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "escrowUntil" TIMESTAMP(3),
ADD COLUMN "qualifiedReplies" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "settlement" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Profile" ADD COLUMN "likesResetAt" TIMESTAMP(3);

CREATE INDEX "ContactRequest_escrow_escrowUntil_idx" ON "ContactRequest"("escrow", "escrowUntil");
