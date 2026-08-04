export type PaidLeadChannel = 'meta' | 'google';

type LeadAttribution = {
  source?: string | null;
  medium?: string | null;
};

const normalizeAttributionValue = (value?: string | null): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const PAID_MEDIUM_PARTS = [
  'cpc',
  'ppc',
  'paid',
  'paid_social',
  'paidsocial',
  'cpm',
  'display',
  'search_ads',
  'performance_max',
  'pmax',
];

const NON_PAID_MEDIUM_PARTS = [
  'organic',
  'referral',
  'direct',
  'email',
];

const hasPart = (value: string, parts: string[]): boolean =>
  parts.some(part => value === part || value.includes(`_${part}`) || value.includes(`${part}_`));

/**
 * Classifica a primeira origem do lead para o CPL de mídia paga.
 *
 * Fontes explicitamente ligadas a uma plataforma de anúncios podem chegar sem
 * utm_medium (ex.: webhook nativo da Meta). Fontes genéricas, como `google`,
 * `facebook` e `instagram`, só são consideradas quando o meio confirma mídia
 * paga, evitando misturar busca/social orgânico no denominador do CPL.
 */
export const classifyPaidLeadChannel = ({
  source,
  medium,
}: LeadAttribution): PaidLeadChannel | null => {
  const normalizedSource = normalizeAttributionValue(source);
  const normalizedMedium = normalizeAttributionValue(medium);
  const isPaidMedium = hasPart(normalizedMedium, PAID_MEDIUM_PARTS);
  const isExplicitlyNonPaid = hasPart(normalizedMedium, NON_PAID_MEDIUM_PARTS);

  if (!normalizedSource || isExplicitlyNonPaid) return null;

  const explicitGoogleAdsSource =
    normalizedSource === 'adwords' ||
    normalizedSource === 'gads' ||
    (normalizedSource.includes('google') && normalizedSource.includes('ads'));

  if (explicitGoogleAdsSource) return 'google';
  if (normalizedSource === 'google') return isPaidMedium ? 'google' : null;

  const explicitMetaAdsSource =
    normalizedSource === 'meta' ||
    (normalizedSource.includes('meta') && normalizedSource.includes('ads')) ||
    (normalizedSource.includes('facebook') && normalizedSource.includes('ads')) ||
    (normalizedSource.includes('instagram') && normalizedSource.includes('ads')) ||
    normalizedSource === 'fb_ads' ||
    normalizedSource === 'ig_ads';

  if (explicitMetaAdsSource) return 'meta';

  const genericMetaSource =
    normalizedSource === 'facebook' ||
    normalizedSource === 'instagram' ||
    normalizedSource === 'fb' ||
    normalizedSource === 'ig';

  if (genericMetaSource && isPaidMedium) return 'meta';

  return null;
};

export const countPaidLeadsByChannel = (leads: LeadAttribution[]) => {
  const counts = { meta: 0, google: 0, total: 0 };

  for (const lead of leads) {
    const channel = classifyPaidLeadChannel(lead);
    if (!channel) continue;
    counts[channel] += 1;
    counts.total += 1;
  }

  return counts;
};
