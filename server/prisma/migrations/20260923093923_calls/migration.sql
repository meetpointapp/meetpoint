-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callerId" TEXT NOT NULL,
    "calleeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ratePerMin" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RINGING',
    "endReason" TEXT NOT NULL DEFAULT '',
    "billedMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalCoins" INTEGER NOT NULL DEFAULT 0,
    "giftCoins" INTEGER NOT NULL DEFAULT 0,
    "callerRating" INTEGER,
    "calleeRating" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" DATETIME,
    "endedAt" DATETIME,
    CONSTRAINT "Call_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Call_calleeId_fkey" FOREIGN KEY ("calleeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CallGift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallGift_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CallGift_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CallGift_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Call_callerId_createdAt_idx" ON "Call"("callerId", "createdAt");

-- CreateIndex
CREATE INDEX "Call_calleeId_createdAt_idx" ON "Call"("calleeId", "createdAt");

-- CreateIndex
CREATE INDEX "Call_status_idx" ON "Call"("status");

-- CreateIndex
CREATE INDEX "CallGift_callId_idx" ON "CallGift"("callId");
