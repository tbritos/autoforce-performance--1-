export type EmailCommunicationType = 'NEWSLETTER' | 'MARKETING' | 'OPERATIONAL';
export type EmailSuppressionScope = 'newsletter' | 'marketing' | 'all';

export const NEWSLETTER_AUDIENCE_ID = '__newsletter_subscribers__';

export function normalizeEmailCommunicationType(
  value: unknown,
  fallback: EmailCommunicationType = 'MARKETING',
): EmailCommunicationType {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'NEWSLETTER' || normalized === 'MARKETING' || normalized === 'OPERATIONAL') return normalized;
  return fallback;
}

export function normalizeEmailSuppressionScope(value: unknown): Exclude<EmailSuppressionScope, 'all'> {
  return String(value ?? '').trim().toLowerCase() === 'marketing' ? 'marketing' : 'newsletter';
}

export function suppressionScopeForCommunication(type: EmailCommunicationType): Exclude<EmailSuppressionScope, 'all'> | null {
  if (type === 'NEWSLETTER') return 'newsletter';
  if (type === 'MARKETING') return 'marketing';
  return null;
}

export function blockingSuppressionScopes(type: EmailCommunicationType): EmailSuppressionScope[] {
  const categoryScope = suppressionScopeForCommunication(type);
  return categoryScope ? ['all', categoryScope] : ['all'];
}

export function emailCommunicationLabel(type: EmailCommunicationType): string {
  if (type === 'NEWSLETTER') return 'Newsletter';
  if (type === 'OPERATIONAL') return 'Operacional';
  return 'Marketing e nutrição';
}

export function emailSuppressionScopeLabel(scope: string): string {
  if (scope === 'newsletter') return 'Newsletter';
  if (scope === 'marketing') return 'Marketing e nutrição';
  if (scope === 'all') return 'Todos os e-mails';
  return scope;
}
