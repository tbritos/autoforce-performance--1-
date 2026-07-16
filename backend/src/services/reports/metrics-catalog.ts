// Catálogo de métricas disponíveis para a tela de Relatórios.
// Whitelist estática — o motor de query (report-query.service.ts) só aceita
// metricKey/groupBy/filters declarados aqui. Nunca monta SQL a partir de
// entrada livre do usuário.

export type MetricAggregation = 'sum' | 'count' | 'avg';

export type MetricSource = 'leads' | 'revenue' | 'campaigns' | 'ga4' | 'email';

export interface MetricDef {
  key: string;
  label: string;
  source: MetricSource;
  aggregation: MetricAggregation;
  // Campo numérico a agregar. null quando aggregation === 'count'.
  valueField: string | null;
  // Campo de data usado para o filtro de período e para groupBy por data.
  // null = fonte não tem granularidade temporal (ex: GA4 hoje é um snapshot).
  dateField: string | null;
  groupableDimensions: string[];
  filterableDimensions: string[];
  description?: string;
}

export const DATE_BUCKETS = ['date_day', 'date_week', 'date_month'] as const;
export type DateBucket = (typeof DATE_BUCKETS)[number];

export const METRICS_CATALOG: MetricDef[] = [
  // ─── Leads / Funil ──────────────────────────────────────────────────────
  {
    key: 'leads.count',
    label: 'Total de Leads',
    source: 'leads',
    aggregation: 'count',
    valueField: null,
    dateField: 'firstSeenAt',
    groupableDimensions: ['status', 'firstSource', 'firstMedium', 'assignedTo', ...DATE_BUCKETS],
    filterableDimensions: ['status', 'firstSource', 'firstMedium', 'assignedTo'],
    description: 'Contagem de leads criados no sistema.',
  },
  {
    key: 'leads.status_transitions',
    label: 'Mudanças de Status',
    source: 'leads',
    aggregation: 'count',
    valueField: null,
    dateField: 'changedAt',
    groupableDimensions: ['toStatus', ...DATE_BUCKETS],
    filterableDimensions: ['toStatus'],
    description: 'Quantidade de vezes que um lead mudou para um determinado status (ex: virou MQL, virou SQL).',
  },
  {
    key: 'leads.forecast_mrr',
    label: 'Forecast — MRR em Aberto',
    source: 'leads',
    aggregation: 'sum',
    valueField: 'pipedriveDealValue',
    dateField: null,
    groupableDimensions: ['pipedriveStageName', 'pipedrivePipelineId'],
    filterableDimensions: ['pipedrivePipelineId', 'pipedriveStageId'],
    description: 'Soma do MRR de negócios inbound em aberto no Pipedrive (não é limitado por período).',
  },
  {
    key: 'leads.forecast_setup',
    label: 'Forecast — Setup em Aberto',
    source: 'leads',
    aggregation: 'sum',
    valueField: 'pipedriveSetupValue',
    dateField: null,
    groupableDimensions: ['pipedriveStageName', 'pipedrivePipelineId'],
    filterableDimensions: ['pipedrivePipelineId', 'pipedriveStageId'],
    description: 'Soma do valor de Setup de negócios inbound em aberto no Pipedrive (não é limitado por período).',
  },

  // ─── Receita ────────────────────────────────────────────────────────────
  {
    key: 'revenue.mrr_sum',
    label: 'MRR Fechado',
    source: 'revenue',
    aggregation: 'sum',
    valueField: 'mrrValue',
    dateField: 'date',
    groupableDimensions: ['origin', 'closedBy', ...DATE_BUCKETS],
    filterableDimensions: ['origin', 'closedBy', 'originType'],
    description: 'Soma do MRR de negócios ganhos.',
  },
  {
    key: 'revenue.setup_sum',
    label: 'Setup Fechado',
    source: 'revenue',
    aggregation: 'sum',
    valueField: 'setupValue',
    dateField: 'date',
    groupableDimensions: ['origin', 'closedBy', ...DATE_BUCKETS],
    filterableDimensions: ['origin', 'closedBy', 'originType'],
    description: 'Soma do valor de Setup de negócios ganhos.',
  },
  {
    key: 'revenue.deals_count',
    label: 'Negócios Ganhos',
    source: 'revenue',
    aggregation: 'count',
    valueField: null,
    dateField: 'date',
    groupableDimensions: ['origin', 'closedBy', ...DATE_BUCKETS],
    filterableDimensions: ['origin', 'closedBy', 'originType'],
    description: 'Quantidade de negócios marcados como ganhos.',
  },

  // ─── Campanhas (Meta / Google Ads) ─────────────────────────────────────
  {
    key: 'campaigns.spend_sum',
    label: 'Investimento',
    source: 'campaigns',
    aggregation: 'sum',
    valueField: 'spend',
    dateField: 'date',
    groupableDimensions: ['platform', 'campaignId', ...DATE_BUCKETS],
    filterableDimensions: ['platform', 'campaignId'],
    description: 'Soma do gasto em mídia paga.',
  },
  {
    key: 'campaigns.impressions_sum',
    label: 'Impressões',
    source: 'campaigns',
    aggregation: 'sum',
    valueField: 'impressions',
    dateField: 'date',
    groupableDimensions: ['platform', 'campaignId', ...DATE_BUCKETS],
    filterableDimensions: ['platform', 'campaignId'],
  },
  {
    key: 'campaigns.clicks_sum',
    label: 'Cliques',
    source: 'campaigns',
    aggregation: 'sum',
    valueField: 'clicks',
    dateField: 'date',
    groupableDimensions: ['platform', 'campaignId', ...DATE_BUCKETS],
    filterableDimensions: ['platform', 'campaignId'],
  },
  {
    key: 'campaigns.leads_sum',
    label: 'Leads (Campanhas)',
    source: 'campaigns',
    aggregation: 'sum',
    valueField: 'leads',
    dateField: 'date',
    groupableDimensions: ['platform', 'campaignId', ...DATE_BUCKETS],
    filterableDimensions: ['platform', 'campaignId'],
    description: 'Leads reportados pela própria plataforma de mídia (Meta/Google), não o Lead do nosso funil.',
  },
  {
    key: 'campaigns.conversions_sum',
    label: 'Conversões (Campanhas)',
    source: 'campaigns',
    aggregation: 'sum',
    valueField: 'conversions',
    dateField: 'date',
    groupableDimensions: ['platform', 'campaignId', ...DATE_BUCKETS],
    filterableDimensions: ['platform', 'campaignId'],
  },

  // ─── GA4 / Landing Pages ────────────────────────────────────────────────
  // Sem dateField: LandingPage guarda um snapshot acumulado por página, não
  // uma linha por dia — não dá pra montar série temporal com o dado de hoje.
  {
    key: 'ga4.sessions_sum',
    label: 'Sessões (GA4)',
    source: 'ga4',
    aggregation: 'sum',
    valueField: 'sessions',
    dateField: null,
    groupableDimensions: ['path', 'name'],
    filterableDimensions: ['path'],
    description: 'Soma de sessões por landing page. Snapshot atual — não suporta série temporal.',
  },
  {
    key: 'ga4.views_sum',
    label: 'Visualizações (GA4)',
    source: 'ga4',
    aggregation: 'sum',
    valueField: 'views',
    dateField: null,
    groupableDimensions: ['path', 'name'],
    filterableDimensions: ['path'],
  },
  {
    key: 'ga4.conversions_sum',
    label: 'Conversões (GA4)',
    source: 'ga4',
    aggregation: 'sum',
    valueField: 'conversions',
    dateField: null,
    groupableDimensions: ['path', 'name'],
    filterableDimensions: ['path'],
  },
  {
    key: 'ga4.bounce_rate_avg',
    label: 'Taxa de Rejeição Média (GA4)',
    source: 'ga4',
    aggregation: 'avg',
    valueField: 'bounceRate',
    dateField: null,
    groupableDimensions: ['path', 'name'],
    filterableDimensions: ['path'],
  },

  // ─── E-mail (RD Station) ────────────────────────────────────────────────
  {
    key: 'email.sends_sum',
    label: 'E-mails Enviados',
    source: 'email',
    aggregation: 'sum',
    valueField: 'sends',
    dateField: 'date',
    groupableDimensions: ['source', ...DATE_BUCKETS],
    filterableDimensions: ['source'],
  },
  {
    key: 'email.opens_sum',
    label: 'Aberturas de E-mail',
    source: 'email',
    aggregation: 'sum',
    valueField: 'opens',
    dateField: 'date',
    groupableDimensions: ['source', ...DATE_BUCKETS],
    filterableDimensions: ['source'],
  },
  {
    key: 'email.clicks_sum',
    label: 'Cliques em E-mail',
    source: 'email',
    aggregation: 'sum',
    valueField: 'clicks',
    dateField: 'date',
    groupableDimensions: ['source', ...DATE_BUCKETS],
    filterableDimensions: ['source'],
  },
  {
    key: 'email.bounce_sum',
    label: 'Bounces de E-mail',
    source: 'email',
    aggregation: 'sum',
    valueField: 'bounce',
    dateField: 'date',
    groupableDimensions: ['source', ...DATE_BUCKETS],
    filterableDimensions: ['source'],
  },
  {
    key: 'email.unsubscribes_sum',
    label: 'Descadastros de E-mail',
    source: 'email',
    aggregation: 'sum',
    valueField: 'unsubscribes',
    dateField: 'date',
    groupableDimensions: ['source', ...DATE_BUCKETS],
    filterableDimensions: ['source'],
  },
];

const METRICS_BY_KEY = new Map(METRICS_CATALOG.map(m => [m.key, m]));

export function getMetricDef(key: string): MetricDef {
  const def = METRICS_BY_KEY.get(key);
  if (!def) throw new Error(`Métrica desconhecida: ${key}`);
  return def;
}

export function listMetrics(): MetricDef[] {
  return METRICS_CATALOG;
}

export function isDateBucket(value: string): value is DateBucket {
  return (DATE_BUCKETS as readonly string[]).includes(value);
}
