import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { DrillDownClickParams, ReportQueryContext, ChartConfig } from '../../types';
import { useMetricQuery, useDrillDownTrigger, formatCompactNumber, prepareChartRows } from './useMetricQuery';
import { WidgetFrame } from './WidgetFrame';
import { ChartValueTooltip } from './ChartValueTooltip';

export const LineChartWidget: React.FC<{ widget: ChartConfig; reportContext: ReportQueryContext; onDrillDown?: (params: DrillDownClickParams) => void }> = ({ widget, reportContext, onDrillDown }) => {
  const { data, loading, error } = useMetricQuery(widget, reportContext);
  const { enabled, trigger } = useDrillDownTrigger(widget, reportContext, onDrillDown);
  const rows = prepareChartRows(data?.rows ?? [], widget.groupBy);

  return (
    <WidgetFrame title={widget.title} loading={loading} error={error} empty={!loading && !error && rows.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 28, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--fg-muted)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
          <YAxis tick={{ fill: 'var(--fg-muted)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} tickFormatter={formatCompactNumber} width={40} />
          <Tooltip
            content={<ChartValueTooltip />}
          />
          <Line
            type="monotone" dataKey="value" stroke="#3754E2" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false}
            activeDot={(props: any) => (
              <circle
                cx={props.cx} cy={props.cy} r={5} fill="#3754E2" stroke="var(--bg-surface)" strokeWidth={2}
                style={{ cursor: enabled ? 'pointer' : 'default' }}
                onClick={enabled ? () => trigger(props.payload?.dimension ?? null, props.payload?.label ?? null) : undefined}
              />
            )}
          >
            <LabelList dataKey="value" position="top" formatter={(value: unknown) => formatCompactNumber(Number(value ?? 0))} style={{ fill: 'var(--fg-secondary)', fontSize: 10, fontWeight: 700 }} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </WidgetFrame>
  );
};
