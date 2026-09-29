-- CreateTable
CREATE TABLE "TicTacToeGame" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "starterId" TEXT NOT NULL,
    "board" JSONB NOT NULL DEFAULT '[null,null,null,null,null,null,null,null,null]',
    "turnUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicTacToeGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicTacToeGame_conversationId_createdAt_idx" ON "TicTacToeGame"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "TicTacToeGame" ADD CONSTRAINT "TicTacToeGame_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
