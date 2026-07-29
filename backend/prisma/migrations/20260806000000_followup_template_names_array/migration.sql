-- Follow-up: suporta uma sequencia de templates (um por tentativa), em vez de
-- um unico template repetido em todo follow-up automatico — evita mandar a
-- mesma mensagem varias vezes pro mesmo lead quando ele nao responde.
-- followUpTemplateName (coluna antiga) fica orfa no banco (nunca removida,
-- so deixa de ser lida/escrita pelo codigo) — migracao aditiva, sem DROP.
ALTER TABLE "AIAgent" ADD COLUMN "followUpTemplateNames" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "AIAgent"
SET "followUpTemplateNames" = ARRAY["followUpTemplateName"]
WHERE "followUpTemplateName" IS NOT NULL AND "followUpTemplateName" != '';
