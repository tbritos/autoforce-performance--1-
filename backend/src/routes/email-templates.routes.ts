import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';

const router = Router();

// List all templates with aggregate metrics
router.get('/', async (_req: Request, res: Response) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const ids = templates.map(t => t.id);
    if (ids.length === 0) { res.json([]); return; }

    const sends = await prisma.emailSent.findMany({
      where: { templateId: { in: ids } },
      select: { templateId: true, status: true, openedAt: true, clickedAt: true },
    });

    const statsMap: Record<string, { sent: number; delivered: number; opened: number; clicked: number; bounced: number }> = {};
    for (const row of sends) {
      if (!row.templateId) continue;
      statsMap[row.templateId] ??= { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
      const s = statsMap[row.templateId];
      s.sent += 1;
      if (['delivered', 'opened', 'clicked'].includes(row.status) || row.openedAt || row.clickedAt) s.delivered += 1;
      if (row.openedAt || row.clickedAt) s.opened += 1;
      if (row.clickedAt) s.clicked += 1;
      if (row.status === 'bounced') s.bounced += 1;
    }

    const result = templates.map(t => {
      const s = statsMap[t.id] ?? { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
      const { sent, delivered, opened, clicked, bounced } = s;
      return {
        ...t,
        stats: {
          sent,
          delivered,
          opened,
          clicked,
          bounced,
          openRate:   delivered > 0 ? Number((opened  / delivered * 100).toFixed(1)) : 0,
          clickRate:  delivered > 0 ? Number((clicked / delivered * 100).toFixed(1)) : 0,
          bounceRate: sent      > 0 ? Number((bounced / sent      * 100).toFixed(1)) : 0,
        },
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar templates' });
  }
});

// Get single template with sends history
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const template = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) { res.status(404).json({ error: 'Template não encontrado' }); return; }

    const sends = await prisma.emailSent.findMany({
      where: { templateId: template.id },
      orderBy: { sentAt: 'desc' },
      take: 50,
      select: {
        id: true, leadEmail: true, toEmail: true, status: true,
        openedAt: true, clickedAt: true, bouncedAt: true, sentAt: true,
      },
    });

    const sent      = sends.length;
    const delivered = sends.filter(send => ['delivered', 'opened', 'clicked'].includes(send.status) || send.openedAt || send.clickedAt).length;
    const opened    = sends.filter(send => send.openedAt || send.clickedAt).length;
    const clicked   = sends.filter(send => send.clickedAt).length;
    const bounced   = sends.filter(send => send.status === 'bounced').length;
    const stats = {
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      openRate:  delivered > 0 ? Number((opened  / delivered * 100).toFixed(1)) : 0,
      clickRate: delivered > 0 ? Number((clicked / delivered * 100).toFixed(1)) : 0,
      bounceRate: sent     > 0 ? Number((bounced / sent      * 100).toFixed(1)) : 0,
    };

    res.json({ ...template, sends, stats });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar template' });
  }
});

// Create template
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, subject, body, design, fromName, fromEmail, status, scheduledAt, audienceType, audienceValue, audienceCount } = req.body as Record<string, unknown>;
    if (!String(name ?? '').trim())    { res.status(400).json({ error: 'Nome é obrigatório' }); return; }

    const template = await prisma.emailTemplate.create({
      data: {
        name:          String(name).trim(),
        subject:       String(subject ?? '').trim(),
        body:          String(body ?? '').trim(),
        design:        design ?? undefined,
        fromName:      fromName  ? String(fromName).trim()  : null,
        fromEmail:     fromEmail ? String(fromEmail).trim() : null,
        status:        String(status ?? 'draft'),
        scheduledAt:   scheduledAt ? new Date(String(scheduledAt)) : null,
        audienceType:  audienceType  ? String(audienceType)  : null,
        audienceValue: audienceValue ? String(audienceValue) : null,
        audienceCount: audienceCount ? Number(audienceCount) : null,
      },
    });
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar template' });
  }
});

// Update template
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (body.name         !== undefined) data['name']          = String(body.name).trim();
    if (body.subject      !== undefined) data['subject']       = String(body.subject).trim();
    if (body.body         !== undefined) data['body']          = String(body.body).trim();
    if (body.design       !== undefined) data['design']        = body.design;
    if (body.fromName     !== undefined) data['fromName']      = body.fromName  ? String(body.fromName).trim()  : null;
    if (body.fromEmail    !== undefined) data['fromEmail']     = body.fromEmail ? String(body.fromEmail).trim() : null;
    if (body.isActive     !== undefined) data['isActive']      = Boolean(body.isActive);
    if (body.status       !== undefined) data['status']        = String(body.status);
    if (body.scheduledAt  !== undefined) data['scheduledAt']   = body.scheduledAt ? new Date(String(body.scheduledAt)) : null;
    if (body.audienceType !== undefined) data['audienceType']  = body.audienceType  ? String(body.audienceType)  : null;
    if (body.audienceValue!== undefined) data['audienceValue'] = body.audienceValue ? String(body.audienceValue) : null;
    if (body.audienceCount!== undefined) data['audienceCount'] = body.audienceCount ? Number(body.audienceCount) : null;

    const template = await prisma.emailTemplate.update({ where: { id: req.params.id }, data });
    res.json(template);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar template' });
  }
});

// Delete template
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.emailTemplate.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao deletar template' });
  }
});

// Test send — envia para o email informado usando o template
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { toEmail } = req.body as { toEmail?: string };
    if (!toEmail?.trim()) { res.status(400).json({ error: 'toEmail é obrigatório' }); return; }

    const template = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) { res.status(404).json({ error: 'Template não encontrado' }); return; }

    const { sendEmail } = await import('../services/resend.service');

    // Para envio de teste, usamos um lead fictício (o próprio email como destinatário)
    const testLead = {
      email: toEmail.trim(),
      name:  'Teste',
      company: 'Sua Empresa',
      phone: '(00) 00000-0000',
      jobTitle: 'Cargo',
    };

    const { renderTemplate } = await import('../services/resend.service');
    const subject = renderTemplate(template.subject, testLead);
    const html    = renderTemplate(template.body,    testLead);

    // Cria lead temporário ou usa email como leadEmail sem FK
    await sendEmail({
      leadEmail:  toEmail.trim(),
      toEmail:    toEmail.trim(),
      subject:    `[TESTE] ${subject}`,
      html,
      fromName:   template.fromName  ?? undefined,
      fromEmail:  template.fromEmail ?? undefined,
      skipRecord: true,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao enviar teste' });
  }
});

export default router;
