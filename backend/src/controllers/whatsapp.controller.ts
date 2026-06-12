import { Request, Response, NextFunction } from 'express';
import {
  fetchWhatsAppTemplates,
  fetchWhatsAppPhoneNumbers,
  handleWhatsAppWebhook,
  listWhatsAppConversationByLead,
  sendWhatsAppTextFromUI,
  setLeadAiHandoff,
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
  type CreateTemplateInput,
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

  static async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { text } = req.body as { text?: string };
      if (!text?.trim()) {
        res.status(400).json({ error: 'Mensagem não pode ser vazia' });
        return;
      }
      await sendWhatsAppTextFromUI(req.params.leadId, text.trim());
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }

  static async updateHandoff(req: Request, res: Response, next: NextFunction) {
    try {
      const { handoff } = req.body as { handoff?: boolean };
      if (typeof handoff !== 'boolean') {
        res.status(400).json({ error: 'Campo handoff (boolean) obrigatório' });
        return;
      }
      await setLeadAiHandoff(req.params.leadId, handoff);
      res.json({ ok: true, aiHandoff: handoff });
    } catch (err) {
      next(err);
    }
  }

  static async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, category, language, headerText, bodyText, footerText } = req.body as Partial<CreateTemplateInput>;
      if (!name?.trim())     { res.status(400).json({ error: 'Nome é obrigatório' }); return; }
      if (!bodyText?.trim()) { res.status(400).json({ error: 'Body é obrigatório' }); return; }
      if (!category)         { res.status(400).json({ error: 'Categoria é obrigatória' }); return; }

      const safeName = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const result = await createWhatsAppTemplate({ name: safeName, category, language: language ?? 'pt_BR', headerText, bodyText, footerText });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async deleteTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateName } = req.params;
      if (!templateName) { res.status(400).json({ error: 'Nome do template obrigatório' }); return; }
      await deleteWhatsAppTemplate(decodeURIComponent(templateName));
      res.json({ ok: true });
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
