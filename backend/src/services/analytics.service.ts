import { prisma } from '../config/database';
import { LandingPage } from '../../../types';
import { syncLandingPagesFromGA4, getLandingPagesFromGA4 } from './googleAnalytics.service';

export class AnalyticsService {
  /**
   * Busca landing pages do Google Analytics 4 e sincroniza com o banco
   */
  static async getLandingPages(): Promise<LandingPage[]> {
    const useGA4 = !!process.env.GA4_PROPERTY_ID && !!process.env.GA4_CREDENTIALS_PATH;

    if (useGA4) {
      try {
        // Buscar dados do GA4 e sincronizar com banco
        await syncLandingPagesFromGA4();
        
        // Retornar do banco (já sincronizado)
        const pages = await prisma.landingPage.findMany({
          orderBy: { conversionRate: 'desc' },
        });

        return pages.map(page => ({
          id: page.id,
          name: page.name,
          path: page.path,
          views: page.views,
          users: page.users,
          conversions: page.conversions,
          conversionRate: page.conversionRate,
          avgEngagementTime: page.avgEngagementTime,
          source: page.source as LandingPage['source'],
        }));
      } catch (error: any) {
        console.error('Erro ao buscar do GA4, usando dados do banco:', error.message);
        // Se falhar, retorna dados do banco (pode estar vazio)
      }
    }

    // Se GA4 não configurado ou erro, retorna do banco
    const pages = await prisma.landingPage.findMany({
      orderBy: { conversionRate: 'desc' },
    });

    return pages.map(page => ({
      id: page.id,
      name: page.name,
      path: page.path,
      views: page.views,
      users: page.users,
      conversions: page.conversions,
      conversionRate: page.conversionRate,
      avgEngagementTime: page.avgEngagementTime,
      source: page.source as LandingPage['source'],
    }));
  }

  /**
   * Força sincronização com GA4 (endpoint manual)
   */
  static async syncWithGA4(): Promise<LandingPage[]> {
    if (!process.env.GA4_PROPERTY_ID || !process.env.GA4_CREDENTIALS_PATH) {
      throw new Error('Google Analytics 4 não está configurado. Configure GA4_PROPERTY_ID e GA4_CREDENTIALS_PATH no .env');
    }

    return await syncLandingPagesFromGA4();
  }
}
