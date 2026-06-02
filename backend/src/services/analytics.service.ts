import { prisma } from '../config/database';
import { LandingPage } from '../types/dashboard.types';
import { syncLandingPagesFromGA4 } from './googleAnalytics.service';
import { PlatformConnectionService } from './platform-connection.service';

export class AnalyticsService {
  private static async canUseGA4(): Promise<boolean> {
    if (process.env.GA4_PROPERTY_IDS || process.env.GA4_PROPERTY_ID) return true;

    const conn = await PlatformConnectionService.getInternalConnection('GOOGLE_ANALYTICS');
    const meta = conn?.metadata as Record<string, any> | null;

    return Boolean(
      conn?.accessToken ||
      meta?.propertyId ||
      meta?.propertyIds ||
      meta?.sources ||
      meta?.lpPropertyId ||
      meta?.sitePropertyId ||
      meta?.blogPropertyId
    );
  }

  /**
   * Busca paginas do Google Analytics 4 e sincroniza com o banco.
   */
  static async getLandingPages(
    startDate?: string,
    endDate?: string,
    hostName?: string,
    source?: string
  ): Promise<LandingPage[]> {
    if (await this.canUseGA4()) {
      try {
        return await syncLandingPagesFromGA4(startDate, endDate, hostName, source);
      } catch (error: any) {
        console.error('Erro ao buscar do GA4:', error.message);
        throw error;
      }
    }

    const pages = await prisma.landingPage.findMany({
      where: hostName ? { path: { startsWith: hostName } } : undefined,
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
      bounceRate: page.bounceRate,
      totalClicks: page.totalClicks,
      source: page.source as LandingPage['source'],
    }));
  }

  /**
   * Forca sincronizacao manual com GA4.
   */
  static async syncWithGA4(): Promise<LandingPage[]> {
    if (!(await this.canUseGA4())) {
      throw new Error('Google Analytics 4 nao esta configurado. Configure as propriedades no .env ou na tela de Integracoes.');
    }

    return syncLandingPagesFromGA4();
  }
}
