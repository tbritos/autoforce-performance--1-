import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { SegmentService, SegmentRules } from '../services/segment.service';

const router = Router();

type AudienceLead = { email: string; name: string | null; company: string | null; phone: string | null; jobTitle: string | null };

const LEAD_SELECT = { email: true, name: true, company: true, phone: true, jobTitle: true } as const;

// Resolve a lista de leads de uma audiencia (tag | segment | individual).
// Leads DISQUALIFIED (bot / inoperantes) nunca entram em um disparo.
async function resolveAudienceLeads(audienceType: string, audienceValue: string): Promise<AudienceLead[]> {
  const baseWhere: Prisma.LeadWhereInput = { deletedAt: null, status: { not: 'DISQUALIFIED' } };

  if (audienceType === 'tag') {
    return prisma.lead.findMany({ where: { ...baseWhere, tags: { has: audienceValue } }, select: LEAD_SELECT });
  }

  if (audienceType === 'segment') {
    const segment = await prisma.segment.findUnique({ where: { id: audienceValue } });
    if (!segment) return [];
    const rules = segment.rules as unknown as SegmentRules;
    const segmentWhere = SegmentService.buildWhere(rules);
    return prisma.lead.findMany({ where: { ...segmentWhere, status: { not: 'DISQUALIFIED' } }, select: LEAD_SELECT });
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

// Envia o disparo em segundo plano, em lotes pequenos para respeitar limites do Resend.
async function sendBlastNow(blastId: string): Promise<void> {
  const blast = await prisma.emailBlast.findUnique({ where: { id: blastId }, include: { template: true } });
  if (!blast || blast.status === 'sending' || blast.status === 'sent') return;

  await prisma.emailBlast.update({ where: { id: blastId }, data: { status: 'sending' } });

  try {
    const { sendEmail, renderTemplate } = await import('../services/resend.service');
    const leads = await resolveAudienceLeads(blast.audienceType, blast.audienceValue);

    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 300;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async lead => {
        try {
          const subject = renderTemplate(blast.template.subject, lead);
          const html = renderTemplate(blast.template.body, lead);
          await sendEmail({
            leadEmail: lead.email,
            toEmail: lead.email,
            subject,
            html,
            fromName: blast.template.fromName ?? undefined,
            fromEmail: blast.template.fromEmail ?? undefined,
            templateId: blast.templateId,
            blastId: blast.id,
          });
          sentCount += 1;
        } catch {
          failedCount += 1;
        }
      }));

      await prisma.emailBlast.update({ where: { id: blastId }, data: { sentCount, failedCount } });
      if (i + BATCH_SIZE < leads.length) await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }

    await prisma.emailBlast.update({
      where: { id: blastId },
      data: { status: 'sent', sentAt: new Date(), sentCount, failedCount },
    });
  } catch (err) {
    console.error(`[email-blasts] envio ${blastId} falhou:`, err);
    await prisma.emailBlast.update({ where: { id: blastId }, data: { status: 'failed' } });
  }
}

// Chamado periodicamente pelo scheduler para disparar agendamentos vencidos.
export async function processDueScheduledBlasts(): Promise<void> {
  const due = await prisma.emailBlast.findMany({
    where: { status: 'scheduled', scheduledAt: { lte: new Date() } },
    select: { id: true },
  });
  for (const { id } of due) {
    await sendBlastNow(id).catch(err => console.error(`[email-blasts] scheduled ${id} falhou:`, err));
  }
}

// GET / — lista disparos
router.get('/', async (_req: Request, res: Response) => {
  try {
    const blasts = await prisma.emailBlast.findMany({
      orderBy: { createdAt: 'desc' },
      include: { template: { select: { name: true, subject: true } } },
    });
    res.json(blasts);
  } catch {
    res.status(500).json({ error: 'Erro ao listar disparos' });
  }
});

// GET /audience-preview?audienceType=&audienceValue= — conta a audiencia sem persistir nada
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

