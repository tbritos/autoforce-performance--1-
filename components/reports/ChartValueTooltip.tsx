import React from 'react';
import { formatTooltipValue } from './useMetricQuery';

interface ChartValueTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: unknown }>;
}

export const ChartValueTooltip: React.FC<ChartValueTooltipProps> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', boxShadow: 'var(--shadow-md)', color: 'var(--fg-primary)', fontSize: 12, fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>
      {formatTooltipValue(payload[0]?.value)}
    </div>
  );
};
