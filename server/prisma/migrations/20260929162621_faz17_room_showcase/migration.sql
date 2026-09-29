-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "roomShowcaseOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "roomUpdatedAt" TIMESTAMP(3);
