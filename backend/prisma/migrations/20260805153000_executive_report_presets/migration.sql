-- Pacote inicial de relatórios executivos. Os IDs são estáveis e a proteção
-- por nome evita duplicar um relatório equivalente criado manualmente.
INSERT INTO "Report" (
  "id", "name", "description", "layout", "createdBy", "isPublic", "isFavorite",
  "filters", "dateFrom", "dateTo", "datePreset", "metricKey", "groupBy",
  "chartType", "tableColumns", "createdAt", "updatedAt"
)
SELECT
  preset.id::uuid,
  preset.name,
  preset.description,
  '[]'::jsonb,
  NULL,
  TRUE,
  preset.favorite,
  CASE WHEN preset.filters IS NULL THEN NULL ELSE preset.filters::jsonb END,
  NULL,
  NULL,
  preset.date_preset,
  preset.metric_key,
  preset.group_by,
  preset.chart_type::"ReportWidgetType",
  NULL,
  NOW(),
  NOW()
FROM (
  VALUES
    (
      'b1000000-0000-4000-8000-000000000001',
      '[Gestão] Leads por Status — 30 dias',
      'Distribuição atual dos leads que entraram nos últimos 30 dias em cada etapa comercial.',
      TRUE, NULL, 'last_30_days', 'leads.count', 'status', 'BAR_CHART'
    ),
    (
      'b1000000-0000-4000-8000-000000000002',
      '[Gestão] Evolução de Leads — 30 dias',
      'Evolução semanal da entrada de novos leads nos últimos 30 dias.',
      FALSE, NULL, 'last_30_days', 'leads.count', 'date_week', 'LINE_CHART'
    ),
    (
      'b1000000-0000-4000-8000-000000000003',
      '[Gestão] Leads por Origem — 30 dias',
      'Mostra quais origens trouxeram os leads que entraram nos últimos 30 dias.',
      FALSE, NULL, 'last_30_days', 'leads.count', 'firstSource', 'BAR_CHART'
    ),
    (
      'b1000000-0000-4000-8000-000000000004',
      '[Gestão] Leads por Responsável — 30 dias',
      'Distribuição dos leads dos últimos 30 dias entre os responsáveis comerciais.',
      FALSE, NULL, 'last_30_days', 'leads.count', 'assignedTo', 'BAR_CHART'
    ),
    (
      'b1000000-0000-4000-8000-000000000005',
      '[Mídia] Investimento por Plataforma — 30 dias',
      'Investimento consolidado dos últimos 30 dias, separado entre Google Ads e Meta Ads.',
      TRUE, NULL, 'last_30_days', 'campaigns.spend_sum', 'platform', 'BAR_CHART'
    ),
    (
      'b1000000-0000-4000-8000-000000000006',
      '[Mídia] Leads por Plataforma — 30 dias',
      'Leads reportados pelas próprias plataformas de mídia nos últimos 30 dias. Este número pode diferir dos leads reais do CRM por causa da atribuição.',
      FALSE, NULL, 'last_30_days', 'campaigns.leads_sum', 'platform', 'BAR_CHART'
    ),
    (
      'b1000000-0000-4000-8000-000000000007',
      '[Vendas] Negócios Ganhos — 30 dias',
      'Quantidade semanal de negócios registrados como ganhos nos últimos 30 dias.',
      TRUE, NULL, 'last_30_days', 'revenue.deals_count', 'date_week', 'BAR_CHART'
    ),
    (
      'b1000000-0000-4000-8000-000000000008',
      '[Vendas] MRR Fechado — trimestre atual',
      'Evolução mensal do MRR fechado durante o trimestre atual.',
      TRUE, NULL, 'this_quarter', 'revenue.mrr_sum', 'date_month', 'LINE_CHART'
    ),
    (
      'b1000000-0000-4000-8000-000000000009',
      '[Vendas] Setup Fechado — trimestre atual',
      'Evolução mensal da receita de setup fechada durante o trimestre atual.',
      FALSE, NULL, 'this_quarter', 'revenue.setup_sum', 'date_month', 'BAR_CHART'
    ),
    (
      'b1000000-0000-4000-8000-000000000010',
      '[Forecast] MRR em Aberto por Estágio',
      'MRR dos negócios inbound atualmente em aberto, distribuído pelo estágio comercial. Não depende de período.',
      FALSE, NULL, NULL, 'leads.forecast_mrr', 'pipedriveStageName', 'BAR_CHART'
    ),
    (
      'b1000000-0000-4000-8000-000000000011',
      '[Forecast] Setup em Aberto por Estágio',
      'Valor de setup dos negócios inbound atualmente em aberto, distribuído pelo estágio comercial. Não depende de período.',
      FALSE, NULL, NULL, 'leads.forecast_setup', 'pipedriveStageName', 'BAR_CHART'
    )
) AS preset(id, name, description, favorite, filters, date_preset, metric_key, group_by, chart_type)
WHERE NOT EXISTS (
  SELECT 1 FROM "Report" existing WHERE existing."name" = preset.name
)
ON CONFLICT ("id") DO NOTHING;
