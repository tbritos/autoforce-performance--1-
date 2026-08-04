const DEFAULT_GOOGLE_ADS_API_VERSION = 'v25';
const SUPPORTED_GOOGLE_ADS_API_VERSIONS = new Set(['v22', 'v23', 'v24', 'v25']);

export function normalizeGoogleAdsCustomerId(value: string | null | undefined): string {
  return (value || '').replace(/[\s-]/g, '');
}

export function requireGoogleAdsCustomerId(
  value: string | null | undefined,
  label = 'Customer ID',
): string {
  const normalized = normalizeGoogleAdsCustomerId(value);
  if (!/^\d{10}$/.test(normalized)) {
    throw new Error(`${label} do Google Ads invalido. Informe exatamente 10 digitos.`);
  }
  return normalized;
}

export function getGoogleAdsApiVersion(): string {
  const version = (process.env.GOOGLE_ADS_API_VERSION || DEFAULT_GOOGLE_ADS_API_VERSION).trim();
  if (!SUPPORTED_GOOGLE_ADS_API_VERSIONS.has(version)) {
    throw new Error(
      `GOOGLE_ADS_API_VERSION invalida: ${version}. Use uma versao suportada, por exemplo v25.`,
    );
  }
  return version;
}

export function getGoogleAdsApiBaseUrl(): string {
  return `https://googleads.googleapis.com/${getGoogleAdsApiVersion()}`;
}
