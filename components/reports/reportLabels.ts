import type { ElementType } from 'react';
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Table2, Hash } from 'lucide-react';
import { MetricSource, ReportWidgetType } from '../../types';

export const CHART_TYPE_META: Record<ReportWidgetType, { label: string; icon: ElementType }> = {
  KPI_CARD:   { label: 'Card (número)',    icon: Hash },
  LINE_CHART: { label: 'Gráfico de Linha', icon: LineChartIcon },
  BAR_CHART:  { label: 'Gráfico de Barra', icon: BarChart3 },
  PIE_CHART:  { label: 'Gráfico de Pizza', icon: PieChartIcon },
  TABLE:      { label: 'Tabela',           icon: Table2 },
};

export const SOURCE_LABELS: Record<MetricSource, string> = {
  leads: 'Leads / Funil',
  revenue: 'Receita',
  campaigns: 'Campanhas (Meta/Google Ads)',
  ga4: 'GA4 / Landing Pages',
  email: 'E-mail (RD Station)',
};

export const DIMENSION_LABELS: Record<string, string> = {
  date_day: 'Dia', date_week: 'Semana', date_month: 'Mês',
  status: 'Status', toStatus: 'Novo Status', firstSource: 'Origem', firstMedium: 'Mídia',
  assignedTo: 'Responsável', tag: 'Etiqueta', conversionSource: 'Conversão',
  origin: 'Origem', closedBy: 'Vendedor', originType: 'Tipo',
  platform: 'Plataforma', campaignId: 'Campanha', path: 'Página', name: 'Nome',
  source: 'Fonte', pipedriveStageName: 'Estágio', pipedrivePipelineId: 'Pipeline', pipedriveStageId: 'ID do Estágio',
};
