-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("bio", "birthDate", "city", "country", "displayName", "gender", "interestedIn", "updatedAt", "userId") SELECT "bio", "birthDate", "city", "country", "displayName", "gender", "interestedIn", "updatedAt", "userId" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
