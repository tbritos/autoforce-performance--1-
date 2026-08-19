import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { SegmentService, SegmentRules } from '../services/segment.service';
import { normalizePhoneE164 } from '../utils/phone';

const router = Router();

// Trava em memoria contra execucao concorrente do mesmo disparo — mesmo
// padrao do disparo de e-mail (email-blasts.routes.ts).
const activeBlasts = new Set<string>();

type AudienceLead = {
  id: string; email: string; name: string | null; company: string | null;
  phone: string | null; jobTitle: string | null; status: string; score: number;
};

const LEAD_SELECT = { id: true, email: true, name: true, company: true, phone: true, jobTitle: true, status: true, score: true } as const;

// Resolve a lista de leads de uma audiencia (tag | segment | individual).
// Leads DISQUALIFIED nunca entram, e precisa ter telefone (sem isso nao tem
// pra onde mandar WhatsApp).
async function resolveAudienceLeads(audienceType: string, audienceValue: string): Promise<AudienceLead[]> {
  const baseWhere: Prisma.LeadWhereInput = { deletedAt: null, status: { not: 'DISQUALIFIED' }, phone: { not: null } };

  if (audienceType === 'tag') {
    return prisma.lead.findMany({ where: { ...baseWhere, tags: { has: audienceValue } }, select: LEAD_SELECT });
  }

  if (audienceType === 'segment') {
    const segment = await prisma.segment.findUnique({ where: { id: audienceValue } });
    if (!segment) return [];
    const rules = segment.rules as unknown as SegmentRules;
    const segmentWhere = await SegmentService.buildWhere(rules, [segment.id]);
    return prisma.lead.findMany({ where: { ...segmentWhere, status: { not: 'DISQUALIFIED' }, phone: { not: null } }, select: LEAD_SELECT });
  }

  if (audienceType === 'individual') {
    let emails: string[] = [];
    try {
      emails = JSON.parse(audienceValue);
    } catch {
      return [];
    }
    if (!Array.isArray(emails) || !emails.length) return [];
    return prisma.lead.findMany({ where: { ...baseWhere, email: { in: emails } }, select: LEAD_SELECT });
  }

  return [];
}

// Mesmas chaves usadas em leadFieldValues no bloco de WhatsApp da automacao
// (automation-engine.service.ts) — pra varMappings funcionar igual nos dois.
function leadFieldValues(lead: AudienceLead): Record<string, string> {
  return {
    name: lead.name ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    jobTitle: lead.jobTitle ?? '',
    companyName: lead.company ?? '',
    status: lead.status ?? '',
    score: String(lead.score ?? ''),
  };
}

function toE164(phone: string): string {
  const normalized = normalizePhoneE164(phone);
  if (!normalized) throw new Error(`Telefone inválido ou sem DDD: ${phone}`);
  return normalized;
}

