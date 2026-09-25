-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "vibeAnswers" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "vibeArchetypeId" TEXT NOT NULL DEFAULT '';
