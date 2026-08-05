import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { DrillDownClickParams, ReportQueryContext, ChartConfig } from '../../types';
import { useMetricQuery, useDrillDownTrigger, formatCompactNumber, prepareChartRows } from './useMetricQuery';
import { WidgetFrame } from './WidgetFrame';
import { ChartValueTooltip } from './ChartValueTooltip';

export const BarChartWidget: React.FC<{ widget: ChartConfig; reportContext: ReportQueryContext; onDrillDown?: (params: DrillDownClickParams) => void }> = ({ widget, reportContext, onDrillDown }) => {
  const { data, loading, error } = useMetricQuery(widget, reportContext);
  const { enabled, trigger } = useDrillDownTrigger(widget, reportContext, onDrillDown);
  const rows = prepareChartRows(data?.rows ?? [], widget.groupBy);

  return (
    <WidgetFrame title={widget.title} loading={loading} error={error} empty={!loading && !error && rows.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 28, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--fg-muted)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
          <YAxis tick={{ fill: 'var(--fg-muted)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} tickFormatter={formatCompactNumber} width={40} />
          <Tooltip
            content={<ChartValueTooltip />}
            cursor={{ fill: 'var(--bg-hover)' }}
          />
          <Bar
            dataKey="value" fill="#3754E2" radius={[4, 4, 0, 0]} isAnimationActive={false}
            cursor={enabled ? 'pointer' : 'default'}
            onClick={enabled ? (_data, index) => trigger(rows[index]?.dimension ?? null, rows[index]?.label ?? null) : undefined}
          >
            <LabelList dataKey="value" position="top" formatter={(value: unknown) => formatCompactNumber(Number(value ?? 0))} style={{ fill: 'var(--fg-secondary)', fontSize: 10, fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </WidgetFrame>
  );
};
