import { google } from 'googleapis';
import { LandingPage } from '../types/dashboard.types'; 

let analyticsDataClient: any = null;

export async function initializeGA4Client() {
  if (analyticsDataClient) return analyticsDataClient;

  const credentialsPath = process.env.GA4_CREDENTIALS_PATH;
  const propertyId = process.env.GA4_PROPERTY_ID;

  if (!credentialsPath || !propertyId) {
    throw new Error('GA4_CREDENTIALS_PATH e GA4_PROPERTY_ID devem estar configurados no .env');
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });

  analyticsDataClient = google.analyticsdata({ version: 'v1beta', auth });
  return analyticsDataClient;
}

export async function getLandingPagesFromGA4(startDate?: string, endDate?: string): Promise<LandingPage[]> {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) throw new Error('GA4_PROPERTY_ID não configurado');

  try {
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

    console.log(`🔍 Buscando GA4 de ${start} até ${end}...`);

    const response = await client.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [
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
        orderBys: [
          { metric: { metricName: 'conversions' }, desc: true },
          { metric: { metricName: 'screenPageViews' }, desc: true }
        ],
        limit: 200, 
      },
    });

    const rows = response.data.rows || [];
    
    return rows.map((row: any) => {
      const dimensions = row.dimensionValues || [];
      const metrics = row.metricValues || [];

      const pagePath = dimensions[0]?.value || '';
      const pageTitle = dimensions[1]?.value || 'Sem título';

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
      const uniqueId = Buffer.from(pagePath).toString('base64');

      return {
        id: uniqueId,
        name: pageTitle,
        path: pagePath,
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

export async function syncLandingPagesFromGA4(startDate?: string, endDate?: string) {
  try {
    const pages = await getLandingPagesFromGA4(startDate, endDate);
    
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