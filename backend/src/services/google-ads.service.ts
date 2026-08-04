import { prisma } from '../config/database';
import {
  getGoogleAdsApiBaseUrl,
  getGoogleAdsApiVersion,
  requireGoogleAdsCustomerId,
} from '../config/google-ads';
import { OAuthService } from './oauth.service';
import { PlatformConnectionService } from './platform-connection.service';

// ============================================================
// Google Ads Service
// Uses Google Ads API (REST). Version defaults to v25 and can be overridden
// with GOOGLE_ADS_API_VERSION when a supported upgrade is validated.
// Requires Google OAuth token with adwords scope
// ============================================================

async function getCustomerId(): Promise<string> {
  const conn = await PlatformConnectionService.getConnection('GOOGLE_ADS');
  const meta = conn?.metadata as Record<string, any> | null;
  const fromDb = meta?.customerId as string | undefined;
  return requireGoogleAdsCustomerId(fromDb || process.env.GOOGLE_ADS_CUSTOMER_ID);
}

// Only needed when the ad account is accessed through a manager (MCC) account —
// the Google Ads API rejects the request without this header in that case.
async function getLoginCustomerId(): Promise<string | undefined> {
  const conn = await PlatformConnectionService.getConnection('GOOGLE_ADS');
  const meta = conn?.metadata as Record<string, any> | null;
  const fromDb = meta?.loginCustomerId as string | undefined;
  const raw = fromDb || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (!raw) return undefined;
  return requireGoogleAdsCustomerId(raw, 'Login Customer ID (MCC)');
}

function parseGoogleAdsError(status: number, responseText: string): Error {
  let detail = responseText;
  try {
    const parsed = JSON.parse(responseText) as {
      error?: { message?: string; details?: Array<{ errors?: Array<{ errorCode?: Record<string, string>; message?: string }> }> };
    };
    const googleError = parsed.error?.details
      ?.flatMap(item => item.errors || [])
      .map(item => {
        const code = item.errorCode ? Object.values(item.errorCode)[0] : undefined;
        return [code, item.message].filter(Boolean).join(': ');
      })
      .filter(Boolean)
      .join(' | ');
    detail = googleError || parsed.error?.message || responseText;
  } catch {
    // A resposta nem sempre e JSON (por exemplo, falha de proxy).
  }

  if (detail.includes('USER_PERMISSION_DENIED')) {
    return new Error(
      `Google Ads API (${status}): sem permissao para essa conta. Confirme o Customer ID e, se o acesso ` +
      `for por uma conta de gerencia, informe tambem o Login Customer ID (MCC). Detalhes: ${detail}`,
    );
  }
  return new Error(`Google Ads API (${status}): ${detail}`);
}

async function adsRequest<T>(path: string, body?: Record<string, any>): Promise<T> {
  const token = await OAuthService.getValidToken('GOOGLE_ADS');
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN não configurado no .env');

  const customerId = await getCustomerId();
  const loginCustomerId = await getLoginCustomerId();

  const url = `${getGoogleAdsApiBaseUrl()}/customers/${customerId}${path}`;
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': devToken,
      'Content-Type': 'application/json',
      ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw parseGoogleAdsError(res.status, text);
  }

  return res.json() as Promise<T>;
}

export async function testGoogleAdsConnection(): Promise<{
  customerId: string;
  apiVersion: string;
  accountName: string | null;
}> {
  const customerId = await getCustomerId();
  const data = await adsRequest<{ results?: any[] } | Array<{ results?: any[] }>>('/googleAds:searchStream', {
    query: `
      SELECT customer.id, customer.descriptive_name
      FROM customer
      LIMIT 1
    `,
  });
  const rows = Array.isArray(data) ? data.flatMap(chunk => chunk.results || []) : data.results || [];
  const accountName = rows[0]?.customer?.descriptiveName || null;
  return { customerId, apiVersion: getGoogleAdsApiVersion(), accountName };
}

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  startDate: string;
  endDate: string;
}

interface GoogleAdsDailyCampaignMetric extends GoogleAdsCampaign {
  metricDate: string;
}

