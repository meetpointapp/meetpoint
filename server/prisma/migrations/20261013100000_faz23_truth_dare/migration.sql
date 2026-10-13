-- Faz 23: Doğruluk mu Cesaret mi oyunu
CREATE TABLE "TruthDareGame" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "round" INTEGER NOT NULL DEFAULT 1,
    "totalRounds" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "TruthDareGame_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TruthDareGame_userAId_status_idx" ON "TruthDareGame"("userAId", "status");
CREATE INDEX "TruthDareGame_userBId_status_idx" ON "TruthDareGame"("userBId", "status");
CREATE INDEX "TruthDareGame_initiatorId_createdAt_idx" ON "TruthDareGame"("initiatorId", "createdAt");

CREATE TABLE "TruthDareRound" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "aChoice" TEXT NOT NULL DEFAULT '',
    "aPrompt" TEXT NOT NULL DEFAULT '',
    "aAnswer" TEXT NOT NULL DEFAULT '',
    "aAnsweredAt" TIMESTAMP(3),
    "bChoice" TEXT NOT NULL DEFAULT '',
    "bPrompt" TEXT NOT NULL DEFAULT '',
    "bAnswer" TEXT NOT NULL DEFAULT '',
    "bAnsweredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TruthDareRound_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TruthDareRound_gameId_index_key" ON "TruthDareRound"("gameId", "index");

ALTER TABLE "TruthDareGame" ADD CONSTRAINT "TruthDareGame_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TruthDareGame" ADD CONSTRAINT "TruthDareGame_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TruthDareRound" ADD CONSTRAINT "TruthDareRound_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "TruthDareGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
