-- DropForeignKey
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_userId_fkey";

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mevcut satışlara satın alma anındaki e-posta
UPDATE "Purchase" p SET "email" = u."email" FROM "User" u WHERE u."id" = p."userId" AND p."email" = '';
