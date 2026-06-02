import { google } from 'googleapis';
import { LandingPage } from '../types/dashboard.types'; 

function parsePropertyIds(value?: string | null): string[] {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseHostNames(value?: string | null): string[] {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function normalizeHostFilter(hostName?: string): string | undefined {
  const value = hostName?.trim();
  if (!value || value === '*') return undefined;
  return value;
}

export type GA4SourceType = 'all' | 'lp' | 'site' | 'blog';

type GA4SourceConfig = {
  source: Exclude<GA4SourceType, 'all'>;
  label: string;
  propertyIds: string[];
  hostNames: string[];
};

function getStringMetadata(meta: Record<string, any> | null | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = meta?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeSource(value?: string | null): GA4SourceType {
  if (value === 'lp' || value === 'site' || value === 'blog') return value;
  return 'all';
}

async function getGA4PropertyIds(): Promise<string[]> {
  const { PlatformConnectionService } = await import('./platform-connection.service');
  const conn = await PlatformConnectionService.getInternalConnection('GOOGLE_ANALYTICS');
  const meta = conn?.metadata as Record<string, any> | null;
  const fromMetadata = parsePropertyIds(
    (meta?.propertyIds as string | undefined) ||
    (meta?.propertyId as string | undefined)
  );
  const fromEnv = parsePropertyIds(process.env.GA4_PROPERTY_IDS || process.env.GA4_PROPERTY_ID);
  const ids = Array.from(new Set([...fromMetadata, ...fromEnv]));
  if (!ids.length) throw new Error('GA4_PROPERTY_IDS nao configurado');
  return ids;
}

async function getGA4SourceConfigs(source?: string | null, hostName?: string | null): Promise<GA4SourceConfig[]> {
  const { PlatformConnectionService } = await import('./platform-connection.service');
  const conn = await PlatformConnectionService.getInternalConnection('GOOGLE_ANALYTICS');
  const meta = conn?.metadata as Record<string, any> | null;
  const requestedSource = normalizeSource(source);

  const configuredSources = Array.isArray(meta?.sources)
    ? (meta.sources as any[])
        .map((item): GA4SourceConfig | null => {
          const parsedSource = normalizeSource(item?.source || item?.type);
          if (parsedSource === 'all') return null;
          return {
            source: parsedSource,
            label: String(item?.label || item?.name || item?.source || ''),
            propertyIds: Array.isArray(item?.propertyIds)
              ? item.propertyIds.map((id: unknown) => String(id).trim()).filter(Boolean)
              : parsePropertyIds(item?.propertyIds || item?.propertyId),
            hostNames: Array.isArray(item?.hostNames)
              ? item.hostNames.map((host: unknown) => String(host).trim()).filter(Boolean)
              : parseHostNames(item?.hostName || item?.hosts),
          };
        })
        .filter((item): item is GA4SourceConfig => Boolean(item?.propertyIds.length && item.hostNames.length > 0))
    : [];

  const defaultCandidates: GA4SourceConfig[] = [
    {
      source: 'lp',
      label: 'Landing pages',
      propertyIds: parsePropertyIds(
        getStringMetadata(meta, ['lpPropertyIds', 'landingPagesPropertyIds', 'lpPropertyId', 'landingPagesPropertyId']) ||
        process.env.GA4_LP_PROPERTY_IDS ||
        process.env.GA4_LP_PROPERTY_ID ||
        '484560591'
      ),
      hostNames: parseHostNames(getStringMetadata(meta, ['lpHostNames', 'lpHostName']) || process.env.GA4_LP_HOSTNAMES || process.env.LP_HOSTNAME || '*'),
    },
    {
      source: 'site',
      label: 'Site',
      propertyIds: parsePropertyIds(getStringMetadata(meta, ['sitePropertyIds', 'sitePropertyId']) || process.env.GA4_SITE_PROPERTY_IDS || process.env.GA4_SITE_PROPERTY_ID || '484560591'),
      hostNames: parseHostNames(getStringMetadata(meta, ['siteHostNames', 'siteHostName']) || process.env.GA4_SITE_HOSTNAMES || '*'),
    },
    {
      source: 'blog',
      label: 'Blog',
      propertyIds: parsePropertyIds(getStringMetadata(meta, ['blogPropertyIds', 'blogPropertyId']) || process.env.GA4_BLOG_PROPERTY_IDS || process.env.GA4_BLOG_PROPERTY_ID || '349265313'),
      hostNames: parseHostNames(getStringMetadata(meta, ['blogHostNames', 'blogHostName']) || process.env.GA4_BLOG_HOSTNAMES || '*'),
    },
  ];
  const defaults = defaultCandidates.filter(item => item.propertyIds.length > 0 && item.hostNames.length > 0);

  const bySource = new Map<Exclude<GA4SourceType, 'all'>, GA4SourceConfig>();
  for (const item of [...defaults, ...configuredSources]) {
    bySource.set(item.source, item);
  }

  let configs = Array.from(bySource.values());

  if (requestedSource !== 'all') {
    configs = configs.filter(item => item.source === requestedSource);
  }

  const requestedHosts = parseHostNames(hostName);
  if (requestedHosts.length) {
    configs = configs
      .map(item => {
        const allowsAnyHost = item.hostNames.includes('*');
        return {
          ...item,
          hostNames: allowsAnyHost
            ? requestedHosts
            : item.hostNames.filter(host => requestedHosts.includes(host)),
        };
      })
      .filter(item => item.hostNames.length > 0);
  }

  if (!configs.length && requestedHosts.length) {
    const propertyIds = await getGA4PropertyIds();
    configs = propertyIds.map((propertyId, index) => ({
      source: 'lp',
      label: `GA4 ${index + 1}`,
      propertyIds: [propertyId],
      hostNames: requestedHosts.length ? requestedHosts : ['*'],
    }));
  }

  if (!configs.length) {
    throw new Error('Nenhuma fonte GA4 configurada para o filtro selecionado');
  }

  return configs;
}

export async function initializeGA4Client(): Promise<any> {
  let auth: any;

  // Try PlatformConnection OAuth token first
  try {
    const { OAuthService } = await import('./oauth.service');
    const token = await OAuthService.getValidToken('GOOGLE_ANALYTICS');
    auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
  } catch {
    // Fallback to service account credentials from .env
    const credentialsPath = process.env.GA4_CREDENTIALS_PATH;
    const credentialsJson = process.env.GA4_CREDENTIALS_JSON;

    if (!credentialsPath && !credentialsJson) {
      throw new Error('Google Analytics não conectado. Configure no painel de Conexões.');
    }

    if (credentialsJson) {
      const parsed = JSON.parse(credentialsJson);
      auth = new google.auth.GoogleAuth({
        credentials: parsed,
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      });
    } else {
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      });
    }
  }

  return google.analyticsdata({ version: 'v1beta', auth });
}

export async function getLandingPagesFromGA4(
  startDate?: string,
  endDate?: string,
  hostName?: string,
  propertyId?: string,
  source?: GA4SourceType
): Promise<LandingPage[]> {
  const resolvedPropertyId = propertyId || (await getGA4PropertyIds())[0];
  if (!resolvedPropertyId) throw new Error('GA4_PROPERTY_IDS nao configurado');

  try {
    const client = await initializeGA4Client();
    const lpHost = hostName?.trim();

    let start = startDate;
    let end = endDate;

    if (!start || !end) {
        const today = new Date();
        const past = new Date();
        past.setDate(today.getDate() - 30);
        end = today.toISOString().split('T')[0];
        start = past.toISOString().split('T')[0];
    }

    console.log(`🔍 Buscando GA4 de ${start} até ${end} (${lpHost})...`);

    const response = await client.properties.runReport({
      property: `properties/${resolvedPropertyId}`,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [
          { name: 'hostName' },
          { name: 'pagePath' },
          { name: 'pageTitle' },
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'conversions' },
          // AQUI ESTAVA O ERRO: Mudamos de volta para 'averageSessionDuration'
          { name: 'averageSessionDuration' }, 
          { name: 'bounceRate' },       
          { name: 'eventCount' }        
        ],
        dimensionFilter: lpHost
          ? {
              filter: {
                fieldName: 'hostName',
                stringFilter: {
                  matchType: 'EXACT',
                  value: lpHost,
                },
              },
            }
          : undefined,
        orderBys: [
          { metric: { metricName: 'activeUsers' }, desc: true },
          { metric: { metricName: 'eventCount' }, desc: true }
        ],
        limit: 200, 
      },
    });

    const rows = response.data.rows || [];
    
    return rows.map((row: any) => {
      const dimensions = row.dimensionValues || [];
      const metrics = row.metricValues || [];

      const pageHost = dimensions[0]?.value || lpHost || '';
      const pagePath = dimensions[1]?.value || '';
      const displayPath = pageHost ? `${pageHost}${pagePath || '/'}` : pagePath;
      const pageTitle = dimensions[2]?.value || 'Sem título';

      const views = parseInt(metrics[0]?.value || '0', 10);
      const users = parseInt(metrics[1]?.value || '0', 10);
      const conversions = parseInt(metrics[2]?.value || '0', 10);
      const avgDuration = parseFloat(metrics[3]?.value || '0'); // Agora pega a duração da sessão
      const bounceRateVal = parseFloat(metrics[4]?.value || '0');
      const eventCount = parseInt(metrics[5]?.value || '0', 10);

      const conversionRate = users > 0 ? (conversions / users) * 100 : 0;
      
      const minutes = Math.floor(avgDuration / 60);
      const seconds = Math.floor(avgDuration % 60);
      const avgEngagementTime = `${minutes}m ${seconds}s`;

      const bounceRate = Number((bounceRateVal * 100).toFixed(1));
      const uniqueId = Buffer.from(displayPath).toString('base64');

      return {
        id: uniqueId,
        name: pageTitle,
        path: displayPath,
        views,
        users,
        conversions,
        conversionRate: Number(conversionRate.toFixed(2)),
        avgEngagementTime,
        bounceRate,        
        totalClicks: eventCount,
        source: source && source !== 'all' ? `google_analytics:${source}` : 'google_analytics',
        dataOrigin: 'ga4_live',
        lastSyncAt: new Date().toISOString(),
      };
    });
  } catch (error: any) {
    console.error('Erro GA4:', error.message);
    throw new Error(`Erro GA4: ${error.message}`);
  }
}

