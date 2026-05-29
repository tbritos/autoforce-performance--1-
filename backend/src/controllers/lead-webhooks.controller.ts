import { Request, Response, NextFunction } from 'express';
import { LeadWebhooksService } from '../services/lead-webhooks.service';

export class LeadWebhooksController {
  static async listSources(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await LeadWebhooksService.listSources());
    } catch (error) {
      next(error);
    }
  }

  static async createSource(req: Request, res: Response, next: NextFunction) {
    try {
      const source = await LeadWebhooksService.createSource(req.body);
      res.status(201).json(source);
    } catch (error) {
      next(error);
    }
  }

  static async updateSource(req: Request, res: Response, next: NextFunction) {
    try {
      const source = await LeadWebhooksService.updateSource(req.params.id, req.body);
      res.json(source);
    } catch (error) {
      next(error);
    }
  }

  static async deleteSource(req: Request, res: Response, next: NextFunction) {
    try {
      await LeadWebhooksService.deleteSource(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async regenerateUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const source = await LeadWebhooksService.regenerateUrl(req.params.id);
      res.json(source);
    } catch (error) {
      next(error);
    }
  }

  static async listLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50;
      res.json(await LeadWebhooksService.listLogs(req.params.id, limit));
    } catch (error) {
      next(error);
    }
  }

  static async inspectSource(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await LeadWebhooksService.inspectSource(req.params.id));
    } catch (error) {
      next(error);
    }
  }

  static async ingest(req: Request, res: Response) {
    try {
      const result = await LeadWebhooksService.ingest(req.params.publicId, req.body);
      res.status(202).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.includes('nao encontrado') ? 404 : message.includes('inativo') ? 403 : 400;
      res.status(status).json({ ok: false, error: message });
    }
  }
}
