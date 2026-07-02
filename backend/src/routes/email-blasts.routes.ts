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
// opts.resume=true retoma um disparo que ficou travado em "sending" (ex: reinicio do
// processo/deploy no meio do envio) — recalcula quem ja recebeu de verdade a partir do
// EmailSent (nunca confia no sentCount salvo) e so envia para quem falta.
async function sendBlastNow(blastId: string, opts: { resume?: boolean } = {}): Promise<void> {
  const blast = await prisma.emailBlast.findUnique({ where: { id: blastId }, include: { template: true } });
  if (!blast) return;
  if (!opts.resume && (blast.status === 'sending' || blast.status === 'sent')) return;
  // Cancelado so bloqueia disparo automatico (agendamento/recuperacao); um resume
  // explicito (botao "Reenviar falhas") pode retomar um disparo cancelado de proposito.
  if (blast.status === 'cancelled' && !opts.resume) return;

  if (blast.status !== 'sending') {
    await prisma.emailBlast.update({ where: { id: blastId }, data: { status: 'sending' } });
  }

  try {
    const { sendEmail, renderTemplate } = await import('../services/resend.service');
    let leads = await resolveAudienceLeads(blast.audienceType, blast.audienceValue);

    // Verdade sempre vem do EmailSent — nunca confiar em sentCount/failedCount salvos,
    // que podem estar desatualizados apos um reinicio. "failed" e o unico status que
    // significa que o Resend nunca aceitou o envio; os outros (sent/delivered/opened/
    // clicked/bounced/complained) sao atualizados por webhook depois do envio real e
    // contam como "ja recebeu" para nao duplicar em uma retomada.
    const existingSends = await prisma.emailSent.findMany({
      where: { blastId: blast.id },
      select: { leadEmail: true, status: true },
    });
    const alreadySent = new Set(existingSends.filter(s => s.status !== 'failed').map(s => s.leadEmail));
    leads = leads.filter(lead => !alreadySent.has(lead.email));

    let sentCount = existingSends.filter(s => s.status !== 'failed').length;
    let failedCount = existingSends.filter(s => s.status === 'failed').length;

    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 300;

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const current = await prisma.emailBlast.findUnique({ where: { id: blastId }, select: { status: true } });
      if (current?.status === 'cancelled') return;

      const batch = leads.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async lead => {
        const subject = renderTemplate(blast.template.subject, lead);
        const html = renderTemplate(blast.template.body, lead);
        try {
          return await sendEmail({
            leadEmail: lead.email,
            toEmail: lead.email,
            subject,
            html,
            fromName: blast.template.fromName ?? undefined,
            fromEmail: blast.template.fromEmail ?? undefined,
            templateId: blast.templateId,
            blastId: blast.id,
          });
        } catch {
          return false;
        }
      }));
      sentCount   += results.filter(Boolean).length;
      failedCount += results.filter(ok => !ok).length;

      await prisma.emailBlast.update({ where: { id: blastId }, data: { sentCount, failedCount } });
      if (i + BATCH_SIZE < leads.length) await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }

    const finalState = await prisma.emailBlast.findUnique({ where: { id: blastId }, select: { status: true } });
    if (finalState?.status !== 'cancelled') {
      await prisma.emailBlast.update({
        where: { id: blastId },
        data: { status: 'sent', sentAt: new Date(), sentCount, failedCount },
      });
    }
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

