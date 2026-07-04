import { prisma } from '../config/database';
import { OAuthService } from './oauth.service';
import { PlatformConnectionService } from './platform-connection.service';

// ============================================================
// Google Ads Service
// Uses Google Ads API (REST) v17
// Requires Google OAuth token with adwords scope
// ============================================================

const GOOGLE_ADS_API = 'https://googleads.googleapis.com/v17';

async function getCustomerId(): Promise<string> {
  const conn = await PlatformConnectionService.getConnection('GOOGLE_ADS');
  const meta = conn?.metadata as Record<string, any> | null;
  const fromDb = meta?.customerId as string | undefined;
  return fromDb || process.env.GOOGLE_ADS_CUSTOMER_ID || '';
}

// Only needed when the ad account is accessed through a manager (MCC) account —
// the Google Ads API rejects the request without this header in that case.
async function getLoginCustomerId(): Promise<string | undefined> {
  const conn = await PlatformConnectionService.getConnection('GOOGLE_ADS');
  const meta = conn?.metadata as Record<string, any> | null;
  const fromDb = meta?.loginCustomerId as string | undefined;
  const raw = fromDb || process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  return raw ? raw.replace(/-/g, '') : undefined;
}

async function adsRequest<T>(path: string, body?: Record<string, any>): Promise<T> {
  const token = await OAuthService.getValidToken('GOOGLE_ADS');
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN não configurado no .env');

  const customerId = await getCustomerId();
  if (!customerId) throw new Error('Google Ads Customer ID não configurado. Configure no painel de Conexões.');

  const loginCustomerId = await getLoginCustomerId();

  const url = `${GOOGLE_ADS_API}/customers/${customerId}${path}`;
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
    // USER_PERMISSION_DENIED with no login-customer-id set almost always means the
    // ad account is only reachable through a manager (MCC) account — see
    // https://developers.google.com/google-ads/api/docs/concepts/call-structure
    if (!loginCustomerId && text.includes('USER_PERMISSION_DENIED')) {
      throw new Error(
        `Google Ads API error (${res.status}): USER_PERMISSION_DENIED. Isso geralmente significa que essa conta ` +
        `de anúncios só é acessível através de uma conta de gerência (MCC). Configure GOOGLE_ADS_LOGIN_CUSTOMER_ID ` +
        `com o ID da MCC (sem hífen) e tente novamente. Detalhes: ${text}`
      );
    }
    throw new Error(`Google Ads API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
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

export async function fetchGoogleAdsCampaigns(
  startDate?: string,
  endDate?: string
): Promise<GoogleAdsCampaign[]> {
  const today = new Date().toISOString().split('T')[0];
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = endDate || today;

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

  return rows.map((row: any) => ({
    id: String(row.campaign?.id || ''),
    name: row.campaign?.name || '',
    status: row.campaign?.status || '',
    budget: (row.campaignBudget?.amountMicros || 0) / 1_000_000,
    spend: (row.metrics?.costMicros || 0) / 1_000_000,
    impressions: Number(row.metrics?.impressions || 0),
    clicks: Number(row.metrics?.clicks || 0),
    ctr: Number(row.metrics?.ctr || 0) * 100,
    cpc: (row.metrics?.averageCpc || 0) / 1_000_000,
    conversions: Number(row.metrics?.conversions || 0),
    startDate: row.campaign?.startDate || start,
    endDate: row.campaign?.endDate || end,
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
  const campaigns = await fetchGoogleAdsCampaigns(startDate, endDate);
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
      }

      const date = new Date(endDate || new Date().toISOString().split('T')[0]);
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
