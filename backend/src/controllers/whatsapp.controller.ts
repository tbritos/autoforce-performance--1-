import { Request, Response, NextFunction } from 'express';
import { fetchWhatsAppTemplates, fetchWhatsAppPhoneNumbers } from '../services/whatsapp.service';

export class WhatsAppController {
  static async getTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const phoneNumberId = req.query.phoneNumberId as string | undefined;
      res.json(await fetchWhatsAppTemplates(phoneNumberId));
    } catch (err) {
      next(err);
    }
  }

  static async getPhoneNumbers(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await fetchWhatsAppPhoneNumbers());
    } catch (err) {
      next(err);
    }
  }
}