// Chamado uma vez na inicializacao do servidor: retoma disparos que ficaram travados
// em "sending" por causa de um reinicio/deploy no meio do envio.
export async function recoverStuckBlasts(): Promise<void> {
  const stuck = await prisma.emailBlast.findMany({ where: { status: 'sending' }, select: { id: true } });
  for (const { id } of stuck) {
    console.log(`[email-blasts] retomando disparo travado ${id}`);
    sendBlastNow(id, { resume: true }).catch(err => console.error(`[email-blasts] resume ${id} falhou:`, err));
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

// Filtros disponiveis para a lista de envios na tela de detalhe do disparo
const SENDS_FILTERS: Record<string, Prisma.EmailSentWhereInput> = {
  opened:  { OR: [{ openedAt: { not: null } }, { clickedAt: { not: null } }] },
  clicked: { clickedAt: { not: null } },
  bounced: { status: 'bounced' },
  failed:  { status: 'failed' },
};

// GET /:id?page=&pageSize=&filter= — detalhe do disparo com metricas (sobre o total) e envios paginados/filtrados
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const blast = await prisma.emailBlast.findUnique({
      where: { id: req.params.id },
      include: { template: { select: { name: true, subject: true, fromName: true, fromEmail: true } } },
    });
    if (!blast) { res.status(404).json({ error: 'Disparo não encontrado' }); return; }

    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const filter    = String(req.query.filter ?? 'all');

    const baseWhere = { blastId: blast.id };
    const sendsWhere: Prisma.EmailSentWhereInput = { ...baseWhere, ...(SENDS_FILTERS[filter] ?? {}) };

    const [sendsTotal, sends, sent, delivered, opened, clicked, bounced, failed, successfulLeads] = await Promise.all([
      prisma.emailSent.count({ where: sendsWhere }),
      prisma.emailSent.findMany({
        where: sendsWhere,
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, leadEmail: true, toEmail: true, status: true,
          openedAt: true, clickedAt: true, clickedUrl: true, bouncedAt: true, sentAt: true,
          lead: { select: { name: true } },
        },
      }),
      prisma.emailSent.count({ where: baseWhere }),
      prisma.emailSent.count({ where: { ...baseWhere, OR: [{ status: { in: ['delivered', 'opened', 'clicked'] } }, { openedAt: { not: null } }, { clickedAt: { not: null } }] } }),
      prisma.emailSent.count({ where: { ...baseWhere, OR: [{ openedAt: { not: null } }, { clickedAt: { not: null } }] } }),
      prisma.emailSent.count({ where: { ...baseWhere, clickedAt: { not: null } } }),
      prisma.emailSent.count({ where: { ...baseWhere, status: 'bounced' } }),
      prisma.emailSent.count({ where: { ...baseWhere, status: 'failed' } }),
      // Leads distintos com pelo menos um envio bem sucedido (nao "failed") — usado para
      // saber quantos ainda faltam ser enviados (inclui os nunca tentados, ex: apos cancelar).
      prisma.emailSent.groupBy({ by: ['leadEmail'], where: { ...baseWhere, status: { not: 'failed' } } }),
    ]);

    const stats = {
      sent, delivered, opened, clicked, bounced, failed,
      openRate:   delivered > 0 ? Number((opened  / delivered * 100).toFixed(1)) : 0,
      clickRate:  delivered > 0 ? Number((clicked / delivered * 100).toFixed(1)) : 0,
      bounceRate: sent      > 0 ? Number((bounced / sent      * 100).toFixed(1)) : 0,
    };
    const pendingCount = Math.max(0, blast.audienceCount - successfulLeads.length);

    res.json({ ...blast, sends, sendsTotal, page, pageSize, filter, stats, pendingCount });
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

// POST /:id/retry-failed — reenvia so para quem falta (falhou ou nunca foi tentado, ex:
// apos um cancelamento) — nao duplica quem ja recebeu de verdade
router.post('/:id/retry-failed', async (req: Request, res: Response) => {
  try {
    const blast = await prisma.emailBlast.findUnique({ where: { id: req.params.id } });
    if (!blast) { res.status(404).json({ error: 'Disparo não encontrado' }); return; }
    if (blast.status === 'sending') { res.status(409).json({ error: 'Este disparo já está em andamento' }); return; }
    if (blast.status === 'draft' || blast.status === 'scheduled') { res.status(409).json({ error: 'Este disparo ainda não foi enviado' }); return; }

    const successfulLeads = await prisma.emailSent.groupBy({
      by: ['leadEmail'],
      where: { blastId: blast.id, status: { not: 'failed' } },
    });
    const pendingCount = Math.max(0, blast.audienceCount - successfulLeads.length);
    if (pendingCount === 0) { res.status(409).json({ error: 'Não há envios pendentes para reenviar' }); return; }

    sendBlastNow(blast.id, { resume: true }).catch(err => console.error(`[email-blasts] retry ${blast.id} falhou:`, err));
    res.json({ ok: true, retrying: pendingCount });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao reenviar falhas' });
  }
});

// POST /:id/cancel — interrompe um disparo em andamento (ou cancela um agendamento)
// Os lotes ja enviados nao sao desfeitos; apenas os que faltam deixam de ser processados.
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const blast = await prisma.emailBlast.findUnique({ where: { id: req.params.id } });
    if (!blast) { res.status(404).json({ error: 'Disparo não encontrado' }); return; }
    if (blast.status === 'sent' || blast.status === 'cancelled') {
      res.status(409).json({ error: 'Este disparo não pode mais ser cancelado' });
      return;
    }

    await prisma.emailBlast.update({ where: { id: req.params.id }, data: { status: 'cancelled' } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao cancelar disparo' });
  }
});

// DELETE /:id — exclui um disparo que ainda não foi enviado (ou já cancelado)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const blast = await prisma.emailBlast.findUnique({ where: { id: req.params.id } });
    if (!blast) { res.status(404).json({ error: 'Disparo não encontrado' }); return; }
    if (blast.status === 'sending' || blast.status === 'sent') {
      res.status(409).json({ error: 'Não é possível excluir um disparo já enviado ou em andamento — cancele primeiro' });
      return;
    }

    await prisma.emailBlast.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir disparo' });
  }
});

export default router;
