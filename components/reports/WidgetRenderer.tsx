import React from 'react';
import { ReportWidget } from '../../types';
import { KpiCardWidget } from './KpiCardWidget';
import { LineChartWidget } from './LineChartWidget';
import { BarChartWidget } from './BarChartWidget';
import { PieChartWidget } from './PieChartWidget';
import { TableWidget } from './TableWidget';

export const WidgetRenderer: React.FC<{ widget: ReportWidget }> = ({ widget }) => {
  switch (widget.type) {
    case 'KPI_CARD':   return <KpiCardWidget widget={widget} />;
    case 'LINE_CHART': return <LineChartWidget widget={widget} />;
    case 'BAR_CHART':  return <BarChartWidget widget={widget} />;
    case 'PIE_CHART':  return <PieChartWidget widget={widget} />;
    case 'TABLE':      return <TableWidget widget={widget} />;
    default:           return null;
  }
};
