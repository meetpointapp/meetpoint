-- Faz 24: keşfette geri al
CREATE TABLE "SwipeUndo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SwipeUndo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SwipeUndo_userId_createdAt_idx" ON "SwipeUndo"("userId", "createdAt");
