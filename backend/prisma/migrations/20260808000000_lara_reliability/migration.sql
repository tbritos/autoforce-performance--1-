-- Confiabilidade da Lara: score proprio, restauracao apos handoff e
-- idempotencia persistente das mensagens inbound.

ALTER TABLE "Lead" ADD COLUMN "aiScore" INTEGER;
ALTER TABLE "Lead" ADD COLUMN "marketingStageBeforeHandoff" "MarketingStage";
ALTER TABLE "WhatsAppMessage" ADD COLUMN "aiProcessedAt" TIMESTAMP(3);

-- Mensagens anteriores a esta migration ja foram tratadas (ou sao historicas).
-- Marcar o backlog evita que o primeiro webhook novo gere respostas retroativas.
UPDATE "WhatsAppMessage"
SET "aiProcessedAt" = COALESCE("receivedAt", "createdAt")
WHERE "direction" = 'inbound';

-- Aproveita a memoria mais recente da Lara para preencher o CRM existente.
WITH latest_memory AS (
  SELECT DISTINCT ON ("leadEmail")
    "leadEmail",
    ("knownFacts"->>'score')::INTEGER AS score
  FROM "AIConversationMemory"
  WHERE ("knownFacts"->>'score') ~ '^[0-9]+$'
  ORDER BY "leadEmail", "updatedAt" DESC
)
UPDATE "Lead" AS lead
SET "aiScore" = LEAST(100, GREATEST(0, latest_memory.score))
FROM latest_memory
WHERE lead."email" = latest_memory."leadEmail";

CREATE INDEX "Lead_aiScore_idx" ON "Lead"("aiScore");
CREATE INDEX "WhatsAppMessage_direction_aiProcessedAt_idx"
  ON "WhatsAppMessage"("direction", "aiProcessedAt");
