-- Faz 20: "sadece eşleştiklerim arayabilsin" tercihi
ALTER TABLE "User" ADD COLUMN "callsMatchesOnly" BOOLEAN NOT NULL DEFAULT false;
