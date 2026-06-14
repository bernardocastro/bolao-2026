-- AlterEnum: add TOP_SCORER_HIT
ALTER TYPE "FeedPostType" ADD VALUE 'TOP_SCORER_HIT';

-- AlterTable Pool: add bonusTopScorer and topScorerResult
ALTER TABLE "Pool" ADD COLUMN "bonusTopScorer" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Pool" ADD COLUMN "topScorerResult" TEXT;

-- CreateTable TopScorerPick
CREATE TABLE "TopScorerPick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "scored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopScorerPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopScorerPick_poolId_idx" ON "TopScorerPick"("poolId");
CREATE UNIQUE INDEX "TopScorerPick_userId_poolId_key" ON "TopScorerPick"("userId", "poolId");

-- AddForeignKey
ALTER TABLE "TopScorerPick" ADD CONSTRAINT "TopScorerPick_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TopScorerPick" ADD CONSTRAINT "TopScorerPick_poolId_fkey"
    FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
