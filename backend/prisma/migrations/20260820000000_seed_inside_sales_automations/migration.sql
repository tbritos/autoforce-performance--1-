-- Estrutura inicial da cadência Inside Sales 2026.
-- Todos os fluxos começam como rascunho: os templates HSM de WhatsApp
-- precisam ser selecionados depois que a Meta aprovar os nomes.

INSERT INTO "AutomationNurtureGroup" ("id", "name", "priority", "canInterruptLowerPriority", "queueTtlHours", "updatedAt")
VALUES
  ('nurture_inside_sales_2026_a', 'Inside Sales 2026 — Funil A — Marketing', 70, true, NULL, CURRENT_TIMESTAMP),
  ('nurture_inside_sales_2026_b', 'Inside Sales 2026 — Funil B — Comercial', 70, true, NULL, CURRENT_TIMESTAMP),
  ('nurture_inside_sales_2026_c', 'Inside Sales 2026 — Funil C — CRM', 70, true, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- E-mail: cada persona tem uma sequência própria de cinco templates.
WITH journeys(id, name, description, group_id, condition_value, template_ids, tags) AS (
  VALUES
  ('journey_inside_sales_2026_email_a', 'Inside Sales 2026 — Funil A — E-mails', 'Cadência de nutrição para Marketing. Leads fora do cargo são encerrados neste fluxo.', 'nurture_inside_sales_2026_a', 'marketing,marketing digital,gestora de marketing,analista de marketing,coordenadora de marketing,head de marketing', ARRAY['seed_inside_sales_2026_a_e1_d0','seed_inside_sales_2026_a_e2_d2','seed_inside_sales_2026_a_e3_d4','seed_inside_sales_2026_a_e4_d7','seed_inside_sales_2026_a_e5_d10'], ARRAY['respondeu-sequencia','analise-agendada','descadastrado','email-invalido']),
  ('journey_inside_sales_2026_email_b', 'Inside Sales 2026 — Funil B — E-mails', 'Cadência de nutrição para Comercial e liderança. Leads fora do cargo são encerrados neste fluxo.', 'nurture_inside_sales_2026_b', 'diretor comercial,superintendente comercial,ceo,dono,socio,sócio,gerente comercial,gerente geral', ARRAY['seed_inside_sales_2026_b_e1_d0','seed_inside_sales_2026_b_e2_d2','seed_inside_sales_2026_b_e3_d4','seed_inside_sales_2026_b_e4_d7','seed_inside_sales_2026_b_e5_d10'], ARRAY['respondeu-sequencia','analise-agendada','descadastrado','email-invalido']),
  ('journey_inside_sales_2026_email_c', 'Inside Sales 2026 — Funil C — E-mails', 'Cadência de nutrição para CRM e Inside Sales. Leads fora do cargo são encerrados neste fluxo.', 'nurture_inside_sales_2026_c', 'gerente de crm,coordenador de crm,gestor de inside sales,analista de crm,bdc manager', ARRAY['seed_inside_sales_2026_c_e1_d0','seed_inside_sales_2026_c_e2_d2','seed_inside_sales_2026_c_e3_d4','seed_inside_sales_2026_c_e4_d7','seed_inside_sales_2026_c_e5_d10'], ARRAY['respondeu-sequencia','analise-agendada','descadastrado','email-invalido'])
)
INSERT INTO "AutomationJourney" ("id","name","description","status","nodes","edges","triggerType","isActive","exitConditions","automationType","entryMode","priority","canInterruptLowerPriority","queueTtlHours","nurtureGroupId","updatedAt")
SELECT id, name, description, 'DRAFT',
  jsonb_build_array(
    jsonb_build_object('id','trigger','type','trigger','label','Ebook Inside Sales','x',0,'y',0,'config',jsonb_build_object('event','conversion_received','eventValue','Ebook Inside Sales')),
    jsonb_build_object('id','cargo','type','condition','label','Cargo do funil','x',280,'y',0,'config',jsonb_build_object('field','jobTitle','operator','contains','value',condition_value)),
    jsonb_build_object('id','e1','type','send_email','label','E-mail 1 — imediato','x',560,'y',0,'config',jsonb_build_object('templateId',template_ids[1],'templateName',template_ids[1],'communicationType','MARKETING','fromEmail','autoforce@updates.autoforce.com')),
    jsonb_build_object('id','w2','type','wait','label','Aguardar 26 horas','x',840,'y',0,'config',jsonb_build_object('amount','26','unit','hours')),
    jsonb_build_object('id','e2','type','send_email','label','E-mail 2 — D2','x',1120,'y',0,'config',jsonb_build_object('templateId',template_ids[2],'templateName',template_ids[2],'communicationType','MARKETING','fromEmail','autoforce@updates.autoforce.com')),
    jsonb_build_object('id','w3','type','wait','label','Aguardar 48 horas','x',1400,'y',0,'config',jsonb_build_object('amount','48','unit','hours')),
    jsonb_build_object('id','e3','type','send_email','label','E-mail 3 — D4','x',1680,'y',0,'config',jsonb_build_object('templateId',template_ids[3],'templateName',template_ids[3],'communicationType','MARKETING','fromEmail','autoforce@updates.autoforce.com')),
    jsonb_build_object('id','w4','type','wait','label','Aguardar 72 horas','x',1960,'y',0,'config',jsonb_build_object('amount','72','unit','hours')),
    jsonb_build_object('id','e4','type','send_email','label','E-mail 4 — D7','x',2240,'y',0,'config',jsonb_build_object('templateId',template_ids[4],'templateName',template_ids[4],'communicationType','MARKETING','fromEmail','autoforce@updates.autoforce.com')),
    jsonb_build_object('id','w5','type','wait','label','Aguardar 72 horas','x',2520,'y',0,'config',jsonb_build_object('amount','72','unit','hours')),
    jsonb_build_object('id','e5','type','send_email','label','E-mail 5 — D10','x',2800,'y',0,'config',jsonb_build_object('templateId',template_ids[5],'templateName',template_ids[5],'communicationType','MARKETING','fromEmail','autoforce@updates.autoforce.com'))
  ),
  jsonb_build_array(
    jsonb_build_object('id','a1','source','trigger','target','cargo'),jsonb_build_object('id','a2','source','cargo','target','e1','sourceHandle','true'),jsonb_build_object('id','a3','source','e1','target','w2'),jsonb_build_object('id','a4','source','w2','target','e2'),jsonb_build_object('id','a5','source','e2','target','w3'),jsonb_build_object('id','a6','source','w3','target','e3'),jsonb_build_object('id','a7','source','e3','target','w4'),jsonb_build_object('id','a8','source','w4','target','e4'),jsonb_build_object('id','a9','source','e4','target','w5'),jsonb_build_object('id','a10','source','w5','target','e5')
  ), 'conversion_received', false,
  jsonb_build_object('logic','OR','conditions',jsonb_build_array(jsonb_build_object('field','tag','operator','has_tag','value',tags[1]),jsonb_build_object('field','tag','operator','has_tag','value',tags[2]),jsonb_build_object('field','tag','operator','has_tag','value',tags[3]),jsonb_build_object('field','tag','operator','has_tag','value',tags[4]))),
  'NURTURE','TRIGGER',70,true,NULL,group_id,CURRENT_TIMESTAMP
FROM journeys
ON CONFLICT ("id") DO NOTHING;

-- WhatsApp: WPP 1, WPP 2 e WPP 5 ficam em uma sequência; o WPP 3 é acionado
-- pelo clique do E-mail 3 e fica em uma jornada separada do mesmo grupo.
WITH journeys(id, name, description, group_id, condition_value, persona) AS (
  VALUES
  ('journey_inside_sales_2026_wpp_a', 'Inside Sales 2026 — Funil A — WhatsApp', 'WPP 1, WPP 2 e WPP 5. Selecione os templates HSM aprovados pela Meta nos blocos.', 'nurture_inside_sales_2026_a', 'marketing,marketing digital,gestora de marketing,analista de marketing,coordenadora de marketing,head de marketing', 'a'),
  ('journey_inside_sales_2026_wpp_b', 'Inside Sales 2026 — Funil B — WhatsApp', 'WPP 1, WPP 2 e WPP 5. Selecione os templates HSM aprovados pela Meta nos blocos.', 'nurture_inside_sales_2026_b', 'diretor comercial,superintendente comercial,ceo,dono,socio,sócio,gerente comercial,gerente geral', 'b'),
  ('journey_inside_sales_2026_wpp_c', 'Inside Sales 2026 — Funil C — WhatsApp', 'WPP 1, WPP 2 e WPP 5. Selecione os templates HSM aprovados pela Meta nos blocos.', 'nurture_inside_sales_2026_c', 'gerente de crm,coordenador de crm,gestor de inside sales,analista de crm,bdc manager', 'c')
)
INSERT INTO "AutomationJourney" ("id","name","description","status","nodes","edges","triggerType","isActive","exitConditions","automationType","entryMode","priority","canInterruptLowerPriority","queueTtlHours","nurtureGroupId","updatedAt")
SELECT id, name, description, 'DRAFT',
  jsonb_build_array(
    jsonb_build_object('id','trigger','type','trigger','label','Ebook Inside Sales','x',0,'y',0,'config',jsonb_build_object('event','conversion_received','eventValue','Ebook Inside Sales')),
    jsonb_build_object('id','cargo','type','condition','label','Cargo do funil','x',280,'y',0,'config',jsonb_build_object('field','jobTitle','operator','contains','value',condition_value)),
    jsonb_build_object('id','wpp1','type','whatsapp_message','label','WPP 1 — até 15 minutos','x',560,'y',0,'config',jsonb_build_object('templateName','inside_sales_2026_'||persona||'_wpp1','phoneField','phone','utmCampaign','cadencia_inside_sales_2026')),
    jsonb_build_object('id','reply','type','whatsapp_wait_reply','label','Aguardar resposta por 48 horas','x',840,'y',0,'config',jsonb_build_object('amount','48','unit','hours')),
    jsonb_build_object('id','wpp2','type','whatsapp_message','label','WPP 2 — 48 horas','x',1120,'y',0,'config',jsonb_build_object('templateName','inside_sales_2026_'||persona||'_wpp2','phoneField','phone','utmCampaign','cadencia_inside_sales_2026')),
    jsonb_build_object('id','w5','type','wait','label','Aguardar 7 dias','x',1400,'y',0,'config',jsonb_build_object('amount','7','unit','days')),
    jsonb_build_object('id','wpp5','type','whatsapp_message','label','WPP 5 — encerramento','x',1680,'y',0,'config',jsonb_build_object('templateName','inside_sales_2026_'||persona||'_wpp5','phoneField','phone','utmCampaign','cadencia_inside_sales_2026'))
  ),
  jsonb_build_array(jsonb_build_object('id','a1','source','trigger','target','cargo'),jsonb_build_object('id','a2','source','cargo','target','wpp1','sourceHandle','true'),jsonb_build_object('id','a3','source','wpp1','target','reply'),jsonb_build_object('id','a4','source','reply','target','wpp2','sourceHandle','no_reply'),jsonb_build_object('id','a5','source','wpp2','target','w5'),jsonb_build_object('id','a6','source','w5','target','wpp5')),
  'conversion_received', false,
  jsonb_build_object('logic','OR','conditions',jsonb_build_array(jsonb_build_object('field','tag','operator','has_tag','value','analise-agendada'),jsonb_build_object('field','tag','operator','has_tag','value','descadastrado'),jsonb_build_object('field','tag','operator','has_tag','value','wpp-bloqueado'))),
  'NURTURE','TRIGGER',70,true,NULL,group_id,CURRENT_TIMESTAMP
FROM journeys
ON CONFLICT ("id") DO NOTHING;

WITH journeys(id, name, group_id, condition_value, persona, click_tag) AS (
  VALUES
  ('journey_inside_sales_2026_wpp3_a', 'Inside Sales 2026 — Funil A — WhatsApp — WPP 3 CTA', 'nurture_inside_sales_2026_a', 'marketing,marketing digital,gestora de marketing,analista de marketing,coordenadora de marketing,head de marketing', 'a', 'clicou-cta-analise-e3-a'),
  ('journey_inside_sales_2026_wpp3_b', 'Inside Sales 2026 — Funil B — WhatsApp — WPP 3 CTA', 'nurture_inside_sales_2026_b', 'diretor comercial,superintendente comercial,ceo,dono,socio,sócio,gerente comercial,gerente geral', 'b', 'clicou-cta-analise-e3-b'),
  ('journey_inside_sales_2026_wpp3_c', 'Inside Sales 2026 — Funil C — WhatsApp — WPP 3 CTA', 'nurture_inside_sales_2026_c', 'gerente de crm,coordenador de crm,gestor de inside sales,analista de crm,bdc manager', 'c', 'clicou-cta-analise-e3-c')
)
INSERT INTO "AutomationJourney" ("id","name","description","status","nodes","edges","triggerType","isActive","exitConditions","automationType","entryMode","priority","canInterruptLowerPriority","queueTtlHours","nurtureGroupId","updatedAt")
SELECT id, name, 'WPP 3 disparado após clique no CTA do E-mail 3. Selecione o template HSM aprovado pela Meta.', 'DRAFT',
  jsonb_build_array(jsonb_build_object('id','trigger','type','trigger','label','Clique no CTA do E-mail 3','x',0,'y',0,'config',jsonb_build_object('event','tag_added','eventValue',click_tag)),jsonb_build_object('id','cargo','type','condition','label','Cargo do funil','x',280,'y',0,'config',jsonb_build_object('field','jobTitle','operator','contains','value',condition_value)),jsonb_build_object('id','wpp3','type','whatsapp_message','label','WPP 3 — confirmação da análise','x',560,'y',0,'config',jsonb_build_object('templateName','inside_sales_2026_'||persona||'_wpp3','phoneField','phone','utmCampaign','cadencia_inside_sales_2026'))),
  jsonb_build_array(jsonb_build_object('id','a1','source','trigger','target','cargo'),jsonb_build_object('id','a2','source','cargo','target','wpp3','sourceHandle','true')),
  'tag_added', false, jsonb_build_object('logic','OR','conditions',jsonb_build_array(jsonb_build_object('field','tag','operator','has_tag','value','analise-agendada'),jsonb_build_object('field','tag','operator','has_tag','value','descadastrado'))), 'NURTURE','TRIGGER',70,true,NULL,group_id,CURRENT_TIMESTAMP
FROM journeys
ON CONFLICT ("id") DO NOTHING;
