-- Follow-up automatico do agente de WhatsApp apos N horas de silencio do
-- lead. Migracao so aditiva.

ALTER TABLE "Lead" ADD COLUMN "followUpCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AIAgent" ADD COLUMN "followUpDelayHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "AIAgent" ADD COLUMN "followUpMaxAttempts" INTEGER NOT NULL DEFAULT 2;
