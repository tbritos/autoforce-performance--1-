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
  propertyId?: string
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
        source: 'google_analytics',
      };
    });
  } catch (error: any) {
    console.error('Erro GA4:', error.message);
    throw new Error(`Erro GA4: ${error.message}`);
  }
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
  hostName?: string
): Promise<LandingPage[]> {
  const propertyIds = await getGA4PropertyIds();
  const hostNames = parseHostNames(
    hostName ||
    process.env.LP_HOSTNAMES ||
    process.env.LP_HOSTNAME ||
    'lp.autodromo.com.br,site.autoforce.com,blog.autoforce.com'
  );
  const pagesByProperty = await Promise.all(
    propertyIds.flatMap(id =>
      hostNames.length
        ? hostNames.map(host => getLandingPagesFromGA4(startDate, endDate, host, id))
        : [getLandingPagesFromGA4(startDate, endDate, undefined, id)]
    )
  );
  return mergeLandingPages(pagesByProperty.flat());
}

export async function syncLandingPagesFromGA4(
  startDate?: string,
  endDate?: string,
  hostName?: string
) {
  try {
    const pages = await getLandingPagesFromAllGA4Properties(startDate, endDate, hostName);
    
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
