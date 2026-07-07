-- Normaliza Lead.phone pro mesmo formato usado na busca por telefone do
-- WhatsApp (so digitos, com codigo do pais). Leads criados/atualizados via
-- formulario/webhook/importacao de CSV podiam ficar com o telefone salvo com
-- formatacao original (ex: "(47) 99905-7455"), o que quebrava a comparacao
-- "contains" da busca por telefone (compara so digitos) e fazia o sistema
-- criar um lead duplicado quando a mesma pessoa escrevia no WhatsApp depois.
-- Mesma logica de utils/phone.ts normalizePhoneE164, em SQL.
UPDATE "Lead" l
SET "phone" = CASE
  WHEN d.digits = '' THEN NULL
  WHEN left(d.digits, 2) = '55' AND length(d.digits) >= 11 THEN d.digits
  WHEN length(d.digits) >= 8 THEN '55' || d.digits
  ELSE d.digits
END
FROM (
  SELECT id, regexp_replace(phone, '\D', '', 'g') AS digits
  FROM "Lead"
  WHERE phone IS NOT NULL
) d
WHERE l.id = d.id
  AND l.phone IS DISTINCT FROM (
    CASE
      WHEN d.digits = '' THEN NULL
      WHEN left(d.digits, 2) = '55' AND length(d.digits) >= 11 THEN d.digits
      WHEN length(d.digits) >= 8 THEN '55' || d.digits
      ELSE d.digits
    END
  );
