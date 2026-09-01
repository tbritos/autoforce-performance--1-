-- Cadência inicial do e-book Raio-X das Marcas Chinesas.
-- Há uma jornada por persona; cada uma entrega o e-book imediatamente.

INSERT INTO "AutomationNurtureGroup"
  ("id", "name", "priority", "canInterruptLowerPriority", "queueTtlHours", "updatedAt")
VALUES
  ('nurture_raio_x_marcas_chinesas', 'Ebook Raio-X Marcas Chinesas', 75, true, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

WITH journeys(id, name, description, condition_value, persona) AS (
  VALUES
    (
      'journey_raio_x_marcas_chinesas_email_a',
      'Raio-X Marcas Chinesas — Persona A — Marketing',
      'Entrega do e-book para profissionais de marketing e marketing digital.',
      'marketing,marketing digital,gestora de marketing,analista de marketing,coordenadora de marketing,head de marketing',
      'a'
    ),
    (
      'journey_raio_x_marcas_chinesas_email_b',
      'Raio-X Marcas Chinesas — Persona B — Comercial',
      'Entrega do e-book para liderança comercial, donos e sócios.',
      'diretor comercial,superintendente comercial,ceo,dono,socio,sócio,gerente comercial,gerente geral',
      'b'
    ),
    (
      'journey_raio_x_marcas_chinesas_email_c',
      'Raio-X Marcas Chinesas — Persona C — CRM e Inside Sales',
      'Entrega do e-book para profissionais de CRM e Inside Sales.',
      'gerente de crm,coordenador de crm,gestor de inside sales,analista de crm,bdc manager',
      'c'
    )
)
INSERT INTO "AutomationJourney"
  ("id", "name", "description", "status", "nodes", "edges", "triggerType", "isActive",
   "exitConditions", "automationType", "entryMode", "priority", "canInterruptLowerPriority",
   "queueTtlHours", "nurtureGroupId", "updatedAt")
SELECT
  id,
  name,
  description,
  'DRAFT',
  jsonb_build_array(
    jsonb_build_object(
      'id', 'trigger', 'type', 'trigger', 'label', 'Conversão — Ebook Raio-X Marcas Chinesas',
      'x', 0, 'y', 0,
      'config', jsonb_build_object('event', 'conversion_received', 'eventValue', 'Ebook Raio-X Marcas Chinesas')
    ),
    jsonb_build_object(
      'id', 'persona', 'type', 'condition', 'label', 'Persona — ' || upper(persona),
      'x', 320, 'y', 0,
      'config', jsonb_build_object('field', 'jobTitle', 'operator', 'contains', 'value', condition_value)
    ),
    jsonb_build_object(
      'id', 'entrega', 'type', 'send_email', 'label', 'E-mail 1 — Entrega do e-book',
      'x', 680, 'y', 0,
      'config', jsonb_build_object(
        'templateId', 'cm_raio_x_marcas_chinesas_entrega',
        'templateName', 'cm_raio_x_marcas_chinesas_entrega',
        'communicationType', 'MARKETING',
        'fromEmail', 'autoforce@autoforce.com'
      )
    )
  ),
  jsonb_build_array(
    jsonb_build_object('id', 'a1', 'source', 'trigger', 'target', 'persona'),
    jsonb_build_object('id', 'a2', 'source', 'persona', 'target', 'entrega', 'sourceHandle', 'true')
  ),
  'conversion_received',
  false,
  jsonb_build_object(
    'logic', 'OR',
    'conditions', jsonb_build_array(
      jsonb_build_object('field', 'tag', 'operator', 'has_tag', 'value', 'descadastrado'),
      jsonb_build_object('field', 'tag', 'operator', 'has_tag', 'value', 'email-invalido'),
      jsonb_build_object('field', 'tag', 'operator', 'has_tag', 'value', 'respondeu-sequencia')
    )
  ),
  'NURTURE', 'TRIGGER', 75, true, NULL,
  'nurture_raio_x_marcas_chinesas', CURRENT_TIMESTAMP
FROM journeys
ON CONFLICT ("id") DO NOTHING;
