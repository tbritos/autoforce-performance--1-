import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { getGA4SourceTotals, syncLandingPagesFromGA4 } from '../services/googleAnalytics.service';
import { getClarityMetrics, testClarityConnection } from '../services/clarity.service';

export const getLandingPages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Pega as datas que o Frontend mandou
    const { startDate, endDate, hostName, source } = req.query;

    // CHAMA A FUNÇÃO DE SINCRONIZAR (SALVAR)
    // Passamos as datas para ele buscar o período correto no Google e salvar no banco
    const pages = await AnalyticsService.getLandingPages(
      startDate as string,
      endDate as string,
      hostName as string,
      source as string
    );
    
    res.json(pages);
  } catch (error) {
    console.error('Error fetching landing pages:', error);
    next(error);
  }
};

export const getGA4Totals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, source } = req.query;
    const totals = await getGA4SourceTotals(
      startDate as string,
      endDate as string,
      source as string
    );
    res.json(totals);
  } catch (error) {
    console.error('Error fetching GA4 totals:', error);
    next(error);
  }
};

export const syncGA4 = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, hostName, source } = req.query;
    const pages = await syncLandingPagesFromGA4(
      startDate as string,
      endDate as string,
      hostName as string,
      source as string
    );
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


export const getClarityData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await getClarityMetrics(startDate as string, endDate as string);
    res.json(data);
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
};

export const testClarity = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const ok = await testClarityConnection();
    res.json({ connected: ok });
  } catch (err: any) {
    res.status(503).json({ connected: false, error: err.message });
  }
};