export async function getGA4SourceTotals(
  startDate?: string,
  endDate?: string,
  source?: string
): Promise<{ views: number; users: number; pages: number; errors: string[] }> {
  const configs = await getGA4SourceConfigs(source, undefined);
  const client = await initializeGA4Client();

  let start = startDate;
  let end = endDate;
  if (!start || !end) {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - 30);
    end = today.toISOString().split('T')[0];
    start = past.toISOString().split('T')[0];
  }

  const propertyIds = Array.from(new Set(configs.flatMap(config => config.propertyIds)));
  const jobs = propertyIds.map(async propertyId => {
      const response = await client.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate: start, endDate: end }],
          metrics: [
            { name: 'screenPageViews' },
            { name: 'activeUsers' },
          ],
        },
      });

      const metrics = response.data.rows?.[0]?.metricValues || [];
      return {
        views: parseInt(metrics[0]?.value || '0', 10),
        users: parseInt(metrics[1]?.value || '0', 10),
        pages: 0,
      };
    });

  const results = await Promise.allSettled(jobs);
  const totals = results.reduce(
    (acc, result) => {
      if (result.status === 'fulfilled') {
        acc.views += result.value.views;
        acc.users += result.value.users;
        acc.pages += result.value.pages;
      } else {
        acc.errors.push(result.reason?.message || String(result.reason));
      }
      return acc;
    },
    { views: 0, users: 0, pages: 0, errors: [] as string[] }
  );

  return totals;
}

