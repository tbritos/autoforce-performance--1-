import { Request, Response, NextFunction } from 'express';
import {
  fetchWhatsAppTemplates,
  fetchWhatsAppPhoneNumbers,
  handleWhatsAppWebhook,
  listWhatsAppConversationByLead,
  sendWhatsAppTextFromUI,
  sendWhatsAppTemplateFromUI,
  setLeadAiHandoff,
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
  type CreateTemplateInput,
} from '../services/whatsapp.service';
import { prisma } from '../config/database';

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

  static async getMeetingSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const { getAvailableSlots } = await import('../services/meeting-scheduler.service');
      const limit = Number.parseInt(String(req.query.limit ?? '6'), 10);
      res.json(await getAvailableSlots(Number.isFinite(limit) ? limit : 6));
    } catch (err) {
      next(err);
    }
  }

  static async syncMeetingBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const { syncAppointmentScheduleBookings } = await import('../services/meeting-scheduler.service');
      res.json(await syncAppointmentScheduleBookings());
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

  static async sendTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateName, bodyParams } = req.body as { templateName?: string; bodyParams?: string[] };
      if (!templateName?.trim()) {
        res.status(400).json({ error: 'templateName é obrigatório' });
        return;
      }
      await sendWhatsAppTemplateFromUI(req.params.leadId, templateName.trim(), bodyParams ?? []);
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

  static async triggerAiReply(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: req.params.leadId },
        select: { email: true, phone: true, aiHandoff: true },
      });

      if (!lead) {
        res.status(404).json({ error: 'Lead nao encontrado' });
        return;
      }

      if (!lead.phone?.trim()) {
        res.status(400).json({ error: 'Lead sem telefone para WhatsApp' });
        return;
      }

      if (lead.aiHandoff) {
        res.status(409).json({ error: 'Lead esta em atendimento humano. Ative a IA antes de forcar resposta.' });
        return;
      }

      await prisma.lead.update({
        where: { email: lead.email },
        data: { aiProcessing: false, aiProcessingAt: null },
      });

      const { triggerAIReplyNow } = await import('../services/ai-whatsapp-reply.service');
      await triggerAIReplyNow(lead.phone);

      res.json({ ok: true });
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
