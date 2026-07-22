-- Garante que o agente de IA do WhatsApp so ative em mensagens recebidas no
-- numero dele, nao em respostas a disparos feitos por outros numeros
-- cadastrados. Aditivo — null = usa o fallback do env var
-- WHATSAPP_PHONE_NUMBER_ID (ver isAgentPhoneNumber em whatsapp.service.ts).

ALTER TABLE "AIAgent" ADD COLUMN "whatsappPhoneNumberId" TEXT;
