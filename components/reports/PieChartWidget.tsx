import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DrillDownClickParams, ReportQueryContext, ChartConfig } from '../../types';
import { useMetricQuery, useDrillDownTrigger, CHART_PALETTE, formatCompactNumber, prepareChartRows } from './useMetricQuery';
import { WidgetFrame } from './WidgetFrame';
import { ChartValueTooltip } from './ChartValueTooltip';

export const PieChartWidget: React.FC<{ widget: ChartConfig; reportContext: ReportQueryContext; onDrillDown?: (params: DrillDownClickParams) => void }> = ({ widget, reportContext, onDrillDown }) => {
  const { data, loading, error } = useMetricQuery(widget, reportContext);
  const { enabled, trigger } = useDrillDownTrigger(widget, reportContext, onDrillDown);
  const rows = prepareChartRows(data?.rows ?? [], widget.groupBy);

  return (
    <WidgetFrame title={widget.title} loading={loading} error={error} empty={!loading && !error && rows.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows} dataKey="value" nameKey="label" cx="50%" cy="48%" outerRadius="65%" isAnimationActive={false}
            label={({ value }) => formatCompactNumber(Number(value ?? 0))}
            cursor={enabled ? 'pointer' : 'default'}
            onClick={enabled ? (_data, index) => trigger(rows[index]?.dimension ?? null, rows[index]?.label ?? null) : undefined}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            content={<ChartValueTooltip />}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </WidgetFrame>
  );
};
