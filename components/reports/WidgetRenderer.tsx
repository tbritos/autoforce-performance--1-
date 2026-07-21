import React from 'react';
import { DrillDownClickParams, ReportQueryContext, ChartConfig } from '../../types';
import { KpiCardWidget } from './KpiCardWidget';
import { LineChartWidget } from './LineChartWidget';
import { BarChartWidget } from './BarChartWidget';
import { PieChartWidget } from './PieChartWidget';
import { TableWidget } from './TableWidget';

interface WidgetRendererProps {
  widget: ChartConfig;
  reportContext: ReportQueryContext;
  onDrillDown?: (params: DrillDownClickParams) => void;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ widget, reportContext, onDrillDown }) => {
  switch (widget.type) {
    case 'KPI_CARD':   return <KpiCardWidget widget={widget} reportContext={reportContext} onDrillDown={onDrillDown} />;
    case 'LINE_CHART': return <LineChartWidget widget={widget} reportContext={reportContext} onDrillDown={onDrillDown} />;
    case 'BAR_CHART':  return <BarChartWidget widget={widget} reportContext={reportContext} onDrillDown={onDrillDown} />;
    case 'PIE_CHART':  return <PieChartWidget widget={widget} reportContext={reportContext} onDrillDown={onDrillDown} />;
    case 'TABLE':      return <TableWidget widget={widget} reportContext={reportContext} onDrillDown={onDrillDown} />;
    default:           return null;
  }
};