// GET /:id — detalhe do disparo com metricas e lista completa de envios
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const blast = await prisma.emailBlast.findUnique({
      where: { id: req.params.id },
      include: { template: { select: { name: true, subject: true, fromName: true, fromEmail: true } } },
    });
    if (!blast) { res.status(404).json({ error: 'Disparo não encontrado' }); return; }

    const sends = await prisma.emailSent.findMany({
      where: { blastId: blast.id },
      orderBy: { sentAt: 'desc' },
      select: {
        id: true, leadEmail: true, toEmail: true, status: true,
        openedAt: true, clickedAt: true, clickedUrl: true, bouncedAt: true, sentAt: true,
        lead: { select: { name: true } },
      },
    });

    const sent      = sends.length;
    const delivered = sends.filter(send => ['delivered', 'opened', 'clicked'].includes(send.status) || send.openedAt || send.clickedAt).length;
    const opened    = sends.filter(send => send.openedAt || send.clickedAt).length;
    const clicked   = sends.filter(send => send.clickedAt).length;
    const bounced   = sends.filter(send => send.status === 'bounced').length;
    const stats = {
      sent, delivered, opened, clicked, bounced,
      openRate:   delivered > 0 ? Number((opened  / delivered * 100).toFixed(1)) : 0,
      clickRate:  delivered > 0 ? Number((clicked / delivered * 100).toFixed(1)) : 0,
      bounceRate: sent      > 0 ? Number((bounced / sent      * 100).toFixed(1)) : 0,
    };

    res.json({ ...blast, sends, stats });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao buscar disparo' });
  }
});

// POST / — cria um disparo (rascunho, agendado, ou dispara na hora se sendNow=true)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, templateId, audienceType, audienceValue, scheduledAt, sendNow } = req.body as Record<string, unknown>;

    if (!String(name ?? '').trim())          { res.status(400).json({ error: 'Nome é obrigatório' }); return; }
    if (!String(templateId ?? '').trim())    { res.status(400).json({ error: 'Template é obrigatório' }); return; }
    if (!String(audienceType ?? '').trim())  { res.status(400).json({ error: 'Tipo de audiência é obrigatório' }); return; }
    if (!String(audienceValue ?? '').trim()) { res.status(400).json({ error: 'Audiência é obrigatória' }); return; }

    const template = await prisma.emailTemplate.findUnique({ where: { id: String(templateId) } });
    if (!template) { res.status(404).json({ error: 'Template não encontrado' }); return; }

    const leads = await resolveAudienceLeads(String(audienceType), String(audienceValue));
    const scheduledDate = scheduledAt ? new Date(String(scheduledAt)) : null;
    const isFutureSchedule = scheduledDate !== null && scheduledDate.getTime() > Date.now();

    const blast = await prisma.emailBlast.create({
      data: {
        name: String(name).trim(),
        templateId: String(templateId),
        audienceType: String(audienceType),
        audienceValue: String(audienceValue),
        audienceCount: leads.length,
        status: isFutureSchedule ? 'scheduled' : 'draft',
        scheduledAt: isFutureSchedule ? scheduledDate : null,
      },
    });

    if (!isFutureSchedule && sendNow) {
      sendBlastNow(blast.id).catch(err => console.error(`[email-blasts] envio ${blast.id} falhou:`, err));
    }

    res.status(201).json(blast);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao criar disparo' });
  }
});

// POST /:id/send — dispara imediatamente (rascunho pronto, ou reenvio manual)
router.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const blast = await prisma.emailBlast.findUnique({ where: { id: req.params.id } });
    if (!blast) { res.status(404).json({ error: 'Disparo não encontrado' }); return; }
    if (blast.status === 'sending' || blast.status === 'sent') {
      res.status(409).json({ error: 'Este disparo já foi enviado ou está em andamento' });
      return;
    }

    sendBlastNow(blast.id).catch(err => console.error(`[email-blasts] envio ${blast.id} falhou:`, err));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao disparar' });
  }
});

// DELETE /:id — cancela um disparo que ainda não foi enviado
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const blast = await prisma.emailBlast.findUnique({ where: { id: req.params.id } });
    if (!blast) { res.status(404).json({ error: 'Disparo não encontrado' }); return; }
    if (blast.status === 'sending' || blast.status === 'sent') {
      res.status(409).json({ error: 'Não é possível excluir um disparo já enviado ou em andamento' });
      return;
    }

    await prisma.emailBlast.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir disparo' });
  }
});

export default router;
