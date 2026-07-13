-- AlterTable: WhatsAppMessage — registra qual numero da Meta (phone_number_id)
-- enviou (outbound) ou recebeu (inbound) cada mensagem. Nulo em mensagens
-- antigas, de antes de existir mais de um numero.
ALTER TABLE "WhatsAppMessage" ADD COLUMN "phoneNumberId" TEXT;
CREATE INDEX "WhatsAppMessage_phoneNumberId_idx" ON "WhatsAppMessage"("phoneNumberId");

-- CreateTable: WhatsAppNumber — diretorio de rotulos amigaveis por numero da
-- Meta WABA (ex: "Comercial", "Campanha X"). O numero padrao/fallback continua
-- sendo a env var WHATSAPP_PHONE_NUMBER_ID.
CREATE TABLE "WhatsAppNumber" (
    "id" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayPhoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppNumber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppNumber_phoneNumberId_key" ON "WhatsAppNumber"("phoneNumberId");