function validateGoogleAdsDate(value: string, label: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || Number.isNaN(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${label} invalida. Use o formato AAAA-MM-DD.`);
  }
  return value;
}

function resolveDateRange(startDate?: string, endDate?: string): { start: string; end: string } {
  const today = new Date().toISOString().split('T')[0];
  const start = validateGoogleAdsDate(
    startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    'Data inicial',
  );
  const end = validateGoogleAdsDate(endDate || today, 'Data final');
  if (start > end) throw new Error('A data inicial do Google Ads nao pode ser posterior a data final.');
  return { start, end };
}

function mapGoogleAdsCampaign(row: any, start: string, end: string): GoogleAdsCampaign {
  return {
    id: String(row.campaign?.id || ''),
    name: row.campaign?.name || '',
    status: row.campaign?.status || '',
    budget: Number(row.campaignBudget?.amountMicros || 0) / 1_000_000,
    spend: Number(row.metrics?.costMicros || 0) / 1_000_000,
    impressions: Number(row.metrics?.impressions || 0),
    clicks: Number(row.metrics?.clicks || 0),
    ctr: Number(row.metrics?.ctr || 0) * 100,
    cpc: Number(row.metrics?.averageCpc || 0) / 1_000_000,
    conversions: Number(row.metrics?.conversions || 0),
    startDate: row.campaign?.startDate || start,
    endDate: row.campaign?.endDate || end,
  };
}

export async function fetchGoogleAdsCampaigns(
  startDate?: string,
  endDate?: string
): Promise<GoogleAdsCampaign[]> {
  const { start, end } = resolveDateRange(startDate, endDate);

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.start_date,
      campaign.end_date,
      campaign_budget.amount_micros,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 200
  `;

  const data = await adsRequest<{ results?: any[] } | Array<{ results?: any[] }>>('/googleAds:searchStream', { query });
  const rows = Array.isArray(data)
    ? data.flatMap(chunk => chunk.results || [])
    : data.results || [];

  return rows.map((row: any) => mapGoogleAdsCampaign(row, start, end));
}

async function fetchGoogleAdsDailyCampaignMetrics(
  startDate?: string,
  endDate?: string,
): Promise<GoogleAdsDailyCampaignMetric[]> {
  const { start, end } = resolveDateRange(startDate, endDate);
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.start_date,
      campaign.end_date,
      campaign_budget.amount_micros,
      segments.date,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.status != 'REMOVED'
    ORDER BY segments.date DESC
  `;
  const data = await adsRequest<{ results?: any[] } | Array<{ results?: any[] }>>('/googleAds:searchStream', { query });
  const rows = Array.isArray(data) ? data.flatMap(chunk => chunk.results || []) : data.results || [];
  return rows.map((row: any) => ({
    ...mapGoogleAdsCampaign(row, start, end),
    metricDate: row.segments?.date || end,
  }));
}

// Google Ads status strings ('ENABLED', 'PAUSED', ...) normalized to the same
// vocabulary used for Meta Ads campaigns, so the Campaigns screen doesn't mix conventions.
function mapCampaignStatus(status: string): string {
  switch (status.toUpperCase()) {
    case 'ENABLED':  return 'Ativa';
    case 'PAUSED':   return 'Pausada';
    default:         return 'Em Revisao';
  }
}

// Sync campaign metrics to CampaignMetrics table — auto-creates the Campaign record
// on first sight so new Google Ads campaigns show up without manual setup.
export async function syncGoogleAdsCampaignMetrics(
  startDate?: string,
  endDate?: string
): Promise<{ synced: number; errors: number }> {
  const campaigns = await fetchGoogleAdsDailyCampaignMetrics(startDate, endDate);
  const connection = await PlatformConnectionService.getInternalConnection('GOOGLE_ADS');
  let synced = 0;
  let errors = 0;

  for (const c of campaigns) {
    try {
      let dbCampaign = await prisma.campaign.findFirst({
        where: { externalId: c.id, platform: 'GOOGLE_ADS', deletedAt: null },
      });

      if (!dbCampaign) {
        dbCampaign = await prisma.campaign.create({
          data: {
            name:                 c.name,
            platform:             'GOOGLE_ADS',
            status:               mapCampaignStatus(c.status),
            budget:               c.budget,
            startDate:            new Date(c.startDate),
            endDate:              new Date(c.endDate),
            externalId:           c.id,
            platformConnectionId: connection?.id ?? null,
          },
        });
      } else {
        dbCampaign = await prisma.campaign.update({
          where: { id: dbCampaign.id },
          data: {
            name: c.name,
            status: mapCampaignStatus(c.status),
            budget: c.budget,
            startDate: new Date(c.startDate),
            endDate: new Date(c.endDate),
            platformConnectionId: connection?.id ?? dbCampaign.platformConnectionId,
          },
        });
      }

      const date = new Date(`${c.metricDate}T00:00:00Z`);
      await prisma.campaignMetrics.upsert({
        where: { campaignId_date: { campaignId: dbCampaign.id, date } },
        update: {
          spend: c.spend,
          impressions: c.impressions,
          clicks: c.clicks,
          ctr: c.ctr,
          cpc: c.cpc,
          conversions: c.conversions,
        },
        create: {
          campaignId: dbCampaign.id,
          date,
          spend: c.spend,
          impressions: c.impressions,
          clicks: c.clicks,
          ctr: c.ctr,
          cpc: c.cpc,
          conversions: c.conversions,
        },
      });
      synced++;
    } catch {
      errors++;
    }
  }

  return { synced, errors };
}
