ALTER TYPE "MarketingStage" ADD VALUE 'CONVERSA_RESOLVIDA';

ALTER TABLE "Lead"
ADD COLUMN "marketingStageBeforeResolved" "MarketingStage";
