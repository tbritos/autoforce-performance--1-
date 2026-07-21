import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DrillDownClickParams, ReportQueryContext, ChartConfig } from '../../types';
import { useMetricQuery, useDrillDownTrigger, CHART_PALETTE, formatTooltipValue } from './useMetricQuery';
import { WidgetFrame } from './WidgetFrame';

export const PieChartWidget: React.FC<{ widget: ChartConfig; reportContext: ReportQueryContext; onDrillDown?: (params: DrillDownClickParams) => void }> = ({ widget, reportContext, onDrillDown }) => {
  const { data, loading, error } = useMetricQuery(widget, reportContext);
  const { enabled, trigger } = useDrillDownTrigger(widget, reportContext, onDrillDown);
  const rows = data?.rows ?? [];

  return (
    <WidgetFrame title={widget.title} loading={loading} error={error} empty={!loading && !error && rows.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows} dataKey="value" nameKey="dimension" cx="50%" cy="50%" outerRadius="70%" isAnimationActive={false}
            cursor={enabled ? 'pointer' : 'default'}
            onClick={enabled ? (_data, index) => trigger(rows[index]?.dimension ?? null) : undefined}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={formatTooltipValue}
            contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </WidgetFrame>
  );
};
