import { Request, Response, NextFunction } from 'express';
import { UTMDestinationsService } from '../services/utm-destinations.service';

export class UTMDestinationsController {

  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const destinations = await UTMDestinationsService.list('');
      res.json(destinations);
    } catch (err) { next(err); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { label, url } = req.body as { label?: string; url?: string };
      if (!label?.trim()) { res.status(400).json({ error: 'label é obrigatório' }); return; }
      if (!url?.trim())   { res.status(400).json({ error: 'url é obrigatória' }); return; }
      try { new URL(url.trim()); } catch { res.status(400).json({ error: 'URL inválida' }); return; }
      const createdBy = (req as any).user?.email ?? 'system';
      const dest = await UTMDestinationsService.create({ label: label.trim(), url: url.trim(), createdBy });
      res.status(201).json(dest);
    } catch (err) { next(err); }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await UTMDestinationsService.delete(req.params.id);
      res.status(204).end();
    } catch (err) { next(err); }
  }
}
