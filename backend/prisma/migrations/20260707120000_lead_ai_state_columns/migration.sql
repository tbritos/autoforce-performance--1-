-- AlterTable: Lead — colunas proprias para bookkeeping interno do agente de IA
-- que ate agora era guardado dentro do array de tags (ex: "__booking_link_sent:
-- <timestamp>", "__slots__<json>"), poluindo a lista de tags visivel pro usuario
-- e crescendo sem parar (cada tag carregava um timestamp/JSON unico).
ALTER TABLE "Lead" ADD COLUMN "bookingLinkSentAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "pendingMeetingSlots" JSONB;

-- Remove os tags internos (prefixo "__") que ja existem nos leads. Sao valores
-- efemeros de bookkeeping -- perde-los apenas reseta o cooldown/selecao de
-- horario em andamento, sem perda de dado relevante para o usuario.
UPDATE "Lead"
SET "tags" = ARRAY(
  SELECT t FROM unnest("tags") AS t
  WHERE left(t, 2) != '__'
)
WHERE EXISTS (
  SELECT 1 FROM unnest("tags") AS t2 WHERE left(t2, 2) = '__'
);
