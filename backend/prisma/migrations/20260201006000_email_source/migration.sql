/*
  Warnings:

  - A unique constraint covering the columns `[externalId,source]` on the table `EmailCampaign` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "EmailCampaign" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateIndex
CREATE UNIQUE INDEX "EmailCampaign_externalId_source_key" ON "EmailCampaign"("externalId", "source");
