import type { LeadStatus } from '@prisma/client';

// Pipelines comerciais configurados no produto: Novo Cliente e Upsell.
// Webhooks do Pipedrive podem chegar de qualquer board, então o Forecast
// precisa desta allowlist em vez de aceitar todo snapshot salvo no Lead.
export const PIPEDRIVE_SALES_PIPELINE_IDS = [2, 5] as const;

export const PIPEDRIVE_FORECAST_LEAD_STATUSES: LeadStatus[] = [
  'LEAD',
  'MQL',
  'SQL',
  'SCHEDULED',
  'DEMO',
  'PROPOSAL',
  'OPPORTUNITY',
];

export function canApplyPipedriveDealToLead(
  currentDealId: string | null | undefined,
  incomingDealId: string,
): boolean {
  return !currentDealId || currentDealId === incomingDealId;
}

export function pipedriveForecastLeadWhere(): Record<string, unknown> {
  return {
    deletedAt: null,
    pipedriveDealId: { not: null },
    pipedriveDealStatus: 'open',
    pipedrivePipelineId: { in: [...PIPEDRIVE_SALES_PIPELINE_IDS] },
    status: { in: [...PIPEDRIVE_FORECAST_LEAD_STATUSES] },
  };
}
