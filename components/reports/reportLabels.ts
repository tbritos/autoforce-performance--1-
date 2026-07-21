import { MetricSource } from '../../types';

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
  assignedTo: 'Responsável', origin: 'Origem', closedBy: 'Vendedor', originType: 'Tipo',
  platform: 'Plataforma', campaignId: 'Campanha', path: 'Página', name: 'Nome',
  source: 'Fonte', pipedriveStageName: 'Estágio', pipedrivePipelineId: 'Pipeline', pipedriveStageId: 'ID do Estágio',
};
