-- Faz 20: satın alınan süper beğeni hakları
ALTER TABLE "Profile" ADD COLUMN "superLikeCredits" INTEGER NOT NULL DEFAULT 0;
