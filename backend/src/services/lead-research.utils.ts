import { normalizeAIScoreForFit, type LaraResearchFit } from './lara-runtime.utils';

export type ResearchBusinessType =
  | 'dealership'
  | 'automotive_group'
  | 'automaker'
  | 'vehicle_reseller'
  | 'technology_supplier'
  | 'marketing_agency'
  | 'consultancy'
  | 'non_automotive_company'
  | 'other'
  | 'unknown';

export interface ResearchEvidence {
  source: 'official_site' | 'cnpj' | 'web_search' | 'lead_record';
  fact: string;
}

export interface RawResearchAssessment {
  fit?: unknown;
  score?: unknown;
  summary?: unknown;
  reason?: unknown;
  business_type?: unknown;
  vehicle_stock?: unknown;
  website_provider?: unknown;
  website_provider_evidence?: unknown;
  evidence?: unknown;
}

export interface NormalizedResearchAssessment {
  fit: LaraResearchFit;
  score: number;
  summary: string;
  reason: string;
  businessType: ResearchBusinessType;
  vehicleStock: number | null;
  websiteProvider: string | null;
  websiteProviderEvidence: string | null;
  evidence: ResearchEvidence[];
}

const BUSINESS_TYPES = new Set<ResearchBusinessType>([
  'dealership',
  'automotive_group',
  'automaker',
  'vehicle_reseller',
  'technology_supplier',
  'marketing_agency',
  'consultancy',
  'non_automotive_company',
  'other',
  'unknown',
]);

const EXPLICITLY_OUTSIDE_ICP = new Set<ResearchBusinessType>([
  'technology_supplier',
  'marketing_agency',
  'consultancy',
  'non_automotive_company',
]);

function hostnameFromSiteUrl(siteUrl: string | null): string | null {
  if (!siteUrl) return null;
  try {
    const normalized = /^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`;
    return new URL(normalized).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

// A consulta descreve a empresa de forma neutra. Acrescentar termos do ICP
// (como "concessionaria" ou "revenda") cria viés de confirmação e faz a
// busca devolver empresas automotivas mesmo quando o domínio pertence a um
// fornecedor que apenas atende esse mercado.
export function buildLeadResearchQuery(input: {
  name: string | null;
  company: string | null;
  siteUrl: string | null;
}): string | null {
  const target = input.company?.trim() || input.name?.trim();
  const hostname = hostnameFromSiteUrl(input.siteUrl);
  if (!target && !hostname) return null;

  const parts = [
    hostname ? `site:${hostname} "${hostname}"` : null,
    // Havendo domínio, não mistura o nome digitado pelo lead na busca. Um
    // nome falso ou aleatório pode zerar os resultados do site correto.
    !hostname && target ? `"${target}"` : null,
    'empresa atividade produtos serviços o que faz CNPJ',
  ];
  return parts.filter(Boolean).join(' ');
}

function parseEvidence(value: unknown): ResearchEvidence[] {
  if (!Array.isArray(value)) return [];
  const allowedSources = new Set<ResearchEvidence['source']>([
    'official_site',
    'cnpj',
    'web_search',
    'lead_record',
  ]);

  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const source = (item as { source?: unknown }).source;
    const fact = (item as { fact?: unknown }).fact;
    if (!allowedSources.has(source as ResearchEvidence['source']) || typeof fact !== 'string' || !fact.trim()) {
      return [];
    }
    return [{ source: source as ResearchEvidence['source'], fact: fact.trim().slice(0, 500) }];
  }).slice(0, 6);
}

export function normalizeResearchAssessment(
  raw: RawResearchAssessment,
  fallbackSummary: string,
): NormalizedResearchAssessment {
  const rawBusinessType = typeof raw.business_type === 'string' ? raw.business_type : 'unknown';
  const businessType = BUSINESS_TYPES.has(rawBusinessType as ResearchBusinessType)
    ? rawBusinessType as ResearchBusinessType
    : 'unknown';
  const evidence = parseEvidence(raw.evidence);
  const rawVehicleStock = raw.vehicle_stock === null
    || raw.vehicle_stock === undefined
    || raw.vehicle_stock === ''
    ? Number.NaN
    : Number(raw.vehicle_stock);
  const vehicleStock = Number.isFinite(rawVehicleStock) && rawVehicleStock >= 0
    ? Math.floor(rawVehicleStock)
    : null;
  const rawWebsiteProvider = typeof raw.website_provider === 'string'
    ? raw.website_provider.trim()
    : '';
  const rawWebsiteProviderEvidence = typeof raw.website_provider_evidence === 'string'
    ? raw.website_provider_evidence.trim()
    : '';
  const normalizedProvider = rawWebsiteProvider
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const providerIsUnknown = !rawWebsiteProvider
    || ['unknown', 'desconhecido', 'nao identificado', 'nenhum', 'null'].includes(normalizedProvider);
  // Nome sem credito observavel nao e fornecedor comprovado. Mantem vazio
  // para a Lara nao repetir como fato uma inferencia do modelo.
  const websiteProvider = !providerIsUnknown && rawWebsiteProviderEvidence
    ? rawWebsiteProvider.slice(0, 160)
    : null;
  const websiteProviderEvidence = websiteProvider
    ? rawWebsiteProviderEvidence.slice(0, 600)
    : null;
  const requestedFit: LaraResearchFit = raw.fit === 'qualified' || raw.fit === 'disqualified'
    ? raw.fit
    : 'nurture';

  let fit = requestedFit;
  if (EXPLICITLY_OUTSIDE_ICP.has(businessType) && evidence.length > 0) {
    fit = 'disqualified';
  } else if (fit === 'disqualified' && evidence.length === 0) {
    fit = 'nurture';
  } else if (fit === 'qualified') {
    const hasStrongBusinessEvidence = evidence.some(item => item.source === 'official_site' || item.source === 'cnpj');
    const eligibleType = businessType === 'dealership'
      || businessType === 'automotive_group'
      || businessType === 'automaker'
      || (businessType === 'vehicle_reseller' && vehicleStock !== null && vehicleStock >= 50);
    // Uma resposta "qualified" sem identificar uma empresa elegível nunca
    // avança sozinha. Falta de evidência vira nurture, não desqualificação.
    if (!eligibleType || !hasStrongBusinessEvidence) fit = 'nurture';
  }

  return {
    fit,
    score: normalizeAIScoreForFit(fit, raw.score),
    summary: typeof raw.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim().slice(0, 1800)
      : fallbackSummary.slice(0, 1800),
    reason: typeof raw.reason === 'string' && raw.reason.trim()
      ? raw.reason.trim().slice(0, 1000)
      : 'Pesquisa automática de informação',
    businessType,
    vehicleStock,
    websiteProvider,
    websiteProviderEvidence,
    evidence,
  };
}
