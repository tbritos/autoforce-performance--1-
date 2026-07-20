import React from 'react';
import { DrillDownClickParams, ReportWidget } from '../../types';
import { KpiCardWidget } from './KpiCardWidget';
import { LineChartWidget } from './LineChartWidget';
import { BarChartWidget } from './BarChartWidget';
import { PieChartWidget } from './PieChartWidget';
import { TableWidget } from './TableWidget';

interface WidgetRendererProps {
  widget: ReportWidget;
  onDrillDown?: (params: DrillDownClickParams) => void;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widget, onDrillDown }) => {
  switch (widget.type) {
    case 'KPI_CARD':   return <KpiCardWidget widget={widget} onDrillDown={onDrillDown} />;
    case 'LINE_CHART': return <LineChartWidget widget={widget} onDrillDown={onDrillDown} />;
    case 'BAR_CHART':  return <BarChartWidget widget={widget} onDrillDown={onDrillDown} />;
    case 'PIE_CHART':  return <PieChartWidget widget={widget} onDrillDown={onDrillDown} />;
    case 'TABLE':      return <TableWidget widget={widget} onDrillDown={onDrillDown} />;
    default:           return null;
  }
};
