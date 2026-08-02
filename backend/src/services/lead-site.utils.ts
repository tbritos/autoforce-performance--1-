const WEBSITE_FIELD_ALIASES = new Set([
  'site',
  'siteatual',
  'sitedaempresa',
  'sitedoconcessionario',
  'sitedaconcessionaria',
  'website',
  'websiteurl',
  'urlsite',
  'urldosite',
  'urldaempresa',
  'urlempresa',
  'dominio',
  'dominiodaempresa',
  'dominioempresa',
]);

export type LeadWebsiteSource = 'lead_provided' | 'corporate_email' | 'web_search';

// Paginas de consulta, redes sociais e diretorios podem aparecer antes do
// dominio oficial nas buscas por nome/CNPJ. Elas sao fontes auxiliares sobre a
// empresa, mas nunca devem ser promovidas a "Site da empresa" automaticamente.
const NON_OFFICIAL_WEBSITE_DOMAINS = [
  'linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'youtube.com',
  'reclameaqui.com.br', 'glassdoor.com', 'glassdoor.com.br', 'indeed.com', 'catho.com.br',
  'google.com', 'wikipedia.org', 'econodata.com.br', 'empresascnpj.com', 'cnpj.biz',
  'consultasocio.com', 'apontador.com.br', 'guiamais.com.br', 'telelistas.net', 'casadados.com.br',
  'serasaexperian.com.br',
];

function normalizeFieldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function isLeadWebsiteFieldName(fieldPath: string): boolean {
  const lastPart = fieldPath.split('.').pop() ?? fieldPath;
  const normalized = normalizeFieldName(lastPart);
  if (WEBSITE_FIELD_ALIASES.has(normalized)) return true;

  // Formularios costumam enviar o rotulo completo da pergunta como chave.
  // Aceita frases inequivocas, mas nao confunde page_url/landing_page com o
  // site da empresa do lead.
  if (normalized.includes('landingpage') || normalized.includes('pageurl')) return false;
  return normalized.includes('siteempresa')
    || normalized.includes('sitedaempresa')
    || normalized.includes('websiteempresa')
    || normalized.includes('dominioempresa');
}

export function normalizeWebsiteUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  let raw = String(value).trim();
  if (!raw) return undefined;

  // Alguns campos chegam como "Site: exemplo.com.br" ou com texto depois
  // da URL. Extrai primeiro uma URL/dominio plausivel sem aceitar palavras.
  raw = raw.replace(/^site\s*:\s*/i, '').trim();
  const candidate = raw.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}(?:\/[^\s]*)?/i)?.[0];
  if (!candidate) return undefined;

  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (!url.hostname.includes('.')) return undefined;
    url.username = '';
    url.password = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

export function findWebsiteValue(...records: unknown[]): string | undefined {
  const visited = new Set<object>();

  const search = (value: unknown, depth: number): string | undefined => {
    if (!value || typeof value !== 'object' || depth > 4 || visited.has(value as object)) {
      return undefined;
    }
    visited.add(value as object);

    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = search(item, depth + 1);
        if (nested) return nested;
      }
      return undefined;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    for (const [key, fieldValue] of entries) {
      if (!isLeadWebsiteFieldName(key)) continue;
      const normalized = normalizeWebsiteUrl(fieldValue);
      if (normalized) return normalized;
    }
    for (const [, child] of entries) {
      const nested = search(child, depth + 1);
      if (nested) return nested;
    }
    return undefined;
  };

  for (const record of records) {
    const website = search(record, 0);
    if (website) return website;
  }
  return undefined;
}

export function isNonOfficialWebsiteUrl(value: unknown): boolean {
  const normalized = normalizeWebsiteUrl(value);
  if (!normalized) return false;
  const hostname = new URL(normalized).hostname.toLowerCase().replace(/^www\./, '');
  return NON_OFFICIAL_WEBSITE_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function resolveLeadResearchWebsite(input: {
  siteUrl?: string | null;
  customFields?: unknown;
  researchSiteSource?: string | null;
}): { siteUrl: string | null; source: LeadWebsiteSource | null; cameFromCustomField: boolean } {
  // O campo preenchido no formulario/conversa e declaracao direta do lead e
  // sempre vence um dominio que a pesquisa tenha descoberto anteriormente.
  const customFieldSite = findWebsiteValue(input.customFields);
  if (customFieldSite) {
    return { siteUrl: customFieldSite, source: 'lead_provided', cameFromCustomField: true };
  }

  const siteUrl = normalizeWebsiteUrl(input.siteUrl) ?? null;
  if (!siteUrl) return { siteUrl: null, source: null, cameFromCustomField: false };

  const knownSource = input.researchSiteSource === 'lead_provided'
    || input.researchSiteSource === 'corporate_email'
    || input.researchSiteSource === 'web_search'
    ? input.researchSiteSource
    : 'lead_provided';
  return { siteUrl, source: knownSource, cameFromCustomField: false };
}
