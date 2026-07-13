-- AlterTable: WhatsAppNumber — guarda explicitamente a qual WABA (conta Meta
-- Business) cada numero cadastrado pertence. A tentativa anterior de
-- descobrir isso via campo da Graph API (whatsapp_business_account no node do
-- phone number) nao era confiavel e sempre caia no fallback da conta
-- principal, fazendo o sistema buscar templates na conta errada.
ALTER TABLE "WhatsAppNumber" ADD COLUMN "wabaId" TEXT;
