CREATE TYPE "MarketingStage" AS ENUM (
  'NOVO', 'QUALIFICACAO', 'NUTRICAO', 'AGUARDANDO_FOLLOWUP',
  'AGENDA_ENVIADA', 'REUNIAO_AGENDADA', 'SEM_INTERESSE', 'TRANSFERIDO_HUMANO'
);

ALTER TABLE "Lead" ADD COLUMN "marketingStage" "MarketingStage" NOT NULL DEFAULT 'NOVO';
ALTER TABLE "Lead" ADD COLUMN "marketingStageChangedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "marketingStageSource" TEXT;

CREATE INDEX "Lead_marketingStage_idx" ON "Lead"("marketingStage");
