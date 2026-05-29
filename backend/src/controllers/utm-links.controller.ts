import { Request, Response, NextFunction } from 'express';
import { UTMLinksService } from '../services/utm-links.service';

export class UTMLinksController {

  // GET /api/utm-links
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await UTMLinksService.list({
        search:      typeof req.query.search      === 'string' ? req.query.search      : undefined,
        utmSource:   typeof req.query.utmSource   === 'string' ? req.query.utmSource   : undefined,
        utmMedium:   typeof req.query.utmMedium   === 'string' ? req.query.utmMedium   : undefined,
        utmCampaign: typeof req.query.utmCampaign === 'string' ? req.query.utmCampaign : undefined,
        createdBy:   typeof req.query.createdBy   === 'string' ? req.query.createdBy   : undefined,
        isTemplate:  req.query.isTemplate === 'true' ? true : req.query.isTemplate === 'false' ? false : undefined,
        startDate:   typeof req.query.startDate   === 'string' ? req.query.startDate   : undefined,
        endDate:     typeof req.query.endDate      === 'string' ? req.query.endDate     : undefined,
        page:        req.query.page     ? Number(req.query.page)     : 1,
        pageSize:    req.query.pageSize ? Number(req.query.pageSize) : 25,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // GET /api/utm-links/templates
  static async templates(_req: Request, res: Response, next: NextFunction) {
    try {
      const list = await UTMLinksService.listTemplates();
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  // GET /api/utm-links/campaigns
  static async campaigns(_req: Request, res: Response, next: NextFunction) {
    try {
      const list = await UTMLinksService.listCampaignsForPicker();
      res.json(list);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/utm-links
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as Record<string, unknown>;
      const { destinationUrl, utmSource, utmMedium, utmCampaign } = body;

      if (!destinationUrl || typeof destinationUrl !== 'string') {
        res.status(400).json({ error: 'destinationUrl é obrigatório' }); return;
      }
      if (!utmSource || typeof utmSource !== 'string') {
        res.status(400).json({ error: 'utmSource é obrigatório' }); return;
      }
      if (!utmMedium || typeof utmMedium !== 'string') {
        res.status(400).json({ error: 'utmMedium é obrigatório' }); return;
      }
      if (!utmCampaign || typeof utmCampaign !== 'string') {
        res.status(400).json({ error: 'utmCampaign é obrigatório' }); return;
      }

      const createdBy = (req as Request & { user?: { email: string } }).user?.email ?? 'system';

      const link = await UTMLinksService.create({
        createdBy,
        title:          typeof body.title          === 'string' ? body.title          : undefined,
        destinationUrl,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent:     typeof body.utmContent     === 'string' ? body.utmContent     : undefined,
        utmTerm:        typeof body.utmTerm        === 'string' ? body.utmTerm        : undefined,
        campaignId:     typeof body.campaignId     === 'string' ? body.campaignId     : undefined,
        isTemplate:     typeof body.isTemplate     === 'boolean' ? body.isTemplate    : false,
        templateName:   typeof body.templateName   === 'string' ? body.templateName   : undefined,
      });

      res.status(201).json(link);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/utm-links/:id/favorite
  static async toggleFavorite(req: Request, res: Response, next: NextFunction) {
    try {
      const link = await UTMLinksService.toggleFavorite(req.params.id);
      res.json({ isFavorite: link.isFavorite });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/utm-links/:id
  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await UTMLinksService.softDelete(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
}
