import { Request, Response, NextFunction } from 'express';
import { fetchWhatsAppTemplates } from '../services/whatsapp.service';

export class WhatsAppController {
  static async getTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await fetchWhatsAppTemplates();
      res.json(templates);
    } catch (err) {
      next(err);
    }
  }
}
