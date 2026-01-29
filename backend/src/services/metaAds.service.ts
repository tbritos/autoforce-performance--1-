import https from 'https';

type MetaCampaignStatus = 'Ativa' | 'Pausada' | 'Em Revisao';

export type MetaCampaign = {
  id: string;
  name: string;
  status: MetaCampaignStatus;
  budget: number;
  startDate: string;
  endDate: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
};

type MetaCampaignRow = {
  id: string;
  name: string;
  effective_status?: string;
  start_time?: string;
  stop_time?: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

type MetaInsightRow = {
  campaign_id: string;
  spend?: string;
  reach?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
};

const API_VERSION = 'v19.0';

const requestJson = <T>(url: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Meta API error (${res.statusCode}): ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
  });

const mapStatus = (status?: string): MetaCampaignStatus => {
  switch ((status || '').toUpperCase()) {
    case 'ACTIVE':
      return 'Ativa';
    case 'IN_REVIEW':
    case 'PENDING_REVIEW':
      return 'Em Revisao';
    case 'PAUSED':
    case 'ARCHIVED':
    case 'DELETED':
    case 'ADSET_PAUSED':
    case 'CAMPAIGN_PAUSED':
      return 'Pausada';
    default:
      return 'Pausada';
  }
};

const parseBudget = (daily?: string, lifetime?: string) => {
  const raw = daily || lifetime || '0';
  const value = Number(raw);
  if (Number.isNaN(value)) return 0;
  return value / 100;
};

const parseNumber = (value?: string) => {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
};

export const fetchMetaCampaigns = async (
  startDate?: string,
  endDate?: string
): Promise<MetaCampaign[]> => {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    throw new Error('META_ACCESS_TOKEN e META_AD_ACCOUNT_ID devem estar configurados no .env');
  }

  const today = new Date().toISOString().split('T')[0];
  const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  let start = startDate || defaultStart;
  let end = endDate || today;

  if (start > today) start = today;
  if (end > today) end = today;
  if (start > end) start = end;

  const encodedToken = encodeURIComponent(accessToken);
  const campaignsUrl =
    `https://graph.facebook.com/${API_VERSION}/${adAccountId}/campaigns` +
    `?fields=id,name,effective_status,start_time,stop_time,daily_budget,lifetime_budget` +
    `&limit=200&access_token=${encodedToken}`;

  const insightsUrl =
    `https://graph.facebook.com/${API_VERSION}/${adAccountId}/insights` +
    `?fields=campaign_id,spend,reach,impressions,clicks,ctr,cpc,cpm` +
    `&level=campaign&time_range[since]=${start}&time_range[until]=${end}` +
    `&limit=200&access_token=${encodedToken}`;

  const [campaignResponse, insightsResponse] = await Promise.all([
    requestJson<{ data?: MetaCampaignRow[] }>(campaignsUrl),
    requestJson<{ data?: MetaInsightRow[] }>(insightsUrl),
  ]);

  const insightsMap = new Map<string, MetaInsightRow>();
  (insightsResponse.data || []).forEach(row => {
    insightsMap.set(row.campaign_id, row);
  });

  return (campaignResponse.data || [])
    .filter(row => mapStatus(row.effective_status) === 'Ativa')
    .map(row => {
    const insight = insightsMap.get(row.id);
    const startTime = row.start_time ? row.start_time.split('T')[0] : start;
    const endTime = row.stop_time ? row.stop_time.split('T')[0] : end;

    return {
      id: row.id,
      name: row.name,
      status: mapStatus(row.effective_status),
      budget: parseBudget(row.daily_budget, row.lifetime_budget),
      startDate: startTime,
      endDate: endTime,
      spend: parseNumber(insight?.spend),
      reach: Math.round(parseNumber(insight?.reach)),
      impressions: Math.round(parseNumber(insight?.impressions)),
      clicks: Math.round(parseNumber(insight?.clicks)),
      ctr: parseNumber(insight?.ctr),
      cpc: parseNumber(insight?.cpc),
      cpm: parseNumber(insight?.cpm),
    };
  });
};
