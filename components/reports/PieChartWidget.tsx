import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ReportWidget } from '../../types';
import { useMetricQuery, CHART_PALETTE } from './useMetricQuery';
import { WidgetFrame } from './WidgetFrame';

export const PieChartWidget: React.FC<{ widget: ReportWidget }> = ({ widget }) => {
  const { data, loading, error } = useMetricQuery(widget);
  const rows = data?.rows ?? [];

  return (
    <WidgetFrame title={widget.title} loading={loading} error={error} empty={!loading && !error && rows.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="dimension" cx="50%" cy="50%" outerRadius="70%" isAnimationActive={false}>
            {rows.map((_, i) => (
              <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => new Intl.NumberFormat('pt-BR').format(value)}
            contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </WidgetFrame>
  );
};
