-- Expande o copy dos 12 e-mails da cadência, mantendo templates em rascunho.
DO $$
DECLARE p RECORD; i INTEGER; tid TEXT; copy TEXT[];
BEGIN
  FOR p IN SELECT * FROM (VALUES
    ('a', ARRAY[
      'As marcas chinesas já mudaram a expectativa do consumidor. O mercado inteiro cresceu 19,03%, mas elas avançaram 146,67% no mesmo período. O Capítulo 2 mostra por que site bonito, sozinho, não sustenta essa disputa.',
      'Tecnologia embarcada, IA por voz e recursos ADAS chegam a preços 20% a 40% menores. Para o marketing, isso significa uma experiência digital que precisa conectar campanha, site e comercial desde o primeiro clique.',
      'Você pode levar estes números para a próxima conversa com a diretoria: 951.319 conversões e mais de 2.200 concessionárias já operam com a estrutura AutoForce. É dado pronto para defender investimento, não opinião.',
      'Não tenho orçamento nem time agora? A Plataforma Autódromo tem três portas de entrada — Starter, Racer e Champion — para começar no tamanho certo, sem reconstruir a operação inteira.'
    ]),
    ('b', ARRAY[
      'De janeiro a julho de 2026, as marcas chinesas emplacaram 284.878 veículos e chegaram a 23% do mercado em julho. BYD e GWM já confirmaram mais de R$ 15,5 bi em fábricas no Brasil. A pergunta deixou de ser se o movimento vem; é como sua operação vai responder.',
      'Enquanto as ocidentais anunciam mais de R$ 50 bi até 2030, a disputa acontece em velocidade de gigante. O Capítulo 13 traz quatro perguntas para decidir se uma nova marca cabe na sua estratégia comercial sem apostar no achismo.',
      'O Grupo Vitória saiu de 1,3% para 4,7% de conversão e reduziu o custo por venda de R$ 2.000 para R$ 538. O processo conecta marketing, CRM e atendimento — e transforma volume de lead em oportunidade real.',
      'Testar com pouco investimento parece prudente, mas repetir um processo sem medir a conversão custa mais. Um diagnóstico comercial de 20 minutos mostra onde sua operação perde performance e qual próximo passo faz sentido.'
    ]),
    ('c', ARRAY[
      'A venda direta já respondeu por 50,15% dos emplacamentos no acumulado de janeiro a julho. Para uma montadora, isso aumenta o risco de cada dealer criar uma experiência própria, com SLA e dados que não conversam entre lojas.',
      'O modelo digital das chinesas combina compra direta, tecnologia embarcada e velocidade. O Capítulo 17 mostra como transformar essa pressão em governança: showroom padronizado, CRM com IA, SLA único e visão da rede em tempo real.',
      'Stellantis, Mercedes-Benz, Geely, GWM, Hyundai, Mitsubishi e Renault já adotam o Programa de Homologação Digital. São sete marcas e um roadmap de cinco etapas, do workshop estratégico à operação plena da rede.',
      'Um programa para a rede inteira não precisa começar com ruptura. A homologação começa pelo alinhamento entre a operação local e a matriz; depois, o DRM acompanha cada loja e região sem aumentar o ruído operacional.'
    ])
  ) AS x(persona, copy) LOOP
    FOR i IN 2..5 LOOP
      tid := 'raio_x_marcas_chinesas_' || p.persona || '_e' || i;
      UPDATE "EmailTemplate"
      SET "body" = '<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#18243d"><div style="max-width:620px;margin:0 auto;padding:28px 16px"><div style="background:#101a33;padding:24px;text-align:center"><img src="https://autoforce-performance-1-moe8.vercel.app/autoforce-logo-white.svg" width="150" alt="AutoForce"></div><div style="background:#fff;padding:32px"><p style="font-size:15px">Olá, {{nome}}!</p><p style="font-size:16px;line-height:1.65">' || p.copy[i-1] || '</p><p style="font-size:16px;line-height:1.65">O e-book completo reúne os dados e os capítulos para aprofundar esta análise. Vale revisitar o material com este ponto em mente e compartilhar com quem participa dessa decisão.</p><div style="text-align:center;margin:28px 0"><a href="https://autoforce-performance-1-moe8.vercel.app/ebook-raio-x-marcas-chinesas.pdf?utm_source=email&amp;utm_medium=nutricao&amp;utm_campaign=ebook_raio_x_marcas_chinesas&amp;utm_content=persona_' || p.persona || '_email_' || i || '" style="background:#4057df;color:#fff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:8px">Continuar a leitura</a></div><p style="font-size:14px;line-height:1.5">Se quiser conversar sobre o seu cenário, basta responder este e-mail.<br><strong>Time AutoForce</strong></p></div><p style="font-size:11px;text-align:center;color:#7b8497"><a href="{{unsubscribe_url}}">Não quero mais receber estes e-mails</a></p></div></body></html>',
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = tid;
    END LOOP;
  END LOOP;
END $$;

UPDATE "EmailTemplate" SET "subject" = CASE "id"
  WHEN 'raio_x_marcas_chinesas_a_e2' THEN 'O que as marcas chinesas estão mudando no digital'
  WHEN 'raio_x_marcas_chinesas_a_e3' THEN 'O que os dados mostram sobre sua operação'
  WHEN 'raio_x_marcas_chinesas_a_e4' THEN 'Como reduzir o risco de ficar para trás'
  WHEN 'raio_x_marcas_chinesas_a_e5' THEN 'A janela para se preparar está aberta'
  WHEN 'raio_x_marcas_chinesas_b_e2' THEN 'R$ 15,5 bi em fábricas: a decisão comercial mudou'
  WHEN 'raio_x_marcas_chinesas_b_e3' THEN 'O que os dados mostram sobre sua operação comercial'
  WHEN 'raio_x_marcas_chinesas_b_e4' THEN 'Testar com pouco investimento resolve?'
  WHEN 'raio_x_marcas_chinesas_b_e5' THEN 'Enquanto você decide, a rede já está se formando'
  WHEN 'raio_x_marcas_chinesas_c_e2' THEN 'Venda direta e governança: o risco para sua rede'
  WHEN 'raio_x_marcas_chinesas_c_e3' THEN 'Sete marcas já padronizaram seus dealers'
  WHEN 'raio_x_marcas_chinesas_c_e4' THEN 'Minha estrutura ainda não está pronta'
  WHEN 'raio_x_marcas_chinesas_c_e5' THEN 'Enquanto sua rede espera, a concorrência já está padronizada'
  ELSE "subject"
END, "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" LIKE 'raio_x_marcas_chinesas_%_e%';
