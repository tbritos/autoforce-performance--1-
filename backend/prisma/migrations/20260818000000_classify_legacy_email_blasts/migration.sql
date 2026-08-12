-- Disparos criados antes da classificação não informavam a categoria. O
-- fallback conservador preserva os descadastros históricos da newsletter;
-- disparos novos exigem classificação explícita na API e na interface.
UPDATE "EmailBlast"
SET "communicationType" = 'NEWSLETTER';
