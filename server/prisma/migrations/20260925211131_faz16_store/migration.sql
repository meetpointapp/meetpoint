-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "badgeId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "chatBackgroundThemeId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "chatBubbleThemeId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "frameId" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "StorePurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorePurchase_userId_itemId_key" ON "StorePurchase"("userId", "itemId");

-- AddForeignKey
ALTER TABLE "StorePurchase" ADD CONSTRAINT "StorePurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
