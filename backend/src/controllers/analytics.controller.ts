import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { syncLandingPagesFromGA4 } from '../services/googleAnalytics.service'; 

export const getLandingPages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Pega as datas que o Frontend mandou
    const { startDate, endDate, hostName } = req.query;

    // CHAMA A FUNÇÃO DE SINCRONIZAR (SALVAR)
    // Passamos as datas para ele buscar o período correto no Google e salvar no banco
    const pages = await AnalyticsService.getLandingPages(
      startDate as string,
      endDate as string,
      hostName as string
    );
    
    res.json(pages);
  } catch (error) {
    console.error('Error fetching landing pages:', error);
    next(error);
  }
};

export const syncGA4 = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pages = await syncLandingPagesFromGA4();
    res.json({ 
      message: 'Sincronização com Google Analytics concluída',
      pages: pages.length 
    });
  } catch (error: any) {
    console.error('Error syncing with GA4:', error);
    res.status(500).json({ 
      error: 'Erro ao sincronizar com Google Analytics',
      message: error.message 
    });
  }
};
