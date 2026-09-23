-- AlterTable
ALTER TABLE "User" ADD COLUMN "boostedUntil" DATETIME;
ALTER TABLE "User" ADD COLUMN "likesUnlockedUntil" DATETIME;

-- CreateTable
CREATE TABLE "Device" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT NOT NULL,
    "photoPath" TEXT,
    "viewedAt" DATETIME,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("body", "conversationId", "createdAt", "id", "senderId") SELECT "body", "conversationId", "createdAt", "id", "senderId" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE TABLE "new_Profile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "birthDate" DATETIME NOT NULL,
    "gender" TEXT NOT NULL,
    "interestedIn" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "interests" JSONB NOT NULL DEFAULT [],
    "prompts" JSONB NOT NULL DEFAULT [],
    "lookingFor" TEXT NOT NULL DEFAULT '',
    "heightCm" INTEGER,
    "job" TEXT NOT NULL DEFAULT '',
    "education" TEXT NOT NULL DEFAULT '',
    "zodiac" TEXT NOT NULL DEFAULT '',
    "smoking" TEXT NOT NULL DEFAULT '',
    "drinking" TEXT NOT NULL DEFAULT '',
    "latitude" REAL,
    "longitude" REAL,
    "locationAt" DATETIME,
    "filterMinAge" INTEGER NOT NULL DEFAULT 18,
    "filterMaxAge" INTEGER NOT NULL DEFAULT 80,
    "filterMaxKm" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("bio", "birthDate", "city", "country", "displayName", "drinking", "education", "gender", "heightCm", "interestedIn", "interests", "job", "lookingFor", "prompts", "smoking", "updatedAt", "userId", "zodiac") SELECT "bio", "birthDate", "city", "country", "displayName", "drinking", "education", "gender", "heightCm", "interestedIn", "interests", "job", "lookingFor", "prompts", "smoking", "updatedAt", "userId", "zodiac" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Device_userId_idx" ON "Device"("userId");
