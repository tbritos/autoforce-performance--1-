-- Régua Nitro Ads para clientes AutoForce. Nasce como rascunho para que os
-- templates de e-mail e WhatsApp sejam selecionados pelo time antes de ativar.
INSERT INTO "AutomationNurtureGroup" ("id", "name", "priority", "canInterruptLowerPriority", "queueTtlHours", "updatedAt")
VALUES ('nurture_nitroads_clientes', 'Nitro Ads — Clientes', 70, true, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "AutomationJourney" (
  "id", "name", "description", "status", "nodes", "edges", "triggerType", "isActive",
  "exitConditions", "automationType", "entryMode", "priority", "canInterruptLowerPriority",
  "queueTtlHours", "nurtureGroupId", "updatedAt"
)
SELECT
  'journey_nitroads_clientes',
  'Nitro Ads — Clientes — E-mail + WhatsApp',
  'Régua de cross-sell para clientes AutoForce sem Nitro Ads. Selecione os 5 templates de e-mail e os 5 templates de WhatsApp antes de ativar.',
  'DRAFT',
  jsonb_build_array(
    jsonb_build_object('id','trigger','type','trigger','label','Entrou em Clientes','x',0,'y',240,'config',jsonb_build_object('event','segment_entered','eventValue',(SELECT "id" FROM "Segment" WHERE lower("name") = lower('Clientes') LIMIT 1))),
    jsonb_build_object('id','exclude','type','condition','label','Não está em Nitro Ads Desconsiderar','x',280,'y',240,'config',jsonb_build_object('field','segment','operator','not_in_segment','value',(SELECT "id" FROM "Segment" WHERE lower("name") = lower('Nitro Ads Desconsiderar') LIMIT 1))),
    jsonb_build_object('id','e1','type','send_email','label','E-mail 1 — D0','x',600,'y',80,'config',jsonb_build_object('templateId','','templateName','','communicationType','MARKETING','fromEmail','autoforce@autoforce.com')),
    jsonb_build_object('id','ew1','type','wait','label','Aguardar 7 dias','x',880,'y',80,'config',jsonb_build_object('amount','7','unit','days')),
    jsonb_build_object('id','e2','type','send_email','label','E-mail 2 — D7','x',1160,'y',80,'config',jsonb_build_object('templateId','','templateName','','communicationType','MARKETING','fromEmail','autoforce@autoforce.com')),
    jsonb_build_object('id','ew2','type','wait','label','Aguardar 8 dias','x',1440,'y',80,'config',jsonb_build_object('amount','8','unit','days')),
    jsonb_build_object('id','e3','type','send_email','label','E-mail 3 — D15','x',1720,'y',80,'config',jsonb_build_object('templateId','','templateName','','communicationType','MARKETING','fromEmail','autoforce@autoforce.com')),
    jsonb_build_object('id','ew3','type','wait','label','Aguardar 9 dias','x',2000,'y',80,'config',jsonb_build_object('amount','9','unit','days')),
    jsonb_build_object('id','e4','type','send_email','label','E-mail 4 — D24','x',2280,'y',80,'config',jsonb_build_object('templateId','','templateName','','communicationType','MARKETING','fromEmail','autoforce@autoforce.com')),
    jsonb_build_object('id','ew4','type','wait','label','Aguardar 11 dias','x',2560,'y',80,'config',jsonb_build_object('amount','11','unit','days')),
    jsonb_build_object('id','e5','type','send_email','label','E-mail 5 — D35','x',2840,'y',80,'config',jsonb_build_object('templateId','','templateName','','communicationType','MARKETING','fromEmail','autoforce@autoforce.com')),
    jsonb_build_object('id','ww0','type','wait','label','Aguardar 1 hora','x',600,'y',400,'config',jsonb_build_object('amount','1','unit','hours')),
    jsonb_build_object('id','w1','type','whatsapp_message','label','WhatsApp 1 — D0','x',880,'y',400,'config',jsonb_build_object('templateName','','phoneField','phone')),
    jsonb_build_object('id','ww1','type','wait','label','Aguardar até D10','x',1160,'y',400,'config',jsonb_build_object('amount','239','unit','hours')),
    jsonb_build_object('id','w2','type','whatsapp_message','label','WhatsApp 2 — D10','x',1440,'y',400,'config',jsonb_build_object('templateName','','phoneField','phone')),
    jsonb_build_object('id','ww2','type','wait','label','Aguardar 11 dias','x',1720,'y',400,'config',jsonb_build_object('amount','264','unit','hours')),
    jsonb_build_object('id','w3','type','whatsapp_message','label','WhatsApp 3 — D21','x',2000,'y',400,'config',jsonb_build_object('templateName','','phoneField','phone')),
    jsonb_build_object('id','ww3','type','wait','label','Aguardar 7 dias','x',2280,'y',400,'config',jsonb_build_object('amount','168','unit','hours')),
    jsonb_build_object('id','w4','type','whatsapp_message','label','WhatsApp 4 — D28','x',2560,'y',400,'config',jsonb_build_object('templateName','','phoneField','phone')),
    jsonb_build_object('id','ww4','type','wait','label','Aguardar 14 dias','x',2840,'y',400,'config',jsonb_build_object('amount','336','unit','hours')),
    jsonb_build_object('id','w5','type','whatsapp_message','label','WhatsApp 5 — D42','x',3120,'y',400,'config',jsonb_build_object('templateName','','phoneField','phone'))
  ),
  jsonb_build_array(
    jsonb_build_object('id','a1','source','trigger','target','exclude'),
    jsonb_build_object('id','a2','source','exclude','target','e1','sourceHandle','true'),
    jsonb_build_object('id','a3','source','exclude','target','ww0','sourceHandle','true'),
    jsonb_build_object('id','a4','source','e1','target','ew1'),jsonb_build_object('id','a5','source','ew1','target','e2'),
    jsonb_build_object('id','a6','source','e2','target','ew2'),jsonb_build_object('id','a7','source','ew2','target','e3'),
    jsonb_build_object('id','a8','source','e3','target','ew3'),jsonb_build_object('id','a9','source','ew3','target','e4'),
    jsonb_build_object('id','a10','source','e4','target','ew4'),jsonb_build_object('id','a11','source','ew4','target','e5'),
    jsonb_build_object('id','a12','source','ww0','target','w1'),jsonb_build_object('id','a13','source','w1','target','ww1'),
    jsonb_build_object('id','a14','source','ww1','target','w2'),jsonb_build_object('id','a15','source','w2','target','ww2'),
    jsonb_build_object('id','a16','source','ww2','target','w3'),jsonb_build_object('id','a17','source','w3','target','ww3'),
    jsonb_build_object('id','a18','source','ww3','target','w4'),jsonb_build_object('id','a19','source','w4','target','ww4'),
    jsonb_build_object('id','a20','source','ww4','target','w5')
  ),
  'segment_entered', false, NULL, 'NURTURE', 'AUDIENCE', 70, true, NULL,
  (SELECT "id" FROM "AutomationNurtureGroup" WHERE "name" = 'Nitro Ads — Clientes' LIMIT 1), CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "AutomationJourney" WHERE "id" = 'journey_nitroads_clientes');
