-- Seed the reviewed Inside Sales 2026 nurture cadence as editable drafts.
-- The name guard makes this data migration safe when a template was created manually first.

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_a_e1_d0',
  $name_0$Inside Sales 2026 — Funil A — E-mail 1 — D0$name_0$,
  $subject_0$Seu guia chegou e um argumento que vai mudar a sua próxima reunião$subject_0$,
  $body_0$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: Seu guia chegou e um argumento que vai mudar a sua próxima reunião
  PREVIEW/ALT: Ebook liberado + o dado que explica por que o comercial reclama dos seus leads
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Ana Maria (Marketing) — Email 1 (D0, imediato)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">Ebook liberado + o dado que explica por que o comercial reclama dos seus leads</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 0 34px 0;">
      <tr><td align="center" style="background-color:#1A56FF;border-radius:8px;">
        <a href="https://autoforce-performance-1.vercel.app/materiais/guia-inside-sales-autoforce.pdf?utm_source=email&utm_medium=nutricao&utm_campaign=cadencia_inside_sales_2026&utm_content=funil_a_email_1_d0&utm_term=download_ebook" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Baixar o guia →</a>
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">Seu <strong>Guia Definitivo de Inside Sales para Concessionária de Alta Performance</strong> está aqui. Antes de mergulhar nos capítulos, deixa eu te dar um dado que vai soar familiar:</p>
    <p style="margin:0 0 20px 0;">Você gera leads. O time comercial diz que são ruins. E você fica sem argumento.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
      <tr><td style="background-color:#F0F4FF;border-left:4px solid #1A56FF;border-radius:0 8px 8px 0;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;line-height:1.5;color:#0D1B2A;">
        Em 30 minutos sem resposta, metade dos leads já está pesquisando em outra aba. Com resposta em até 5 minutos, a taxa de qualificação aumenta 21 vezes, sem mudar uma linha da campanha.
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">O problema não é o lead. É o processo de atendimento depois que ele sai das suas mãos.</p>
    <p style="margin:0 0 20px 0;">O <strong>Capítulo 1</strong> do guia começa exatamente aí. Vale ler com atenção.</p>
    <p style="margin:0 0 20px 0;">Nos próximos dias envio os pontos mais relevantes de cada capítulo, com exemplos práticos.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_0$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_0$Funil A — Inside Sales 2026$audience_0$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_0$Inside Sales 2026 — Funil A — E-mail 1 — D0$name_0$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_a_e2_d2',
  $name_1$Inside Sales 2026 — Funil A — E-mail 2 — D2$name_1$,
  $subject_1$O Grupo Vitória gastava R$ 28 mil em mídia e convertia 1,3%. O marketing não era o problema.$subject_1$,
  $body_1$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: O Grupo Vitória gastava R$ 28 mil em mídia e convertia 1,3%. O marketing não era o problema.
  PREVIEW/ALT: O case completo e o argumento pronto para a próxima conversa com a diretoria
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Ana Maria (Marketing) — Email 2 (D2, 26h após E1)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">O case completo e o argumento pronto para a próxima conversa com a diretoria</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <p style="margin:0 0 20px 0;">No Capítulo 13 do guia tem um case que incomoda quem ouve pela primeira vez.</p>
    <p style="margin:0 0 20px 0;">O Grupo Vitória Automotores tinha tudo que parecia certo: R$ 28 mil de verba em mídia, 1.100 leads por mês, equipe experiente. E convertia 1,3% de lead para venda.</p>
    <p style="margin:0 0 12px 0;font-weight:600;color:#0D1B2A;">O diagnóstico revelou o seguinte:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA;border-radius:8px;margin:0 0 22px 0;">
      <tr><td style="padding:16px 20px 4px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Response time médio de 52 minutos</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">11 abordagens diferentes entre 9 consultores (nenhuma era a sua campanha com problema)</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">CRM sem pipeline, só repositório de contatos</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Zero processo de reativação de leads frios</td></tr>
        </table>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
      <tr><td style="background-color:#F0F4FF;border-left:4px solid #1A56FF;border-radius:0 8px 8px 0;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;line-height:1.5;color:#0D1B2A;">
        Em 4 meses, sem mudar um centavo de mídia, a conversão foi de 1,3% para 4,7%. De 14 para 52 vendas digitais por mês. O custo por venda caiu de R$ 2.000 para R$ 538.
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">Esse dado, R$ 2.000 para R$ 538, é o argumento que muda a conversa com o diretor. Não é "o marketing precisa de mais orçamento". É "o que acontece com o lead depois que ele sai do marketing está custando X por mês".</p>
    <p style="margin:0 0 20px 0;">O Capítulo 8 do guia tem a tabela de KPIs que transforma essa análise em número real para a sua operação.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_1$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_1$Funil A — Inside Sales 2026$audience_1$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_1$Inside Sales 2026 — Funil A — E-mail 2 — D2$name_1$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_a_e3_d4',
  $name_2$Inside Sales 2026 — Funil A — E-mail 3 — D4$name_2$,
  $subject_2$O checklist de 12 KPIs que coloca o marketing no centro do resultado, não só da geração$subject_2$,
  $body_2$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: O checklist de 12 KPIs que coloca o marketing no centro do resultado, não só da geração
  PREVIEW/ALT: 5 perguntas rápidas para saber se você enxerga metade do funil ou o funil inteiro
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Ana Maria (Marketing) — Email 3 (D4, 48h após E2)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">5 perguntas rápidas para saber se você enxerga metade do funil ou o funil inteiro</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <p style="margin:0 0 20px 0;">No Capítulo 8 do guia tem uma tabela que todo gestor de marketing deveria revisar toda semana:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA;border-radius:8px;margin:0 0 22px 0;">
      <tr><td style="padding:16px 20px 4px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Você monitora o Response Time médio dos leads que gerou?</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Você tem visibilidade da taxa de qualificação por canal de mídia?</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Você sabe a taxa de conversão de lead para test drive por campanha?</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Você rastreia o motivo de perda dos leads que não viraram venda?</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Você tem fluxo automatizado de reativação para leads frios dos últimos 90 dias?</td></tr>
        </table>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
      <tr><td style="background-color:#F0F4FF;border-left:4px solid #1A56FF;border-radius:0 8px 8px 0;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;line-height:1.5;color:#0D1B2A;">
        Se você respondeu não para a maioria, isso não é sinal de fracasso, é sinal de que você está gerenciando metade do funil.
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">A outra metade está acontecendo sem você ver. E sem ver, é impossível otimizar.</p>
    <p style="margin:0 0 20px 0;">A AutoForce conecta esses dois lados, geração e atendimento, em um único dashboard. Posso te mostrar em 20 minutos como isso ficaria na {{company}}.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 0 34px 0;">
      <tr><td align="center" style="background-color:#1A56FF;border-radius:8px;">
        <a href="https://lp.autodromo.com.br/formulario-nutricao-topo?utm_source=email&utm_medium=nutricao&utm_campaign=cadencia_inside_sales_2026&utm_content=funil_a_email_3_d4&utm_term=falar_com_especialista" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Falar com especialista →</a>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_2$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_2$Funil A — Inside Sales 2026$audience_2$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_2$Inside Sales 2026 — Funil A — E-mail 3 — D4$name_2$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_a_e4_d7',
  $name_3$Inside Sales 2026 — Funil A — E-mail 4 — D7$name_3$,
  $subject_3$Isso acontece na sua operação? (é sobre o que trava o funil hoje)$subject_3$,
  $body_3$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: Isso acontece na sua operação? (é sobre o que trava o funil hoje)
  PREVIEW/ALT: 4 sinais de que o problema não é o volume de leads, é o que vem depois
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Ana Maria (Marketing) — Email 4 (D7, 72h após E3)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">4 sinais de que o problema não é o volume de leads, é o que vem depois</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <p style="margin:0 0 20px 0;">Você baixou o guia há alguns dias. Antes de continuar, quero te propor uma reflexão rápida, leva menos de um minuto. Veja se alguma dessas situações te parece familiar:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA;border-radius:8px;margin:0 0 22px 0;">
      <tr><td style="padding:16px 20px 4px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Você gera leads, mas o time comercial diz que são ruins e você não tem dados pra provar o contrário.</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Suas campanhas têm boas métricas de mídia, mas a conversão de lead para venda continua baixa.</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Os leads chegam, mas esfriam antes do comercial abordar e você não controla esse tempo de resposta.</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Você quer visibilidade do funil do clique à venda, mas não sabe por onde estruturar isso.</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">Se você se identificou com uma ou mais dessas situações, o problema provavelmente não está no marketing que você faz, está no que acontece com o lead depois que ele sai da sua mão.</p>
    <p style="margin:0 0 20px 0;">Posso te mostrar exatamente onde está esse gargalo, com os dados da sua operação, em 20 minutos.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 0 34px 0;">
      <tr><td align="center" style="background-color:#1A56FF;border-radius:8px;">
        <a href="https://lp.autodromo.com.br/formulario-nutricao-topo?utm_source=email&utm_medium=nutricao&utm_campaign=cadencia_inside_sales_2026&utm_content=funil_a_email_4_d7&utm_term=falar_com_especialista" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Falar com especialista →</a>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_3$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_3$Funil A — Inside Sales 2026$audience_3$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_3$Inside Sales 2026 — Funil A — E-mail 4 — D7$name_3$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_a_e5_d10',
  $name_4$Inside Sales 2026 — Funil A — E-mail 5 — D10$name_4$,
  $subject_4$O dado que muda a conversa com a diretoria$subject_4$,
  $body_4$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: O dado que muda a conversa com a diretoria
  PREVIEW/ALT: Antes de eu parar por aqui, um resumo rápido pra você aplicar hoje
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Ana Maria (Marketing) — Email 5 (D10, 72h após E4, condicional)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">Antes de eu parar por aqui, um resumo rápido pra você aplicar hoje</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <p style="margin:0 0 20px 0;">Este é meu último email desta sequência.</p>
    <p style="margin:0 0 20px 0;">Se você não teve tempo de ler o guia completo, vai direto ao Capítulo 8, é a tabela de KPIs que separa quem gerencia o funil de quem só olha pra ele. Em 15 minutos você já sabe onde estão os gargalos, com número pra apresentar.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
      <tr><td style="background-color:#F0F4FF;border-left:4px solid #1A56FF;border-radius:0 8px 8px 0;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;line-height:1.5;color:#0D1B2A;">
        O dado que mais muda a conversa com o diretor: custo por venda digital atual vs. custo por venda com processo estruturado. O Grupo Vitória saiu de R$ 2.000 para R$ 538. Sem cortar mídia.
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">Foi o AutoPilot que deu a eles a visibilidade pra chegar nesse número, conectando geração, atendimento e resultado em um só lugar.</p>
    <p style="margin:0 0 20px 0;">Se você quer conhecer melhor como o AutoPilot funciona na prática, fale com um de nossos especialistas:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 0 34px 0;">
      <tr><td align="center" style="background-color:#1A56FF;border-radius:8px;">
        <a href="https://lp.autodromo.com.br/formulario-nutricao-topo?utm_source=email&utm_medium=nutricao&utm_campaign=cadencia_inside_sales_2026&utm_content=funil_a_email_5_d10&utm_term=falar_com_especialista" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Falar com especialista →</a>
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">Foi um prazer compartilhar esse conteúdo com você.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA;border-radius:8px;margin-bottom:6px;">
      <tr><td style="padding:16px 18px;">
        <span style="display:block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;color:#1A56FF;text-transform:uppercase;margin-bottom:6px;">PS</span>
        <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.6;color:#5B6270;">O Capítulo 8 do guia que você já tem em mãos (<a href="https://autoforce-performance-1.vercel.app/materiais/guia-inside-sales-autoforce.pdf?utm_source=email&utm_medium=nutricao&utm_campaign=cadencia_inside_sales_2026&utm_content=funil_a_email_5_d10&utm_term=download_ebook" target="_blank" rel="noopener noreferrer" style="color:#1A56FF;text-decoration:underline;">acesse o ebook</a>) traz essa tabela completa, com benchmark de mercado para cada indicador.</span>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_4$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_4$Funil A — Inside Sales 2026$audience_4$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_4$Inside Sales 2026 — Funil A — E-mail 5 — D10$name_4$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_b_e1_d0',
  $name_5$Inside Sales 2026 — Funil B — E-mail 1 — D0$name_5$,
  $subject_5$Seu guia chegou e o número que muda o jogo do comercial$subject_5$,
  $body_5$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: Seu guia chegou e o número que muda o jogo do comercial
  PREVIEW/ALT: 46% dos leads chegam fora do horário comercial. Veja o que isso custa em vendas
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Marcelo Barboni (Comercial) — Email 1 (D0, imediato)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">46% dos leads chegam fora do horário comercial. Veja o que isso custa em vendas</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 0 34px 0;">
      <tr><td align="center" style="background-color:#1A56FF;border-radius:8px;">
        <a href="https://autoforce-performance-1.vercel.app/materiais/guia-inside-sales-autoforce.pdf?utm_source=email&utm_medium=nutricao&utm_campaign=cadencia_inside_sales_2026&utm_content=funil_b_email_1_d0&utm_term=download_ebook" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Baixar o guia →</a>
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">Seu <strong>Guia Definitivo de Inside Sales para Concessionária de Alta Performance</strong> está aqui. Antes de abrir, deixo o número que mais importa para um diretor comercial:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
      <tr><td style="background-color:#F0F4FF;border-left:4px solid #1A56FF;border-radius:0 8px 8px 0;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;line-height:1.5;color:#0D1B2A;">
        46% dos leads automotivos chegam fora do horário comercial.
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">Na maioria das operações, esses leads esperam o dia seguinte para receber resposta. Quando o consultor liga às 9h, o cliente já está em outra aba ou já comprou no concorrente que respondeu às 23h.</p>
    <p style="margin:0 0 20px 0;">Isso não é problema de mídia. Não é problema de produto. É problema de processo.</p>
    <p style="margin:0 0 20px 0;">O Capítulo 4 do guia calcula o custo exato disso em vendas, com a matemática feita sobre o volume da sua operação. Comece por ele.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_5$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_5$Funil B — Inside Sales 2026$audience_5$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_5$Inside Sales 2026 — Funil B — E-mail 1 — D0$name_5$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_b_e2_d2',
  $name_6$Inside Sales 2026 — Funil B — E-mail 2 — D2$name_6$,
  $subject_6$Quando a performance depende do vendedor e não do processo, você não tem comercial. Tem improviso.$subject_6$,
  $body_6$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: Quando a performance depende do vendedor e não do processo, você não tem comercial. Tem improviso.
  PREVIEW/ALT: O perfil que separa quem escala de quem depende do talento individual
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Marcelo Barboni (Comercial) — Email 2 (D2, 26h após E1)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">O perfil que separa quem escala de quem depende do talento individual</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <p style="margin:0 0 20px 0;">No Capítulo 10 do guia tem uma afirmação que incomoda muitos diretores comerciais:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
      <tr><td style="background-color:#F0F4FF;border-left:4px solid #1A56FF;border-radius:0 8px 8px 0;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;line-height:1.5;color:#0D1B2A;">
        O consultor de Inside Sales ideal não é o melhor vendedor de piso que migrou para o digital. É um perfil específico, com um processo específico, com tecnologia específica.
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">O melhor vendedor sai. O processo fica. Mas para isso, o funil de Inside Sales precisa fazer o trabalho pesado antes do consultor entrar: responder em até 5 minutos, qualificar com o BANT conversacional, registrar no CRM, confirmar test drive automaticamente e entregar para o consultor um lead contextualizado, com veículo de interesse, prazo de decisão e temperatura mapeada.</p>
    <p style="margin:0 0 20px 0;">Isso é o que separa uma operação que cresce com previsibilidade de uma que vive de meta no fim do mês.</p>
    <p style="margin:0 0 20px 0;">O Capítulo 3 do guia tem o funil de 7 etapas completo, com SLA para cada etapa e o que fazer quando um lead fica parado por mais de 48h.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_6$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_6$Funil B — Inside Sales 2026$audience_6$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_6$Inside Sales 2026 — Funil B — E-mail 2 — D2$name_6$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_b_e3_d4',
  $name_7$Inside Sales 2026 — Funil B — E-mail 3 — D4$name_7$,
  $subject_7$O Grupo Vitória: de 14 para 52 vendas digitais por mês. Em 4 meses.$subject_7$,
  $body_7$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: O Grupo Vitória: de 14 para 52 vendas digitais por mês. Em 4 meses.
  PREVIEW/ALT: O diagnóstico completo — e como ficaria aplicado na sua operação
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Marcelo Barboni (Comercial) — Email 3 (D4, 48h após E2)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">O diagnóstico completo — e como ficaria aplicado na sua operação</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <p style="margin:0 0 20px 0;">No guia tem um case que recomendo a leitura:</p>
    <p style="margin:0 0 20px 0;">O Grupo Vitória Automotores chegou até nós com 1.100 leads por mês e 1,3% de conversão. O time comercial dizia que os leads eram ruins. O marketing dizia que o time não atendia direito. Fizemos o diagnóstico. Em 2 horas, o problema estava claro:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA;border-radius:8px;margin:0 0 22px 0;">
      <tr><td style="padding:16px 20px 4px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Response time de 52 minutos</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Zero processo de reativação de leads frios (2.847 leads descartados nos últimos 4 meses)</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">CRM sem pipeline, ninguém sabia quantas oportunidades existiam em cada etapa</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 12px 0;font-weight:600;color:#0D1B2A;">Em 4 meses:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA;border-radius:8px;margin:0 0 22px 0;">
      <tr><td style="padding:16px 20px 4px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Taxa de conversão: de 1,3% para 4,7%</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Vendas digitais por mês: de 14 para 52</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Custo por venda: de R$ 2.000 para R$ 538</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Reativação da base fria: 43 vendas adicionais em 30 dias</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">Quer ver como esse processo ficaria na prática para a sua empresa?</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 0 34px 0;">
      <tr><td align="center" style="background-color:#1A56FF;border-radius:8px;">
        <a href="https://lp.autodromo.com.br/formulario-nutricao-topo?utm_source=email&utm_medium=nutricao&utm_campaign=cadencia_inside_sales_2026&utm_content=funil_b_email_3_d4&utm_term=falar_com_especialista" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Falar com especialista →</a>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_7$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_7$Funil B — Inside Sales 2026$audience_7$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_7$Inside Sales 2026 — Funil B — E-mail 3 — D4$name_7$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_b_e4_d7',
  $name_8$Inside Sales 2026 — Funil B — E-mail 4 — D7$name_8$,
  $subject_8$Isso acontece no seu comercial? (é sobre o que trava o resultado hoje)$subject_8$,
  $body_8$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: Isso acontece no seu comercial? (é sobre o que trava o resultado hoje)
  PREVIEW/ALT: 4 sinais de que falta processo, não é falta de esforço do time
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Marcelo Barboni (Comercial) — Email 4 (D7, 72h após E3)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">4 sinais de que falta processo, não é falta de esforço do time</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <p style="margin:0 0 20px 0;">Você baixou o guia há alguns dias. Antes de continuar, quero te propor uma reflexão rápida, leva menos de um minuto. Veja se alguma dessas situações te parece familiar:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA;border-radius:8px;margin:0 0 22px 0;">
      <tr><td style="padding:16px 20px 4px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Seu time atende os leads sem script, sem CRM, sem padronização, cada consultor faz do jeito que quer.</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Os leads chegam, mas a taxa de conversão está abaixo de 2% e você não sabe exatamente onde estão saindo.</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Fora do horário comercial, os leads entram e ficam sem resposta até o dia seguinte.</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Você tem resultado, mas não tem previsibilidade, não consegue projetar o fechamento do mês com confiança.</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">Se você se identifica com uma ou mais dessas situações, o problema não é o time, é a ausência de processo estruturado.</p>
    <p style="margin:0 0 20px 0;">Posso te mostrar exatamente onde está esse gargalo, com os dados da sua operação, em 20 minutos.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 0 34px 0;">
      <tr><td align="center" style="background-color:#1A56FF;border-radius:8px;">
        <a href="https://lp.autodromo.com.br/formulario-nutricao-topo?utm_source=email&utm_medium=nutricao&utm_campaign=cadencia_inside_sales_2026&utm_content=funil_b_email_4_d7&utm_term=falar_com_especialista" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Falar com especialista →</a>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_8$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_8$Funil B — Inside Sales 2026$audience_8$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_8$Inside Sales 2026 — Funil B — E-mail 4 — D7$name_8$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_b_e5_d10',
  $name_9$Inside Sales 2026 — Funil B — E-mail 5 — D10$name_9$,
  $subject_9$O número que todo diretor comercial deveria acompanhar diariamente$subject_9$,
  $body_9$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: O número que todo diretor comercial deveria acompanhar diariamente
  PREVIEW/ALT: Antes de eu parar por aqui, um resumo rápido pra sua próxima reunião
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Marcelo Barboni (Comercial) — Email 5 (D10, 72h após E4, condicional)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">Antes de eu parar por aqui, um resumo rápido pra sua próxima reunião</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <p style="margin:0 0 20px 0;">Este é meu último email desta sequência. Deixo uma reflexão final do guia:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
      <tr><td style="background-color:#F0F4FF;border-left:4px solid #1A56FF;border-radius:0 8px 8px 0;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;line-height:1.5;color:#0D1B2A;">
        KPI sem meta é decoração. Meta sem acompanhamento semanal é esperança. E esperança, no comercial, é a estratégia dos que perdem.
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">O número que separa uma operação gerenciada de uma que apenas existe: você consegue dizer agora qual é a taxa de conversão de lead para venda da sua operação? E quantas oportunidades quentes existem no seu funil agora mesmo?</p>
    <p style="margin:0 0 20px 0;">Foi o AutoPilot que deu ao Grupo Vitória essa visibilidade, e foi isso que levou a operação de 14 para 52 vendas digitais por mês, em 4 meses, sem aumentar a mídia.</p>
    <p style="margin:0 0 20px 0;">Se você quer conhecer melhor como o AutoPilot funciona na prática:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 0 34px 0;">
      <tr><td align="center" style="background-color:#1A56FF;border-radius:8px;">
        <a href="https://lp.autodromo.com.br/formulario-nutricao-topo?utm_source=email&utm_medium=nutricao&utm_campaign=cadencia_inside_sales_2026&utm_content=funil_b_email_5_d10&utm_term=falar_com_especialista" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Falar com especialista →</a>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_9$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_9$Funil B — Inside Sales 2026$audience_9$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_9$Inside Sales 2026 — Funil B — E-mail 5 — D10$name_9$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_c_e1_d0',
  $name_10$Inside Sales 2026 — Funil C — E-mail 1 — D0$name_10$,
  $subject_10$Seu guia chegou e começa com a pergunta que mais incomoda gestores de CRM$subject_10$,
  $body_10$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: Seu guia chegou e começa com a pergunta que mais incomoda gestores de CRM
  PREVIEW/ALT: Quantos leads viraram “sem retorno” no mês passado? O guia começa por aí
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Gustavo Souza (CRM) — Email 1 (D0, imediato)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">Quantos leads viraram “sem retorno” no mês passado? O guia começa por aí</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 0 34px 0;">
      <tr><td align="center" style="background-color:#1A56FF;border-radius:8px;">
        <a href="https://autoforce-performance-1.vercel.app/materiais/guia-inside-sales-autoforce.pdf?utm_source=email&utm_medium=nutricao&utm_campaign=cadencia_inside_sales_2026&utm_content=funil_c_email_1_d0&utm_term=download_ebook" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Baixar o guia →</a>
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">Seu <strong>Guia Definitivo de Inside Sales para Concessionária de Alta Performance</strong> está aqui. Antes de fechar este email, uma pergunta:</p>
    <p style="margin:0 0 20px 0;">Quantos leads do mês passado você ou o seu time marcou como "sem retorno" ou "cliente não quis"?</p>
    <p style="margin:0 0 20px 0;">Essa categoria existe no CRM de quase toda concessionária que a AutoForce atende. E o que descobrimos, operação após operação, é que boa parte desses leads não foi perdida para a concorrência, foi perdida para o silêncio:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
      <tr><td style="background-color:#F0F4FF;border-left:4px solid #1A56FF;border-radius:0 8px 8px 0;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;line-height:1.5;color:#0D1B2A;">
        Em 30 minutos sem resposta, metade dos leads já está pesquisando em outra aba.
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">Para a demora. Para a ausência de processo. O guia foi escrito para você que está cansado de ouvir que o lead é de baixa qualidade quando, na verdade, o problema está na velocidade e na cadência de atendimento.</p>
    <p style="margin:0 0 20px 0;">O <strong>Capítulo 2 — A Anatomia de um Lead Quente</strong> começa exatamente aí.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_10$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_10$Funil C — Inside Sales 2026$audience_10$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_10$Inside Sales 2026 — Funil C — E-mail 1 — D0$name_10$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_c_e2_d2',
  $name_11$Inside Sales 2026 — Funil C — E-mail 2 — D2$name_11$,
  $subject_11$O dado que muda como a diretoria enxerga o CRM e o seu papel nas reuniões$subject_11$,
  $body_11$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: O dado que muda como a diretoria enxerga o CRM e o seu papel nas reuniões
  PREVIEW/ALT: 21 vezes. Não 21%. O número que muda o tom da reunião de segunda
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Gustavo Souza (CRM) — Email 2 (D2, 26h após E1)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">21 vezes. Não 21%. O número que muda o tom da reunião de segunda</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <p style="margin:0 0 20px 0;">Tem um dado no guia que costumo mostrar em todo diagnóstico de operação:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
      <tr><td style="background-color:#F0F4FF;border-left:4px solid #1A56FF;border-radius:0 8px 8px 0;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;line-height:1.5;color:#0D1B2A;">
        Responder um lead em até 5 minutos aumenta em 21 vezes a chance de qualificação, comparado com responder após 30 minutos.
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">21 vezes. Não 21%. Vinte e uma vezes.</p>
    <p style="margin:0 0 20px 0;">Agora pensa na sua operação: qual é o Response Time médio hoje nos leads que chegam fora do horário comercial? A maioria dos gestores de CRM que conheço não tem esse número na ponta da língua, porque a ferramenta não mostra ou o processo não rastreia. E sem esse número, é impossível fazer a conversa certa com o diretor.</p>
    <p style="margin:0 0 20px 0;">O Capítulo 8 do guia tem os 12 KPIs que transformam o CRM de repositório de contatos em centro de resultado. É a tabela que muda o tom da reunião de segunda-feira.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_11$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_11$Funil C — Inside Sales 2026$audience_11$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_11$Inside Sales 2026 — Funil C — E-mail 2 — D2$name_11$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_c_e3_d4',
  $name_12$Inside Sales 2026 — Funil C — E-mail 3 — D4$name_12$,
  $subject_12$O maior ativo subutilizado da sua operação não está nas campanhas novas, está no seu CRM$subject_12$,
  $body_12$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: O maior ativo subutilizado da sua operação não está nas campanhas novas, está no seu CRM
  PREVIEW/ALT: Como o Grupo Vitória tirou 43 vendas de uma base que parecia perdida
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Gustavo Souza (CRM) — Email 3 (D4, 48h após E2)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">Como o Grupo Vitória tirou 43 vendas de uma base que parecia perdida</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <p style="margin:0 0 20px 0;">No Capítulo 7 do guia tem um argumento que muda como gestores de CRM veem a sua própria base:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;">
      <tr><td style="background-color:#F0F4FF;border-left:4px solid #1A56FF;border-radius:0 8px 8px 0;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;line-height:1.5;color:#0D1B2A;">
        Em uma operação média, apenas 2% a 5% dos leads gerados convertem em venda no primeiro contato.
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">O que acontece com os outros 95%? A maioria é descartada. Mas uma parte relevante ainda está no mercado: operações que ativam o Fluxo de 3 Ondas completo registram retorno de 8% a 14% desses leads já na Onda 3. Eles só precisam da mensagem certa, no canal certo, no momento certo.</p>
    <p style="margin:0 0 20px 0;">No Grupo Vitória, ativamos o Fluxo de 3 Ondas de Reativação para uma base de 2.847 leads descartados. Em 30 dias:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA;border-radius:8px;margin:0 0 22px 0;">
      <tr><td style="padding:16px 20px 4px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">11% responderam na Onda 1</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">43 vendas adicionais fechadas</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Zero investimento adicional em mídia</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;"><em>A Patrícia Lima, gerente de CRM do grupo, disse o seguinte: "Quando os resultados do CRM passaram a aparecer no dashboard do diretor, a nossa área ganhou um status que nunca tivemos. Hoje somos parceiros estratégicos."</em></p>
    <p style="margin:0 0 20px 0;">Posso te mostrar como esse fluxo ficaria na sua empresa em 20 minutos.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 0 34px 0;">
      <tr><td align="center" style="background-color:#1A56FF;border-radius:8px;">
        <a href="https://lp.autodromo.com.br/formulario-nutricao-topo?utm_source=email&utm_medium=nutricao&utm_campaign=cadencia_inside_sales_2026&utm_content=funil_c_email_3_d4&utm_term=falar_com_especialista" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Falar com especialista →</a>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_12$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_12$Funil C — Inside Sales 2026$audience_12$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_12$Inside Sales 2026 — Funil C — E-mail 3 — D4$name_12$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_c_e4_d7',
  $name_13$Inside Sales 2026 — Funil C — E-mail 4 — D7$name_13$,
  $subject_13$Isso acontece na sua operação?$subject_13$,
  $body_13$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: Isso acontece na sua operação?
  PREVIEW/ALT: 4 sinais de que o problema está no processo, não no volume
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Gustavo Souza (CRM) — Email 4 (D7, 72h após E3)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">4 sinais de que o problema está no processo, não no volume</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <p style="margin:0 0 20px 0;">Você baixou o guia há alguns dias. Antes de continuar, quero te propor uma reflexão rápida, leva menos de um minuto. Veja se alguma dessas situações te parece familiar:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA;border-radius:8px;margin:0 0 22px 0;">
      <tr><td style="padding:16px 20px 4px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">O tempo de resposta está alto, os leads chegam, mas o time demora pra responder, principalmente fora do horário.</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">Não existe fluxo de reativação automatizado, os leads frios descartados simplesmente somem.</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">O CRM não tem visibilidade, o pipeline não está estruturado e a diretoria não enxerga o que a área entrega.</td></tr>
          <tr><td width="20" valign="top" style="padding:0 8px 12px 0;color:#1A56FF;font-size:15px;line-height:1.6;">●</td><td valign="top" style="padding:0 0 12px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#23262F;">O time está sobrecarregado, muitos leads chegando, pouco processo pra filtrar o que vale o esforço.</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">Se você se identificou com uma ou mais dessas situações, vale a pena entender exatamente onde está o gargalo, porque, na maioria das vezes, o problema não é o volume de leads.</p>
    <p style="margin:0 0 20px 0;">Posso te mostrar isso em 20 minutos, com os dados da sua operação.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 0 34px 0;">
      <tr><td align="center" style="background-color:#1A56FF;border-radius:8px;">
        <a href="https://lp.autodromo.com.br/formulario-nutricao-topo?utm_source=email&utm_medium=nutricao&utm_campaign=cadencia_inside_sales_2026&utm_content=funil_c_email_4_d7&utm_term=falar_com_especialista" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Falar com especialista →</a>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_13$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_13$Funil C — Inside Sales 2026$audience_13$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_13$Inside Sales 2026 — Funil C — E-mail 4 — D7$name_13$
);

