-- AlterTable: add AI agent state fields to Lead
ALTER TABLE "Lead" ADD COLUMN "aiProcessing" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN "aiProcessingAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "aiHandoff" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Lead_aiProcessing_idx" ON "Lead"("aiProcessing");
CREATE INDEX "Lead_aiHandoff_idx" ON "Lead"("aiHandoff");