function mergeLandingPages(pages: LandingPage[]): LandingPage[] {
  const map = new Map<string, LandingPage>();

  for (const page of pages) {
    const current = map.get(page.path);
    if (!current) {
      map.set(page.path, { ...page });
      continue;
    }

    const users = current.users + page.users;
    const conversions = current.conversions + page.conversions;
    current.views += page.views;
    current.users = users;
    current.conversions = conversions;
    current.totalClicks += page.totalClicks;
    current.conversionRate = users > 0 ? Number(((conversions / users) * 100).toFixed(2)) : 0;
  }

  return Array.from(map.values()).sort((a, b) => b.users - a.users);
}

export async function getLandingPagesFromAllGA4Properties(
  startDate?: string,
  endDate?: string,
  hostName?: string,
  source?: string
): Promise<LandingPage[]> {
  const sourceType = normalizeSource(source);
  const configs = await getGA4SourceConfigs(source, hostName);
  const jobs = configs.flatMap(config =>
    config.propertyIds.flatMap(propertyId =>
      config.hostNames.map(host =>
        getLandingPagesFromGA4(startDate, endDate, normalizeHostFilter(host), propertyId, config.source)
      )
    )
  );

  const results = await Promise.allSettled(jobs);
  const pages = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map(result => result.reason?.message || String(result.reason));

  if (errors.length) {
    console.error('Erros parciais GA4:', errors);
  }

  if (!pages.length && errors.length) {
    throw new Error(sourceType === 'all'
      ? `Nenhuma fonte GA4 respondeu: ${errors.join(' | ')}`
      : `Fonte GA4 ${sourceType} falhou: ${errors.join(' | ')}`
    );
  }

  return mergeLandingPages(pages);
}

export async function syncLandingPagesFromGA4(
  startDate?: string,
  endDate?: string,
  hostName?: string,
  source?: string
) {
  try {
    const pages = await getLandingPagesFromAllGA4Properties(startDate, endDate, hostName, source);
    
    const { prisma } = await import('../config/database');

    console.log(`💾 Salvando ${pages.length} páginas no banco...`);

    for (const page of pages) {
      await prisma.landingPage.upsert({
        where: { path: page.path },
        update: {
          name: page.name,
          views: page.views,
          users: page.users,
          conversions: page.conversions,
          conversionRate: page.conversionRate,
          avgEngagementTime: page.avgEngagementTime,
          bounceRate: page.bounceRate,      
          totalClicks: page.totalClicks,    
          source: page.source,
          lastSyncAt: new Date(),
          updatedAt: new Date()
        },
        create: {
          id: page.id,
          name: page.name,
          path: page.path,
          views: page.views,
          users: page.users,
          conversions: page.conversions,
          conversionRate: page.conversionRate,
          avgEngagementTime: page.avgEngagementTime,
          bounceRate: page.bounceRate,      
          totalClicks: page.totalClicks,    
          source: page.source,
          lastSyncAt: new Date(),
        },
      });
    }

    console.log(`✅ Sincronização concluída!`);
    return pages;
  } catch (error) {
    console.error('Erro ao sincronizar landing pages:', error);
    throw error;
  }
}