// Envia o disparo em segundo plano, em lotes pequenos. Mais conservador que o
// de e-mail (10/1s vs 5/300ms) porque a Meta pode rejeitar por limite de
// mensageria do numero (tier de 250/1k/10k/100k conversas por 24h) — nao
// tentamos controlar esse tier aqui, so registramos como falha e seguimos.
// opts.resume=true retoma um disparo travado em "sending", recalculando quem
// ja recebeu de verdade a partir de WhatsAppMessage (nunca confia no
// sentCount salvo) — mesmo principio do disparo de e-mail.
async function sendWhatsAppBlastNow(blastId: string, opts: { resume?: boolean } = {}): Promise<void> {
  const blast = await prisma.whatsAppBlast.findUnique({ where: { id: blastId } });
  if (!blast) return;
  if (!opts.resume && (blast.status === 'sending' || blast.status === 'sent')) return;
  if (blast.status === 'cancelled' && !opts.resume) return;
  if (activeBlasts.has(blastId)) return;
  activeBlasts.add(blastId);

  if (blast.status !== 'sending') {
    await prisma.whatsAppBlast.update({ where: { id: blastId }, data: { status: 'sending' } });
  }

  try {
    const { getWhatsAppCredentials, fetchWhatsAppTemplates, recordOutgoingWhatsAppMessage, buildComponentParams, resolveTemplateBodyText } =
      await import('../services/whatsapp.service');

    let leads = await resolveAudienceLeads(blast.audienceType, blast.audienceValue);

    const existingSends = await prisma.whatsAppMessage.findMany({
      where: { whatsAppBlastId: blast.id },
      select: { leadId: true, status: true },
    });
    const alreadySent = new Set(existingSends.filter(s => s.status !== 'failed' && s.leadId).map(s => s.leadId as string));
    leads = leads.filter(lead => !alreadySent.has(lead.id));

    let sentCount = existingSends.filter(s => s.status !== 'failed').length;
    let failedCount = existingSends.filter(s => s.status === 'failed').length;

    const { accessToken } = await getWhatsAppCredentials();
    const templates = await fetchWhatsAppTemplates(blast.phoneNumberId);
    const template = templates.find(t => t.name === blast.templateName);
    const headerText = template?.components.find(c => c.type === 'HEADER')?.text ?? null;
    const headerFormat = String(template?.components.find(c => c.type === 'HEADER')?.format ?? '').toUpperCase();
    const bodyText = template?.components.find(c => c.type === 'BODY')?.text ?? null;
    const varMappings = (blast.varMappings ?? {}) as Record<string, string>;

    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 1000;

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const current = await prisma.whatsAppBlast.findUnique({ where: { id: blastId }, select: { status: true } });
      if (current?.status === 'cancelled') return;

      const batch = leads.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async lead => {
        const fieldValues = leadFieldValues(lead);
        const headerParams = buildComponentParams(headerText, varMappings, fieldValues);
        const mediaUrl = String(blast.headerMediaUrl ?? '').trim();
        const mediaId = String(blast.headerMediaId ?? '').trim();
        if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && (mediaUrl || mediaId)) {
          const key = headerFormat.toLowerCase();
          headerParams.splice(0, headerParams.length, { type: key, [key]: mediaId ? { id: mediaId } : { link: mediaUrl } } as any);
        }
        const bodyParams = buildComponentParams(bodyText, varMappings, fieldValues);
        const to = toE164(lead.phone!);
        const resolvedText = bodyText ? resolveTemplateBodyText(bodyText, varMappings, fieldValues) : null;

        const templatePayload: Record<string, unknown> = {
          name: blast.templateName,
          language: { code: blast.templateLanguage },
        };
        const templateComponents: Array<Record<string, unknown>> = [];
        if (headerParams.length > 0) templateComponents.push({ type: 'header', parameters: headerParams });
        if (bodyParams.length > 0) templateComponents.push({ type: 'body', parameters: bodyParams });
        if (templateComponents.length > 0) templatePayload.components = templateComponents;

        const body = { messaging_product: 'whatsapp', to, type: 'template', template: templatePayload };

        try {
          const res = await fetch(`https://graph.facebook.com/v19.0/${blast.phoneNumberId}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const data = await res.json() as { messages?: Array<{ id?: string }>; error?: { message: string } };

          if (!res.ok || data.error) {
            await recordOutgoingWhatsAppMessage({
              leadEmail: lead.email, phone: to, templateName: blast.templateName, text: resolvedText,
              payload: { request: body, error: data.error ?? null }, whatsAppBlastId: blast.id,
              phoneNumberId: blast.phoneNumberId, status: 'failed',
            });
            return false;
          }

          await recordOutgoingWhatsAppMessage({
            leadEmail: lead.email, phone: to, messageId: data.messages?.[0]?.id ?? null,
            templateName: blast.templateName, text: resolvedText, payload: body,
            whatsAppBlastId: blast.id, phoneNumberId: blast.phoneNumberId,
          });
          return true;
        } catch (err) {
          await recordOutgoingWhatsAppMessage({
            leadEmail: lead.email, phone: to, templateName: blast.templateName, text: resolvedText,
            payload: { request: body, error: err instanceof Error ? err.message : String(err) },
            whatsAppBlastId: blast.id, phoneNumberId: blast.phoneNumberId, status: 'failed',
          });
          return false;
        }
      }));

      sentCount   += results.filter(Boolean).length;
      failedCount += results.filter(ok => !ok).length;

      await prisma.whatsAppBlast.update({ where: { id: blastId }, data: { sentCount, failedCount } });
      if (i + BATCH_SIZE < leads.length) await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }

    const finalState = await prisma.whatsAppBlast.findUnique({ where: { id: blastId }, select: { status: true } });
    if (finalState?.status !== 'cancelled') {
      await prisma.whatsAppBlast.update({
        where: { id: blastId },
        data: { status: 'sent', sentAt: new Date(), sentCount, failedCount },
      });
    }
  } catch (err) {
    console.error(`[whatsapp-blasts] envio ${blastId} falhou:`, err);
    await prisma.whatsAppBlast.update({ where: { id: blastId }, data: { status: 'failed' } });
  } finally {
    activeBlasts.delete(blastId);
  }
}

// Chamado periodicamente pelo scheduler para disparar agendamentos vencidos.
export async function processDueWhatsAppBlasts(): Promise<void> {
  const due = await prisma.whatsAppBlast.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: new Date() } },
    select: { id: true },
  });
  for (const { id } of due) {
    await sendWhatsAppBlastNow(id).catch(err => console.error(`[whatsapp-blasts] scheduled ${id} falhou:`, err));
  }
}

// Chamado uma vez na inicializacao do servidor: retoma disparos travados em
// "sending" por causa de um reinicio/deploy no meio do envio.
export async function recoverStuckWhatsAppBlasts(): Promise<void> {
  const stuck = await prisma.whatsAppBlast.findMany({ where: { status: 'sending' }, select: { id: true } });
  for (const { id } of stuck) {
    console.log(`[whatsapp-blasts] retomando disparo travado ${id}`);
    sendWhatsAppBlastNow(id, { resume: true }).catch(err => console.error(`[whatsapp-blasts] resume ${id} falhou:`, err));
  }
}

const STALE_SENDING_MS = 3 * 60 * 1000;

// Chamado periodicamente: pega disparos em "sending" sem progresso recente
// (hang de rede, nao so reinicio do processo) e retoma.
export async function recoverStaleWhatsAppBlasts(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_SENDING_MS);
  const stale = await prisma.whatsAppBlast.findMany({
    where: { status: 'sending', updatedAt: { lte: cutoff } },
    select: { id: true },
  });
  for (const { id } of stale) {
    if (activeBlasts.has(id)) continue;
    console.log(`[whatsapp-blasts] disparo ${id} sem progresso ha mais de ${STALE_SENDING_MS / 60000}min — retomando`);
    sendWhatsAppBlastNow(id, { resume: true }).catch(err => console.error(`[whatsapp-blasts] resume ${id} falhou:`, err));
  }
}

// GET / — lista disparos
router.get('/', async (_req: Request, res: Response) => {
  try {
    const blasts = await prisma.whatsAppBlast.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(blasts);
  } catch {
    res.status(500).json({ error: 'Erro ao listar disparos' });
  }
});

// GET /audience-preview?audienceType=&audienceValue= — conta a audiencia sem persistir
router.get('/audience-preview', async (req: Request, res: Response) => {
  try {
    const audienceType = String(req.query.audienceType ?? '');
    const audienceValue = String(req.query.audienceValue ?? '');
    if (!audienceType || !audienceValue) { res.status(400).json({ error: 'audienceType e audienceValue são obrigatórios' }); return; }

    const leads = await resolveAudienceLeads(audienceType, audienceValue);
    res.json({ count: leads.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao pré-visualizar audiência' });
  }
});

const SENDS_FILTERS: Record<string, Prisma.WhatsAppMessageWhereInput> = {
  delivered: { status: { in: ['delivered', 'read'] } },
  read:      { status: 'read' },
  failed:    { status: 'failed' },
};

// GET /:id?page=&pageSize=&filter= — detalhe do disparo com metricas e envios paginados/filtrados
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const blast = await prisma.whatsAppBlast.findUnique({ where: { id: req.params.id } });
    if (!blast) { res.status(404).json({ error: 'Disparo não encontrado' }); return; }

    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const filter   = String(req.query.filter ?? 'all');

    const baseWhere: Prisma.WhatsAppMessageWhereInput = { whatsAppBlastId: blast.id };
    const sendsWhere: Prisma.WhatsAppMessageWhereInput = { ...baseWhere, ...(SENDS_FILTERS[filter] ?? {}) };

    const [sendsTotal, sends, sent, delivered, read, failed, successfulLeads] = await Promise.all([
      prisma.whatsAppMessage.count({ where: sendsWhere }),
      prisma.whatsAppMessage.findMany({
        where: sendsWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, leadId: true, phone: true, status: true, text: true, sentAt: true, deliveredAt: true, readAt: true, failedAt: true, createdAt: true, payload: true },
      }),
      prisma.whatsAppMessage.count({ where: baseWhere }),
      prisma.whatsAppMessage.count({ where: { ...baseWhere, status: { in: ['delivered', 'read'] } } }),
      prisma.whatsAppMessage.count({ where: { ...baseWhere, status: 'read' } }),
      prisma.whatsAppMessage.count({ where: { ...baseWhere, status: 'failed' } }),
      prisma.whatsAppMessage.groupBy({ by: ['leadId'], where: { ...baseWhere, status: { not: 'failed' } } }),
    ]);

    // WhatsAppMessage nao tem relacao formal com Lead — busca os nomes a parte,
    // so pra pagina atual.
    const leadIds = [...new Set(sends.map(s => s.leadId).filter((id): id is string => !!id))];
    const leadNames = leadIds.length
      ? await prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true } })
      : [];
    const nameByLeadId = new Map(leadNames.map(l => [l.id, l.name]));
    const sendsWithName = sends.map(({ payload, ...s }) => {
      const err = (payload as { error?: unknown } | null)?.error;
      const errorMessage = s.status === 'failed'
        ? (typeof err === 'string' ? err : (err as { message?: string } | null)?.message ?? null)
        : null;
      return { ...s, leadName: s.leadId ? nameByLeadId.get(s.leadId) ?? null : null, errorMessage };
    });

    const stats = {
      sent, delivered, read, failed,
      deliveryRate: sent      > 0 ? Number((delivered / sent      * 100).toFixed(1)) : 0,
      readRate:     delivered > 0 ? Number((read      / delivered * 100).toFixed(1)) : 0,
    };
    const pendingCount = Math.max(0, blast.audienceCount - successfulLeads.length);

    res.json({ ...blast, sends: sendsWithName, sendsTotal, page, pageSize, filter, stats, pendingCount });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao buscar disparo' });
  }
});

// POST / — cria um disparo (rascunho, agendado, ou dispara na hora se sendNow=true)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, phoneNumberId, templateName, templateLanguage, varMappings, audienceType, audienceValue, scheduledAt, sendNow, headerMediaUrl, headerMediaId } =
      req.body as Record<string, unknown>;

    if (!String(name ?? '').trim())          { res.status(400).json({ error: 'Nome é obrigatório' }); return; }
    if (!String(phoneNumberId ?? '').trim()) { res.status(400).json({ error: 'Número de envio é obrigatório' }); return; }
    if (!String(templateName ?? '').trim())  { res.status(400).json({ error: 'Template é obrigatório' }); return; }
    if (!String(audienceType ?? '').trim())  { res.status(400).json({ error: 'Tipo de audiência é obrigatório' }); return; }
    if (!String(audienceValue ?? '').trim()) { res.status(400).json({ error: 'Audiência é obrigatória' }); return; }

    const { fetchWhatsAppTemplates, extractTemplateVars } = await import('../services/whatsapp.service');
    const templates = await fetchWhatsAppTemplates(String(phoneNumberId));
    const template = templates.find(t => t.name === String(templateName));
    if (!template) { res.status(404).json({ error: 'Template não encontrado nesse número' }); return; }
    const headerFormat = String(template.components.find(c => c.type === 'HEADER')?.format ?? '').toUpperCase();
    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && !String(headerMediaUrl ?? '').trim() && !String(headerMediaId ?? '').trim()) {
      res.status(400).json({ error: `Este template exige uma mídia no cabeçalho (${headerFormat.toLowerCase()}). Informe uma URL pública.` }); return;
    }

    const mappings = (varMappings ?? {}) as Record<string, string>;
    const requiredVars = extractTemplateVars(template.components);
    const missing = requiredVars.filter(v => !mappings[v]);
    if (missing.length > 0) {
      res.status(400).json({ error: `Faltou mapear a(s) variável(is) do template: ${missing.join(', ')}` });
      return;
    }

    const leads = await resolveAudienceLeads(String(audienceType), String(audienceValue));
    const scheduledDate = scheduledAt ? new Date(String(scheduledAt)) : null;
    const isFutureSchedule = scheduledDate !== null && scheduledDate.getTime() > Date.now();

    const blast = await prisma.whatsAppBlast.create({
      data: {
        name: String(name).trim(),
        phoneNumberId: String(phoneNumberId),
        templateName: String(templateName),
        templateLanguage: String(templateLanguage ?? template.language ?? 'pt_BR'),
        headerMediaUrl: String(headerMediaUrl ?? '').trim() || null,
        headerMediaId: String(headerMediaId ?? '').trim() || null,
        varMappings: mappings,
        audienceType: String(audienceType),
        audienceValue: String(audienceValue),
        audienceCount: leads.length,
        status: isFutureSchedule ? 'scheduled' : 'draft',
        scheduledAt: isFutureSchedule ? scheduledDate : null,
      },
    });

    if (!isFutureSchedule && sendNow) {
      sendWhatsAppBlastNow(blast.id).catch(err => console.error(`[whatsapp-blasts] envio ${blast.id} falhou:`, err));
    }

    res.status(201).json(blast);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao criar disparo' });
  }
});

// POST /:id/send — dispara imediatamente (rascunho pronto)
router.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const blast = await prisma.whatsAppBlast.findUnique({ where: { id: req.params.id } });
    if (!blast) { res.status(404).json({ error: 'Disparo não encontrado' }); return; }
    if (blast.status === 'sending' || blast.status === 'sent') {
      res.status(409).json({ error: 'Este disparo já foi enviado ou está em andamento' });
      return;
    }

    sendWhatsAppBlastNow(blast.id).catch(err => console.error(`[whatsapp-blasts] envio ${blast.id} falhou:`, err));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao disparar' });
  }
});

// POST /:id/retry-failed — reenvia so para quem falta
router.post('/:id/retry-failed', async (req: Request, res: Response) => {
  try {
    const blast = await prisma.whatsAppBlast.findUnique({ where: { id: req.params.id } });
    if (!blast) { res.status(404).json({ error: 'Disparo não encontrado' }); return; }
    if (blast.status === 'sending') { res.status(409).json({ error: 'Este disparo já está em andamento' }); return; }
    if (blast.status === 'draft' || blast.status === 'scheduled') { res.status(409).json({ error: 'Este disparo ainda não foi enviado' }); return; }

    const successfulLeads = await prisma.whatsAppMessage.groupBy({
      by: ['leadId'],
      where: { whatsAppBlastId: blast.id, status: { not: 'failed' } },
    });
    const pendingCount = Math.max(0, blast.audienceCount - successfulLeads.length);
    if (pendingCount === 0) { res.status(409).json({ error: 'Não há envios pendentes para reenviar' }); return; }

    sendWhatsAppBlastNow(blast.id, { resume: true }).catch(err => console.error(`[whatsapp-blasts] retry ${blast.id} falhou:`, err));
    res.json({ ok: true, retrying: pendingCount });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao reenviar falhas' });
  }
});

// POST /:id/cancel — interrompe um disparo em andamento (ou cancela um agendamento)
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const blast = await prisma.whatsAppBlast.findUnique({ where: { id: req.params.id } });
    if (!blast) { res.status(404).json({ error: 'Disparo não encontrado' }); return; }
    if (blast.status === 'sent' || blast.status === 'cancelled') {
      res.status(409).json({ error: 'Este disparo não pode mais ser cancelado' });
      return;
    }

    await prisma.whatsAppBlast.update({ where: { id: req.params.id }, data: { status: 'cancelled' } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao cancelar disparo' });
  }
});

// DELETE /:id — exclui um disparo que ainda não foi enviado (ou já cancelado)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const blast = await prisma.whatsAppBlast.findUnique({ where: { id: req.params.id } });
    if (!blast) { res.status(404).json({ error: 'Disparo não encontrado' }); return; }
    if (blast.status === 'sending' || blast.status === 'sent') {
      res.status(409).json({ error: 'Não é possível excluir um disparo já enviado ou em andamento — cancele primeiro' });
      return;
    }

    await prisma.whatsAppBlast.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir disparo' });
  }
});

export default router;
