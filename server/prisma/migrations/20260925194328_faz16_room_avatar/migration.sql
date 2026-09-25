-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "avatarAccessoryId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "avatarHairColorId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "avatarHairStyle" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "avatarOutfitId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "avatarSkinId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "roomFloorId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "roomItems" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "roomWallpaperId" TEXT NOT NULL DEFAULT '';
