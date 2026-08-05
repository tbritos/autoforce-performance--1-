import { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { DrillDownClickParams, MetricDef, MetricQueryResult, ReportQueryContext, ChartConfig } from '../../types';

export function useMetricQuery(widget: ChartConfig, ctx: ReportQueryContext) {
  const [data, setData] = useState<MetricQueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    DataService.queryReportMetric({
      metricKey: widget.metricKey,
      groupBy: widget.groupBy,
      filters: ctx.filters,
      dateFrom: ctx.dateFrom,
      dateTo: ctx.dateTo,
      datePreset: ctx.datePreset,
    })
      .then(res => { if (!cancelled) setData(res); })
      .catch((err: Error) => { if (!cancelled) setError(err.message || 'Erro ao buscar dado'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [widget.metricKey, widget.groupBy, JSON.stringify(ctx.filters), ctx.dateFrom, ctx.dateTo, ctx.datePreset]);

  return { data, loading, error };
}

// Cache simples do catálogo de métricas — evita cada widget da tela buscar
// /reports/metrics de novo, o catálogo é estático dentro de uma sessão.
let metricsCachePromise: Promise<MetricDef[]> | null = null;
function fetchMetricsCached(): Promise<MetricDef[]> {
  if (!metricsCachePromise) metricsCachePromise = DataService.getReportMetrics();
  return metricsCachePromise;
}

export function useMetricDef(metricKey: string): MetricDef | undefined {
  const [def, setDef] = useState<MetricDef | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetchMetricsCached()
      .then(list => { if (!cancelled) setDef(list.find(m => m.key === metricKey)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [metricKey]);
  return def;
}

// Prepara o clique de drill-down de um widget: desativado pra métricas GA4
// (não existe registro individual por trás de um snapshot por página) ou
// quando a tela não passou onDrillDown. `dimensionLabel` null = clique no
// total (card de KPI), sem filtro extra de "pedaço" clicado.
export function useDrillDownTrigger(widget: ChartConfig, ctx: ReportQueryContext, onDrillDown?: (params: DrillDownClickParams) => void) {
  const def = useMetricDef(widget.metricKey);
  const enabled = !!onDrillDown && !!def && def.source !== 'ga4';
  const trigger = (dimensionLabel: string | null, visibleLabel?: string | null) => {
    if (!enabled || !onDrillDown) return;
    onDrillDown({
      metricKey: widget.metricKey,
      groupBy: widget.groupBy,
      dimension: dimensionLabel,
      filters: ctx.filters,
      dateFrom: ctx.dateFrom,
      dateTo: ctx.dateTo,
      datePreset: ctx.datePreset,
      title: dimensionLabel ? `${widget.title} — ${visibleLabel ?? dimensionLabel}` : widget.title,
    });
  };
  return { enabled, trigger };
}

export const CHART_PALETTE = ['#3754E2', '#818cf8', '#f59e0b', '#22c55e', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

const ENUM_LABELS: Record<string, string> = {
  LEAD: 'Lead',
  MQL: 'MQL',
  SQL: 'SQL',
  SCHEDULED: 'Agendado',
  DEMO: 'Demonstração',
  PROPOSAL: 'Proposta',
  OPPORTUNITY: 'Oportunidade',
  CLIENT: 'Cliente',
  LOST: 'Perdido',
  DISQUALIFIED: 'Desqualificado',
  OPEN: 'Aberto',
  WON: 'Ganho',
  DELETED: 'Excluído',
  META_ADS: 'Meta Ads',
  GOOGLE_ADS: 'Google Ads',
  GOOGLE_ANALYTICS: 'Google Analytics',
  RD_STATION: 'RD Station',
  GOOGLE_CALENDAR: 'Google Agenda',
  PIPEDRIVE: 'Pipedrive',
  INSTAGRAM: 'Instagram',
  WHATSAPP: 'WhatsApp',
  INBOUND: 'Entrada',
  OUTBOUND: 'Prospecção ativa',
  UPSELL: 'Venda adicional',
  PAID_SOCIAL: 'Redes sociais pagas',
  ORGANIC_SOCIAL: 'Redes sociais orgânicas',
  ORGANIC_SEARCH: 'Busca orgânica',
  PAID_SEARCH: 'Busca paga',
  REFERRAL: 'Indicação',
  DIRECT: 'Direto',
  EMAIL: 'E-mail',
  CPC: 'CPC',
  QUALIFICATION: 'Qualificação',
  MEETING: 'Reunião',
  MEETING_SCHEDULED: 'Reunião agendada',
  DEMONSTRATION: 'Demonstração',
  PROPOSAL_SENT: 'Proposta enviada',
  CONTRACT_SIGNED: 'Contrato assinado',
};

const enumKey = (value: string): string => value
  .trim()
  .replace(/([a-z])([A-Z])/g, '$1_$2')
  .replace(/[^a-zA-Z0-9]+/g, '_')
  .replace(/^_|_$/g, '')
  .toUpperCase();

const titleCase = (value: string): string => value
  .toLocaleLowerCase('pt-BR')
  .replace(/(^|\s)\S/g, letter => letter.toLocaleUpperCase('pt-BR'));

const formatDateDimension = (dimension: string, groupBy: string): string => {
  if (dimension === 'Sem data') return dimension;
  if (groupBy === 'date_day') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dimension);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : dimension;
  }
  if (groupBy === 'date_month') {
    const match = /^(\d{4})-(\d{2})$/.exec(dimension);
    if (!match) return dimension;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
    const month = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(date).replace('.', '');
    return `${month}/${match[1]}`;
  }
  if (groupBy === 'date_week') {
    const match = /^(\d{4})-W(\d{2})$/.exec(dimension);
    return match ? `Sem. ${Number(match[2])}/${match[1]}` : dimension;
  }
  return dimension;
};

export const formatDimensionLabel = (dimension: string, groupBy: string | null): string => {
  if (groupBy?.startsWith('date_')) return formatDateDimension(dimension, groupBy);
  if (dimension === 'total') return 'Total';
  if (dimension === 'Não informado' || dimension === 'Sem data') return dimension;
  const translated = ENUM_LABELS[enumKey(dimension)];
  if (translated) return translated;
  if (/[_-]/.test(dimension) && !/^\d+$/.test(dimension)) return titleCase(dimension.replace(/[_-]+/g, ' '));
  return dimension;
};

export interface FormattedChartRow {
  dimension: string;
  label: string;
  value: number;
}

export const prepareChartRows = (
  rows: Array<{ dimension: string; value: number }>,
  groupBy: string | null,
): FormattedChartRow[] => {
  const prepared = rows.map(row => ({ ...row, label: formatDimensionLabel(row.dimension, groupBy) }));
  if (groupBy?.startsWith('date_')) prepared.sort((a, b) => a.dimension.localeCompare(b.dimension));
  return prepared;
};

export const formatCompactNumber = (val: number): string => {
  const compact = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
  if (Math.abs(val) >= 1_000_000) return `${compact(val / 1_000_000)} mi`;
  if (Math.abs(val) >= 1_000) return `${compact(val / 1_000)} mil`;
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(val);
};

// Recharts v3's Tooltip formatter value pode ser number | string | array | undefined —
// essa função normaliza pra exibição independente do tipo recebido.
export const formatTooltipValue = (value: unknown): string => {
  if (typeof value === 'number') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
  if (Array.isArray(value)) return value.map(formatTooltipValue).join(', ');
  return value == null ? '' : String(value);
};
