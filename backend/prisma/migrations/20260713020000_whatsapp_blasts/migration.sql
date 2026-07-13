-- AlterTable: WhatsAppMessage — marca qual disparo avulso (fora de automacao)
-- gerou essa mensagem, mesmo padrao de automationJourneyId/automationExecutionId.
ALTER TABLE "WhatsAppMessage" ADD COLUMN "whatsAppBlastId" TEXT;
CREATE INDEX "WhatsAppMessage_whatsAppBlastId_idx" ON "WhatsAppMessage"("whatsAppBlastId");

-- CreateTable: WhatsAppBlast — disparo avulso de WhatsApp (tag/segmento/individual),
-- equivalente ao EmailBlast. Nao tem tabela de "envios" separada: status de
-- entrega/leitura ja vem de WhatsAppMessage via webhook.
CREATE TABLE "WhatsAppBlast" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateLanguage" TEXT NOT NULL DEFAULT 'pt_BR',
    "varMappings" JSONB NOT NULL DEFAULT '{}',
    "audienceType" TEXT NOT NULL,
    "audienceValue" TEXT NOT NULL,
    "audienceCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppBlast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WhatsAppBlast_status_idx" ON "WhatsAppBlast"("status");
CREATE INDEX "WhatsAppBlast_scheduledAt_idx" ON "WhatsAppBlast"("scheduledAt");
CREATE INDEX "WhatsAppBlast_createdAt_idx" ON "WhatsAppBlast"("createdAt");
