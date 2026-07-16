-- Additive: snapshot of the Pipedrive deal's current pipeline/stage/value, used for the Forecast view
ALTER TABLE "Lead" ADD COLUMN "pipedrivePipelineId" INTEGER;
ALTER TABLE "Lead" ADD COLUMN "pipedriveStageId" INTEGER;
ALTER TABLE "Lead" ADD COLUMN "pipedriveStageName" TEXT;
ALTER TABLE "Lead" ADD COLUMN "pipedriveDealStatus" TEXT;
ALTER TABLE "Lead" ADD COLUMN "pipedriveDealValue" DOUBLE PRECISION;
ALTER TABLE "Lead" ADD COLUMN "pipedriveSetupValue" DOUBLE PRECISION;

CREATE INDEX "Lead_pipedriveDealStatus_idx" ON "Lead"("pipedriveDealStatus");
CREATE INDEX "Lead_pipedriveStageId_idx" ON "Lead"("pipedriveStageId");
