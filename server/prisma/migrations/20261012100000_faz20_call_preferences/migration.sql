-- Faz 20: kullanıcı gelen sesli/görüntülü arama almayı kapatabilir
ALTER TABLE "User" ADD COLUMN "acceptVoiceCalls" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "acceptVideoCalls" BOOLEAN NOT NULL DEFAULT true;
