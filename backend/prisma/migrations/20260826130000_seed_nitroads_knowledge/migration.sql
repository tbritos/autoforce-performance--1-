-- Conhecimento global da Lara sobre o produto NitroAds.
INSERT INTO "AIKnowledgeItem" (
  "id", "agentId", "title", "category", "content", "tags", "priority", "isActive", "metadata", "updatedAt"
)
VALUES (
  'knowledge_nitroads_produto',
  NULL,
  'NitroAds — produto e como posicionar',
  'produto_nitroads',
  'O NitroAds é o serviço de tráfego pago da AutoForce, especializado 100% no setor automotivo. Ele opera campanhas em Google, Meta, YouTube, TikTok e LinkedIn, integrado nativamente ao site e ao CRM AutoForce. O diferencial é rastrear a jornada do anúncio até o lead e a venda, permitindo otimização por conversão e retorno, não apenas por volume ou CPL. A entrega inclui gestão de mídia, criativos apoiados por IA e revisados por especialistas, acompanhamento de campanhas e dashboard conectado ao funil. O modelo comercial combina uma gestão fixa e percentual por veículo vendido (não informe valores sem autorização). Para clientes AutoForce, a integração com site e CRM já existentes facilita o diagnóstico e a implantação. Quando o lead mencionar tráfego pago, agência, mídia, campanhas, Google Ads, Meta Ads, anúncios, CPL, investimento ou perguntar qual serviço foi enviado, explique que se trata do NitroAds e pergunte sobre o cenário atual. Não prometa resultados, não invente cases ou preços e encaminhe pedidos de proposta, reunião ou negociação para o SDR. Link oficial: https://site.autoforce.com/nitroads',
  ARRAY['nitroads','tráfego pago','trafego pago','mídia paga','campanhas','google ads','meta ads','anúncios','cpl','investimento em mídia'],
  10,
  true,
  '{"source":"produto_nitroads","version":1}',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "category" = EXCLUDED."category",
  "content" = EXCLUDED."content",
  "tags" = EXCLUDED."tags",
  "priority" = EXCLUDED."priority",
  "isActive" = EXCLUDED."isActive",
  "metadata" = EXCLUDED."metadata",
  "updatedAt" = CURRENT_TIMESTAMP;
