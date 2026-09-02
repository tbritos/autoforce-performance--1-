-- O formulário do e-book oferece cargos genéricos. Ajusta as condições para
-- os valores realmente gravados e mantém uma única persona por lead.
WITH persona_values("id", "value") AS (
  VALUES
    ('journey_raio_x_marcas_chinesas_email_a', 'analista,coordenador'),
    ('journey_raio_x_marcas_chinesas_email_b', 'diretor,dono,sócio,gerente'),
    ('journey_raio_x_marcas_chinesas_email_c', 'gestor')
)
UPDATE "AutomationJourney" AS journey
SET "nodes" = (
  SELECT jsonb_agg(
    CASE
      WHEN node->>'type' = 'condition'
      THEN jsonb_set(node, '{config,value}', to_jsonb(persona_values."value"))
      ELSE node
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(journey."nodes") WITH ORDINALITY AS items(node, ordinality)
)
FROM persona_values
WHERE journey."id" = persona_values."id";
