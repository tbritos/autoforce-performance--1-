/*
  Warnings:

  - A unique constraint covering the columns `[path]` on the table `LandingPage` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DailyLead" ALTER COLUMN "date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "mql" SET DEFAULT 0,
ALTER COLUMN "sql" SET DEFAULT 0,
ALTER COLUMN "sales" SET DEFAULT 0,
ALTER COLUMN "conversionRate" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "LandingPage" ADD COLUMN     "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalClicks" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_path_key" ON "LandingPage"("path");
