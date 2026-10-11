-- Faz 20: satın alınmış haktan giden süper beğeniler günlük ücretsiz sayıma katılmaz
ALTER TABLE "Swipe" ADD COLUMN "superPaid" BOOLEAN NOT NULL DEFAULT false;
