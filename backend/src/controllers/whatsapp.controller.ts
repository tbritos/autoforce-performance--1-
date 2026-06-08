import { Request, Response, NextFunction } from 'express';
import {
  fetchWhatsAppTemplates,
  fetchWhatsAppPhoneNumbers,
  handleWhatsAppWebhook,
  listWhatsAppConversationByLead,
} from '../services/whatsapp.service';

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

  static async getConversation(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await listWhatsAppConversationByLead(req.params.leadId));
    } catch (err) {
      next(err);
    }
  }

  static verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

    if (mode === 'subscribe' && expected && token === expected) {
      res.status(200).send(String(challenge ?? ''));
      return;
    }

    res.status(403).json({ error: 'Invalid WhatsApp webhook verification token' });
  }

  static async receiveWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await handleWhatsAppWebhook(req.body);
      res.status(200).json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}
