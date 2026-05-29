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

async function adsRequest<T>(path: string, body?: Record<string, any>): Promise<T> {
  const token = await OAuthService.getValidToken('GOOGLE_ADS');
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!devToken) throw new Error('GOOGLE_ADS_DEVELOPER_TOKEN não configurado no .env');

  const customerId = await getCustomerId();
  if (!customerId) throw new Error('Google Ads Customer ID não configurado. Configure no painel de Conexões.');

  const url = `${GOOGLE_ADS_API}/customers/${customerId}${path}`;
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': devToken,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
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

// Sync campaign metrics to CampaignMetrics table
export async function syncGoogleAdsCampaignMetrics(
  startDate?: string,
  endDate?: string
): Promise<{ synced: number; errors: number }> {
  const campaigns = await fetchGoogleAdsCampaigns(startDate, endDate);
  let synced = 0;
  let errors = 0;

  for (const c of campaigns) {
    try {
      // Find or skip if campaign not in our system
      const dbCampaign = await prisma.campaign.findFirst({
        where: { externalId: c.id, deletedAt: null },
      });
      if (!dbCampaign) continue;

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
