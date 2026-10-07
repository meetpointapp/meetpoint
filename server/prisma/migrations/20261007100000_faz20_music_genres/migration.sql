-- Faz 20: müzik zevki (eşleştirme modları)
ALTER TABLE "Profile" ADD COLUMN "musicGenres" JSONB NOT NULL DEFAULT '[]';
