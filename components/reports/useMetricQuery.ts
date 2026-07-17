import { useEffect, useState } from 'react';
import { DataService } from '../../services/dataService';
import { MetricQueryResult, ReportWidget } from '../../types';

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

export const CHART_PALETTE = ['#3754E2', '#818cf8', '#f59e0b', '#22c55e', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

export const formatCompactNumber = (val: number): string => {
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(val);
};
