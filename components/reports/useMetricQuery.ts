import { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { DrillDownClickParams, MetricDef, MetricQueryResult, ReportWidget } from '../../types';

export function useMetricQuery(widget: ReportWidget) {
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
      filters: widget.filters,
      dateFrom: widget.dateFrom,
      dateTo: widget.dateTo,
      datePreset: widget.datePreset,
    })
      .then(res => { if (!cancelled) setData(res); })
      .catch((err: Error) => { if (!cancelled) setError(err.message || 'Erro ao buscar dado'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [widget.metricKey, widget.groupBy, JSON.stringify(widget.filters), widget.dateFrom, widget.dateTo, widget.datePreset]);

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
export function useDrillDownTrigger(widget: ReportWidget, onDrillDown?: (params: DrillDownClickParams) => void) {
  const def = useMetricDef(widget.metricKey);
  const enabled = !!onDrillDown && !!def && def.source !== 'ga4';
  const trigger = (dimensionLabel: string | null) => {
    if (!enabled || !onDrillDown) return;
    onDrillDown({
      metricKey: widget.metricKey,
      groupBy: widget.groupBy,
      dimension: dimensionLabel,
      filters: widget.filters,
      dateFrom: widget.dateFrom,
      dateTo: widget.dateTo,
      datePreset: widget.datePreset,
      title: dimensionLabel ? `${widget.title} — ${dimensionLabel}` : widget.title,
    });
  };
  return { enabled, trigger };
}

export const CHART_PALETTE = ['#3754E2', '#818cf8', '#f59e0b', '#22c55e', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

export const formatCompactNumber = (val: number): string => {
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(val);
};

// Recharts v3's Tooltip formatter value pode ser number | string | array | undefined —
// essa função normaliza pra exibição independente do tipo recebido.
export const formatTooltipValue = (value: unknown): string => {
  if (typeof value === 'number') return new Intl.NumberFormat('pt-BR').format(value);
  if (Array.isArray(value)) return value.map(formatTooltipValue).join(', ');
  return value == null ? '' : String(value);
};
