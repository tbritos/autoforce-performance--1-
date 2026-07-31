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

export function findWebsiteValue(...records: Array<Record<string, unknown> | null | undefined>): string | undefined {
  for (const record of records) {
    if (!record) continue;
    for (const [key, value] of Object.entries(record)) {
      if (!isLeadWebsiteFieldName(key)) continue;
      const normalized = normalizeWebsiteUrl(value);
      if (normalized) return normalized;
    }
  }
  return undefined;
}
