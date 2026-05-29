import { Request, Response, NextFunction } from 'express';
import { FunnelService } from '../services/funnel.service';

export class FunnelController {

  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await FunnelService.list());
    } catch (err) { next(err); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.body as { name?: string };
      if (!name?.trim()) {
        res.status(400).json({ error: 'name é obrigatório' });
        return;
      }
      res.status(201).json(await FunnelService.create(req.body));
    } catch (err) { next(err); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await FunnelService.update(req.params.id, req.body));
    } catch (err) { next(err); }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await FunnelService.remove(req.params.id);
      res.status(204).end();
    } catch (err) { next(err); }
  }

  // GET /api/funnels/stats?funnelId=X  (omit for unified)
  static async stats(req: Request, res: Response, next: NextFunction) {
    try {
      const funnelId  = (req.query.funnelId  as string) || null;
      const startDate = (req.query.startDate as string) || undefined;
      const endDate   = (req.query.endDate   as string) || undefined;
      res.json(await FunnelService.getStats(funnelId, startDate, endDate));
    } catch (err) { next(err); }
  }
}
