import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DrillDownClickParams, ReportWidget } from '../../types';
import { useMetricQuery, useDrillDownTrigger, formatCompactNumber, formatTooltipValue } from './useMetricQuery';
import { WidgetFrame } from './WidgetFrame';

export const LineChartWidget: React.FC<{ widget: ReportWidget; onDrillDown?: (params: DrillDownClickParams) => void }> = ({ widget, onDrillDown }) => {
  const { data, loading, error } = useMetricQuery(widget);
  const { enabled, trigger } = useDrillDownTrigger(widget, onDrillDown);
  const rows = data?.rows ?? [];

  return (
    <WidgetFrame title={widget.title} loading={loading} error={error} empty={!loading && !error && rows.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="dimension" tick={{ fill: 'var(--fg-muted)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
          <YAxis tick={{ fill: 'var(--fg-muted)', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} tickFormatter={formatCompactNumber} width={40} />
          <Tooltip
            formatter={formatTooltipValue}
            contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Line
            type="monotone" dataKey="value" stroke="#3754E2" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false}
            activeDot={(props: any) => (
              <circle
                cx={props.cx} cy={props.cy} r={5} fill="#3754E2" stroke="var(--bg-surface)" strokeWidth={2}
                style={{ cursor: enabled ? 'pointer' : 'default' }}
                onClick={enabled ? () => trigger(props.payload?.dimension ?? null) : undefined}
              />
            )}
          />
        </LineChart>
      </ResponsiveContainer>
    </WidgetFrame>
  );
};
