-- Classificacao de falha de envio de WhatsApp (permanente vs transitorio).
-- Aditiva, sem DROP.

ALTER TABLE "Lead" ADD COLUMN "whatsappInvalidAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "whatsappInvalidReason" TEXT;

CREATE INDEX "Lead_whatsappInvalidAt_idx" ON "Lead"("whatsappInvalidAt");

ALTER TABLE "WhatsAppMessage" ADD COLUMN "errorCode" INTEGER;
ALTER TABLE "WhatsAppMessage" ADD COLUMN "errorTitle" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN "errorMessage" TEXT;
