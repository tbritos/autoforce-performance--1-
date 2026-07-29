-- Pesquisa automatica de informacao na coluna "Novo" do CRM Lara — dispara
-- uma unica vez quando um lead novo chega (webhook de campanha ou primeira
-- mensagem de WhatsApp), busca dados publicos sobre a empresa/pessoa (busca
-- na web via Tavily + CNPJ via BrasilAPI) SEM mandar nenhuma mensagem, e
-- decide se o lead avanca pra Qualificacao ou Sem Interesse. Mesmo espirito
-- dos campos siteCheck*/siteVerificationSummary/siteIcpSignal ja existentes.
ALTER TABLE "Lead" ADD COLUMN "researchedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "researchInProgress" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN "researchStartedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "researchAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN "researchSummary" TEXT;
ALTER TABLE "Lead" ADD COLUMN "researchIcpSignal" TEXT;
