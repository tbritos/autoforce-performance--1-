INSERT INTO "EmailTemplate" (
  "id", "name", "subject", "body", "fromName", "fromEmail", "status", "audienceType", "audienceValue", "isActive", "updatedAt"
)
VALUES (
  'cm_raio_x_marcas_chinesas_entrega',
  'Ebook Raio-X Marcas Chinesas — Entrega',
  'Seu ebook Raio-X das Marcas Chinesas está aqui',
  '<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#18243d"><div style="max-width:620px;margin:0 auto;padding:28px 16px"><div style="background:#101a33;border-radius:18px 18px 0 0;padding:26px 30px;text-align:center"><img src="https://autoforce-performance-1-moe8.vercel.app/autoforce-logo-white.svg" alt="AutoForce" width="150" style="display:inline-block"></div><div style="background:#fff;padding:34px 30px;border-radius:0 0 18px 18px"><p style="font-size:15px;margin:0 0 18px">Olá, {{nome}}!</p><h1 style="font-size:28px;line-height:1.15;margin:0 0 18px;color:#162a57">Seu Raio-X das Marcas Chinesas chegou</h1><p style="font-size:16px;line-height:1.6;margin:0 0 18px">O mercado automotivo está mudando rapidamente. Neste ebook, você encontra os principais dados, movimentos e oportunidades para entender o avanço das montadoras chinesas no Brasil.</p><p style="font-size:16px;line-height:1.6;margin:0 0 26px">Acesse o material completo gratuitamente:</p><div style="text-align:center;margin:28px 0 30px"><a href="https://autoforce-performance-1-moe8.vercel.app/ebook-raio-x-marcas-chinesas.pdf?utm_source=email&amp;utm_medium=nutricao&amp;utm_campaign=ebook_raio_x_marcas_chinesas&amp;utm_content=email_1_entrega" style="display:inline-block;background:#4057df;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:15px 28px;border-radius:9px">Baixar meu ebook</a></div><p style="font-size:14px;line-height:1.6;color:#5f6b82;margin:0">Boa leitura!<br><strong>Time AutoForce</strong></p></div><p style="font-size:11px;line-height:1.5;text-align:center;color:#7b8497;margin:18px 10px">Você recebeu este e-mail porque se inscreveu para receber o material da AutoForce.<br><a href="{{unsubscribe_url}}" style="color:#5f6b82">Não quero mais receber estes e-mails</a></p></div></body></html>',
  'AutoForce',
  'autoforce@autoforce.com',
  'draft',
  'trigger',
  'Ebook Raio-X Marcas Chinesas',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "subject" = EXCLUDED."subject",
  "body" = EXCLUDED."body",
  "fromName" = EXCLUDED."fromName",
  "fromEmail" = EXCLUDED."fromEmail",
  "audienceType" = EXCLUDED."audienceType",
  "audienceValue" = EXCLUDED."audienceValue",
  "updatedAt" = CURRENT_TIMESTAMP;
