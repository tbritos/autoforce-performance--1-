-- Templates de e-mail (D4, D11, D20 e D24) e conexão da cadência de 28 dias.
DO $$
DECLARE
  p RECORD;
  i INTEGER;
  tid TEXT;
  subjects TEXT[];
  bodies TEXT[];
BEGIN
  FOR p IN SELECT * FROM (VALUES
    ('a','Marketing','O que as marcas chinesas estão mudando no digital','O avanço das marcas chinesas já mudou a expectativa do consumidor. Veja os dados e o que isso exige do marketing.','Como preparar marketing, site e CRM para competir com uma experiência digital mais rápida e integrada.'),
    ('b','Comercial','R$ 15,5 bi em fábricas: a decisão comercial mudou','Os números de 2026 mostram que a disputa por participação já está acontecendo.','Use dados de mercado para avaliar onde sua operação comercial precisa se preparar.'),
    ('c','Montadoras','Venda direta e governança: o risco para sua rede','A venda direta já representa 50,15% dos emplacamentos no acumulado de 2026.','Entenda como as montadoras podem proteger a experiência da rede de dealers com governança digital.')
  ) AS x(persona, label, s2, b2, b3)
  LOOP
    subjects := ARRAY[p.s2, 'O que os dados mostram sobre sua operação', 'Como reduzir o risco de ficar para trás', 'A janela para se preparar está aberta'];
    bodies := ARRAY[p.b2, p.b3, 'O mercado está avançando e a operação digital precisa acompanhar. O e-book reúne os dados, os cenários e os caminhos práticos para transformar informação em decisão.', 'Você já tem o diagnóstico em mãos. O próximo passo é conversar sobre como aplicar esses aprendizados ao seu cenário.'];
    FOR i IN 2..5 LOOP
      tid := 'raio_x_marcas_chinesas_' || p.persona || '_e' || i;
      INSERT INTO "EmailTemplate" ("id","name","subject","body","fromName","fromEmail","status","audienceType","audienceValue","isActive","updatedAt")
      VALUES (tid, 'Raio-X Marcas Chinesas — Persona ' || upper(p.persona) || ' — E-mail ' || i,
        subjects[i-1], '<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#18243d"><div style="max-width:620px;margin:0 auto;padding:28px 16px"><div style="background:#101a33;padding:24px;text-align:center"><img src="https://autoforce-performance-1-moe8.vercel.app/autoforce-logo-white.svg" width="150" alt="AutoForce"></div><div style="background:#fff;padding:32px"><p>Olá, {{nome}}!</p><p style="font-size:16px;line-height:1.6">' || bodies[i-1] || '</p><p style="font-size:16px;line-height:1.6">Continue a leitura no material e veja os capítulos mais relevantes para profissionais de ' || p.label || '.</p><div style="text-align:center;margin:28px 0"><a href="https://autoforce-performance-1-moe8.vercel.app/ebook-raio-x-marcas-chinesas.pdf?utm_source=email&utm_medium=nutricao&utm_campaign=ebook_raio_x_marcas_chinesas&utm_content=persona_' || p.persona || '_email_' || i || '" style="background:#4057df;color:#fff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:8px">Acessar o e-book</a></div><p>Time AutoForce</p></div><p style="font-size:11px;text-align:center;color:#7b8497"><a href="{{unsubscribe_url}}">Não quero mais receber estes e-mails</a></p></div></body></html>',
        'AutoForce', 'autoforce@autoforce.com', 'draft', 'manual', 'Raio-X Marcas Chinesas', false, CURRENT_TIMESTAMP)
      ON CONFLICT ("id") DO NOTHING;
    END LOOP;
  END LOOP;

  UPDATE "AutomationJourney" j
  SET "nodes" = j."nodes" || jsonb_build_array(
    jsonb_build_object('id','w4','type','wait','label','Aguardar 4 dias — D4','x',1000,'y',0,'config',jsonb_build_object('amount','4','unit','days')),
    jsonb_build_object('id','e2','type','send_email','label','E-mail 2 — D4','x',1280,'y',0,'config',jsonb_build_object('templateId','raio_x_marcas_chinesas_' || CASE WHEN j."id" LIKE '%_a' THEN 'a' WHEN j."id" LIKE '%_b' THEN 'b' ELSE 'c' END || '_e2','templateName','raio_x_marcas_chinesas_e2','communicationType','MARKETING','fromEmail','autoforce@autoforce.com')),
    jsonb_build_object('id','w11','type','wait','label','Aguardar 7 dias — D11','x',1560,'y',0,'config',jsonb_build_object('amount','7','unit','days')),
    jsonb_build_object('id','e3','type','send_email','label','E-mail 3 — D11','x',1840,'y',0,'config',jsonb_build_object('templateId','raio_x_marcas_chinesas_' || CASE WHEN j."id" LIKE '%_a' THEN 'a' WHEN j."id" LIKE '%_b' THEN 'b' ELSE 'c' END || '_e3','templateName','raio_x_marcas_chinesas_e3','communicationType','MARKETING','fromEmail','autoforce@autoforce.com')),
    jsonb_build_object('id','w20','type','wait','label','Aguardar 9 dias — D20','x',2120,'y',0,'config',jsonb_build_object('amount','9','unit','days')),
    jsonb_build_object('id','e4','type','send_email','label','E-mail 4 — D20','x',2400,'y',0,'config',jsonb_build_object('templateId','raio_x_marcas_chinesas_' || CASE WHEN j."id" LIKE '%_a' THEN 'a' WHEN j."id" LIKE '%_b' THEN 'b' ELSE 'c' END || '_e4','templateName','raio_x_marcas_chinesas_e4','communicationType','MARKETING','fromEmail','autoforce@autoforce.com')),
    jsonb_build_object('id','w24','type','wait','label','Aguardar 4 dias — D24','x',2680,'y',0,'config',jsonb_build_object('amount','4','unit','days')),
    jsonb_build_object('id','e5','type','send_email','label','E-mail 5 — D24','x',2960,'y',0,'config',jsonb_build_object('templateId','raio_x_marcas_chinesas_' || CASE WHEN j."id" LIKE '%_a' THEN 'a' WHEN j."id" LIKE '%_b' THEN 'b' ELSE 'c' END || '_e5','templateName','raio_x_marcas_chinesas_e5','communicationType','MARKETING','fromEmail','autoforce@autoforce.com'))
  ),
  "edges" = j."edges" || jsonb_build_array(
    jsonb_build_object('id','a3','source','entrega','target','w4'), jsonb_build_object('id','a4','source','w4','target','e2'),
    jsonb_build_object('id','a5','source','e2','target','w11'), jsonb_build_object('id','a6','source','w11','target','e3'),
    jsonb_build_object('id','a7','source','e3','target','w20'), jsonb_build_object('id','a8','source','w20','target','e4'),
    jsonb_build_object('id','a9','source','e4','target','w24'), jsonb_build_object('id','a10','source','w24','target','e5')
  )
  WHERE j."id" IN ('journey_raio_x_marcas_chinesas_email_a','journey_raio_x_marcas_chinesas_email_b','journey_raio_x_marcas_chinesas_email_c');
END $$;
