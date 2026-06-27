-- AlterTable: make homeTeamId and awayTeamId nullable, add placeholder columns
ALTER TABLE "Match" ALTER COLUMN "homeTeamId" DROP NOT NULL;
ALTER TABLE "Match" ALTER COLUMN "awayTeamId" DROP NOT NULL;
ALTER TABLE "Match" ADD COLUMN "homePlaceholder" TEXT;
ALTER TABLE "Match" ADD COLUMN "awayPlaceholder" TEXT;
