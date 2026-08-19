import { Request, Response, NextFunction } from 'express';
import {
  fetchWhatsAppTemplates,
  fetchWhatsAppPhoneNumbers,
  handleWhatsAppWebhook,
  listWhatsAppConversationByLead,
  fetchWhatsAppMedia,
  uploadWhatsAppMedia,
  sendWhatsAppTextFromUI,
  sendWhatsAppTemplateFromUI,
  setLeadAiHandoff,
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
  listRegisteredWhatsAppNumbers,
  registerWhatsAppNumber,
  type CreateTemplateInput,
} from '../services/whatsapp.service';
import { prisma } from '../config/database';

// Erros vindos da Graph API da Meta (template duplicado, permissão faltando,
// número inválido, etc.) são erros esperados/corrigíveis pelo usuário, não
// falhas internas — respondidos direto com a mensagem real em vez de cair no
// error handler global, que em produção mascara todo 500 como "Internal
// Server Error" e escondia a causa.
function respondWithMetaError(res: Response, err: unknown) {
  res.status(400).json({ error: err instanceof Error ? err.message : 'Erro desconhecido ao falar com a Meta' });
}

export class WhatsAppController {
  static async getNumberHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const { getWhatsAppNumberHealth } = await import('../services/whatsapp-number-health.service');
      const phoneNumberId = typeof req.query.phoneNumberId === 'string' ? req.query.phoneNumberId.trim() : undefined;
      const days = Number.parseInt(String(req.query.days ?? '30'), 10);
      res.json(await getWhatsAppNumberHealth({ phoneNumberId: phoneNumberId || undefined, days }));
    } catch (err) {
      next(err);
    }
  }

  static async getTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const phoneNumberId = req.query.phoneNumberId as string | undefined;
      res.json(await fetchWhatsAppTemplates(phoneNumberId));
    } catch (err) {
      respondWithMetaError(res, err);
    }
  }

  static async getPhoneNumbers(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await fetchWhatsAppPhoneNumbers());
    } catch (err) {
      respondWithMetaError(res, err);
    }
  }

  // Junta a lista viva de numeros da Meta (WABA principal, e outras se
  // WHATSAPP_BUSINESS_ACCOUNT_IDS estiver configurada) com os rotulos ja
  // cadastrados no nosso diretorio (WhatsAppNumber) — inclusive numeros
  // cadastrados que estao numa WABA nao coberta pela listagem automatica
  // (nesse caso o numero ainda aparece, usando os dados salvos no cadastro).
  static async getNumbers(req: Request, res: Response, next: NextFunction) {
    try {
      const [live, registered] = await Promise.all([
        fetchWhatsAppPhoneNumbers().catch(() => [] as Awaited<ReturnType<typeof fetchWhatsAppPhoneNumbers>>),
        listRegisteredWhatsAppNumbers(),
      ]);
      const byPhoneNumberId = new Map(registered.map(r => [r.phoneNumberId, r]));

      const fromLive = live.map(n => ({
        id: n.id,
        display_phone_number: n.display_phone_number,
        verified_name: n.verified_name,
        quality_rating: n.quality_rating,
        label: byPhoneNumberId.get(n.id)?.label ?? null,
        isRegistered: byPhoneNumberId.has(n.id),
      }));

      const liveIds = new Set(live.map(n => n.id));
      const onlyRegistered = registered
        .filter(r => !liveIds.has(r.phoneNumberId))
        .map(r => ({
          id: r.phoneNumberId,
          display_phone_number: r.displayPhoneNumber ?? r.phoneNumberId,
          verified_name: '',
          quality_rating: 'UNKNOWN',
          label: r.label,
          isRegistered: true,
        }));

      res.json([...fromLive, ...onlyRegistered]);
    } catch (err) {
      next(err);
    }
  }

  static async registerNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const { phoneNumberId, label, wabaId } = req.body as { phoneNumberId?: string; label?: string; wabaId?: string };
      if (!phoneNumberId?.trim()) { res.status(400).json({ error: 'phoneNumberId é obrigatório' }); return; }
      if (!label?.trim())         { res.status(400).json({ error: 'Rótulo é obrigatório' }); return; }

      const entry = await registerWhatsAppNumber({ phoneNumberId: phoneNumberId.trim(), label: label.trim(), wabaId: wabaId?.trim() });
      res.status(201).json(entry);
    } catch (err) {
      respondWithMetaError(res, err);
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

  static async getMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const media = await fetchWhatsAppMedia(req.params.mediaId);
      res.setHeader('Content-Type', media.contentType);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.send(media.body);
    } catch (err) {
      next(err);
    }
  }

  static async uploadMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const file = (req as Request & { file?: { buffer: Buffer; mimetype: string; originalname: string } }).file;
      const phoneNumberId = String(req.body?.phoneNumberId ?? '').trim();
      if (!file) { res.status(400).json({ error: 'Selecione um arquivo.' }); return; }
      if (!phoneNumberId) { res.status(400).json({ error: 'Número de envio é obrigatório.' }); return; }
      res.json(await uploadWhatsAppMedia({ phoneNumberId, buffer: file.buffer, mimeType: file.mimetype, filename: file.originalname }));
    } catch (err) {
      respondWithMetaError(res, err);
    }
  }

  static async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { text, phoneNumberId } = req.body as { text?: string; phoneNumberId?: string };
      if (!text?.trim()) {
        res.status(400).json({ error: 'Mensagem não pode ser vazia' });
        return;
      }
      await sendWhatsAppTextFromUI(req.params.leadId, text.trim(), phoneNumberId);
      res.json({ ok: true });
    } catch (err) {
      respondWithMetaError(res, err);
    }
  }

  static async sendTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateName, bodyParams, phoneNumberId, headerMediaUrl, headerMediaId } = req.body as { templateName?: string; bodyParams?: string[]; phoneNumberId?: string; headerMediaUrl?: string; headerMediaId?: string };
      if (!templateName?.trim()) {
        res.status(400).json({ error: 'templateName é obrigatório' });
        return;
      }
      await sendWhatsAppTemplateFromUI(req.params.leadId, templateName.trim(), bodyParams ?? [], phoneNumberId, headerMediaUrl, headerMediaId);
      res.json({ ok: true });
    } catch (err) {
      respondWithMetaError(res, err);
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
      const { name, category, language, headerText, bodyText, footerText, phoneNumberId } = req.body as Partial<CreateTemplateInput>;
      if (!name?.trim())     { res.status(400).json({ error: 'Nome é obrigatório' }); return; }
      if (!bodyText?.trim()) { res.status(400).json({ error: 'Body é obrigatório' }); return; }
      if (!category)         { res.status(400).json({ error: 'Categoria é obrigatória' }); return; }

      const safeName = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const result = await createWhatsAppTemplate({ name: safeName, category, language: language ?? 'pt_BR', headerText, bodyText, footerText, phoneNumberId });
      res.status(201).json(result);
    } catch (err) {
      respondWithMetaError(res, err);
    }
  }

  static async deleteTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateName } = req.params;
      const phoneNumberId = req.query.phoneNumberId as string | undefined;
      if (!templateName) { res.status(400).json({ error: 'Nome do template obrigatório' }); return; }
      await deleteWhatsAppTemplate(decodeURIComponent(templateName), phoneNumberId);
      res.json({ ok: true });
    } catch (err) {
      respondWithMetaError(res, err);
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
