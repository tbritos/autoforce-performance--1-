import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DrillDownClickParams, ReportWidget } from '../../types';
import { useMetricQuery, useDrillDownTrigger, formatCompactNumber, formatTooltipValue } from './useMetricQuery';
import { WidgetFrame } from './WidgetFrame';

export const BarChartWidget: React.FC<{ widget: ReportWidget; onDrillDown?: (params: DrillDownClickParams) => void }> = ({ widget, onDrillDown }) => {
  const { data, loading, error } = useMetricQuery(widget);
  const { enabled, trigger } = useDrillDownTrigger(widget, onDrillDown);
  const rows = data?.rows ?? [];

  return (
    <WidgetFrame title={widget.title} loading={loading} error={error} empty={!loading && !error && rows.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="dimension" tick={{ fill: 'var(--fg-muted)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
          <YAxis tick={{ fill: 'var(--fg-muted)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} tickFormatter={formatCompactNumber} width={40} />
          <Tooltip
            formatter={formatTooltipValue}
            contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            cursor={{ fill: 'var(--bg-hover)' }}
          />
          <Bar
            dataKey="value" fill="#3754E2" radius={[4, 4, 0, 0]} isAnimationActive={false}
            cursor={enabled ? 'pointer' : 'default'}
            onClick={enabled ? (_data, index) => trigger(rows[index]?.dimension ?? null) : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </WidgetFrame>
  );
};