INSERT INTO "EmailTemplate" (
  "id",
  "name",
  "subject",
  "body",
  "fromName",
  "fromEmail",
  "status",
  "audienceType",
  "audienceValue",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_inside_sales_2026_c_e5_d10',
  $name_14$Inside Sales 2026 — Funil C — E-mail 5 — D10$name_14$,
  $subject_14$Último email e a visão que você nunca teve da sua base$subject_14$,
  $body_14$<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<!--
  ASSUNTO: Último email e a visão que você nunca teve da sua base
  PREVIEW/ALT: Antes de eu parar por aqui, um resumo rápido sobre o que fica visível no CRM
  Remetente sugerido: Lara da AutoForce <lara@autoforce.com.br>
-->
<title>Gustavo Souza (CRM) — Email 5 (D10, 72h após E4, condicional)</title>
<style>
  body, table, td, div, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse !important; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #EEF0F3; }
</style>
</head>
<body style="margin:0;padding:0;background-color:#EEF0F3;">
<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;">Antes de eu parar por aqui, um resumo rápido sobre o que fica visível no CRM</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF0F3;">
<tr>
<td align="center" style="padding:36px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:10px;overflow:hidden;">

  <!-- FAIXA DE MARCA -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:18px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="left" valign="middle">
          <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="118" style="display:block;width:118px;max-width:118px;height:auto;border:0;">
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CORPO -->
  <tr><td style="padding:38px 40px 8px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.72;color:#23262F;">

    <p style="margin:0 0 20px 0;">Oi {{name}}!</p>

    <p style="margin:0 0 20px 0;">Este é meu último email desta sequência.</p>
    <p style="margin:0 0 20px 0;">Se você não teve tempo de ler o guia completo, vai direto ao Capítulo 8, é a tabela de KPIs que transforma o CRM de repositório de contatos em centro de resultado. É a tabela que muda o tom da reunião de segunda-feira.</p>
    <p style="margin:0 0 20px 0;">No Grupo Vitória, foi o AutoPilot que deu à área de CRM a visibilidade pra virar parceira estratégica da diretoria, e não só suporte operacional.</p>
    <p style="margin:0 0 20px 0;">Se você quer conhecer melhor como o AutoPilot funciona na prática, fale com um de nossos especialistas.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 0 34px 0;">
      <tr><td align="center" style="background-color:#1A56FF;border-radius:8px;">
        <a href="https://lp.autodromo.com.br/formulario-nutricao-topo?utm_source=email&utm_medium=nutricao&utm_campaign=cadencia_inside_sales_2026&utm_content=funil_c_email_5_d10&utm_term=falar_com_especialista" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">Falar com especialista →</a>
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">Foi um prazer compartilhar esse conteúdo com você.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F8FA;border-radius:8px;margin-bottom:6px;">
      <tr><td style="padding:16px 18px;">
        <span style="display:block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.2px;color:#1A56FF;text-transform:uppercase;margin-bottom:6px;">PS</span>
        <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.6;color:#5B6270;">O Capítulo 8 do guia que você já tem em mãos traz essa tabela completa, com benchmark de mercado para cada indicador.</span>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECECEC;margin-bottom:20px;">
      <tr><td style="padding:20px 0 0 0;">
        <p style="margin:0 0 2px 0;font-weight:700;color:#0D1B2A;font-size:15.5px;">Lara</p>
        <p style="margin:0;font-size:13px;color:#8A8F98;">AutoForce — Performance &amp; Resultados</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- RODAPÉ -->
  <tr><td bgcolor="#0D1B2A" style="background-color:#0D1B2A;padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <img src="https://static.autodromo.com.br/uploads/edda9e47-aca1-4256-8a87-49515a8c4850_1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.png" alt="AutoForce" width="86" style="display:inline-block;width:86px;max-width:86px;height:auto;border:0;margin-bottom:8px;">
      </td></tr>
      <tr><td align="center" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.45);">site.autoforce.com</td></tr>
      <tr><td align="center" style="padding-top:9px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;">
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.62);text-decoration:underline;">Não quero mais receber estes e-mails</a>
      </td></tr>
    </table>
  </td></tr>

</table>
</td>
</tr>
</table>
</body>
</html>
$body_14$,
  'Lara da AutoForce',
  'autoforce@updates.autoforce.com',
  'draft',
  'sequence',
  $audience_14$Funil C — Inside Sales 2026$audience_14$,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "EmailTemplate"
  WHERE "name" = $name_14$Inside Sales 2026 — Funil C — E-mail 5 — D10$name_14$
);
