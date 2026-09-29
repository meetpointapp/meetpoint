-- CreateTable
CREATE TABLE "IcebreakerGame" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "starterId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "promptId" TEXT NOT NULL DEFAULT '',
    "statements" JSONB NOT NULL DEFAULT '[]',
    "lieIndex" INTEGER,
    "starterChoice" TEXT NOT NULL DEFAULT '',
    "responderId" TEXT,
    "responderChoice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "IcebreakerGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IcebreakerGame_conversationId_createdAt_idx" ON "IcebreakerGame"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "IcebreakerGame" ADD CONSTRAINT "IcebreakerGame_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
