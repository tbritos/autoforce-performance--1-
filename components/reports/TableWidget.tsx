import React from 'react';
import { DrillDownClickParams, ReportQueryContext, ChartConfig } from '../../types';
import { prepareChartRows, useMetricQuery, useDrillDownTrigger } from './useMetricQuery';
import { WidgetFrame } from './WidgetFrame';

export const TableWidget: React.FC<{ widget: ChartConfig; reportContext: ReportQueryContext; onDrillDown?: (params: DrillDownClickParams) => void }> = ({ widget, reportContext, onDrillDown }) => {
  const { data, loading, error } = useMetricQuery(widget, reportContext);
  const { enabled, trigger } = useDrillDownTrigger(widget, reportContext, onDrillDown);
  const rows = prepareChartRows(data?.rows ?? [], widget.groupBy);

  return (
    <WidgetFrame title={widget.title} loading={loading} error={error} empty={!loading && !error && rows.length === 0}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--fg-subtle)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Dimensão</th>
            <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--fg-subtle)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.dimension}
              onClick={enabled ? () => trigger(r.dimension, r.label) : undefined}
              style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)', cursor: enabled ? 'pointer' : 'default' }}>
              <td style={{ padding: '4px 6px', color: 'var(--fg-primary)' }}>{r.label}</td>
              <td style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--fg-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(r.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </WidgetFrame>
  );
};
