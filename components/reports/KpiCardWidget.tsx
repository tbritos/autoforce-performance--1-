import React from 'react';
import { DrillDownClickParams, ReportQueryContext, ReportWidget } from '../../types';
import { useMetricQuery, useDrillDownTrigger, formatCompactNumber } from './useMetricQuery';
import { WidgetFrame } from './WidgetFrame';

export const KpiCardWidget: React.FC<{ widget: ReportWidget; reportContext: ReportQueryContext; onDrillDown?: (params: DrillDownClickParams) => void }> = ({ widget, reportContext, onDrillDown }) => {
  const { data, loading, error } = useMetricQuery(widget, reportContext);
  const { enabled, trigger } = useDrillDownTrigger(widget, reportContext, onDrillDown);
  const rows = data?.rows ?? [];
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <WidgetFrame title={widget.title} loading={loading} error={error} empty={!loading && !error && rows.length === 0}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span
          onClick={enabled ? () => trigger(null) : undefined}
          title={enabled ? 'Clique pra ver os registros por trás desse número' : undefined}
          style={{ fontSize: 'clamp(20px, 6vw, 34px)', fontWeight: 700, color: 'var(--fg-primary)', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere', cursor: enabled ? 'pointer' : 'default' }}>
          {formatCompactNumber(total)}
        </span>
      </div>
    </WidgetFrame>
  );
};
