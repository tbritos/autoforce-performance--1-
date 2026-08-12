import { Router } from 'express';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { getEmailCampaigns, createEmailCampaign, updateEmailCampaign, deleteEmailCampaign, getRdEmailCampaigns, syncRdEmailCampaigns, getRdWorkflowEmailStats, syncRdWorkflowEmailStats, getSyncLogs, getRdContactFields } from '../controllers/email.controller';
import { prisma } from '../config/database';
import { emailSuppressionScopeLabel } from '../services/email-preferences.service';

const router = Router();

const suppressionSourceFilter = (source: unknown): string | null | undefined => {
  if (typeof source !== 'string' || !source.trim()) return undefined;
  return source === 'unknown' ? null : source.trim();
};

async function buildSuppressionWhere(req: Request): Promise<Prisma.EmailSuppressionWhereInput> {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const source = suppressionSourceFilter(req.query.source);
  const scope = typeof req.query.scope === 'string' && ['newsletter', 'marketing', 'all'].includes(req.query.scope)
    ? req.query.scope
    : undefined;
  const and: Prisma.EmailSuppressionWhereInput[] = [];

  if (source !== undefined) and.push({ source });
  if (scope) and.push({ scope });
  if (search) {
    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
        ],
      },
      select: { email: true },
      take: 500,
    });
    and.push({
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
        ...(leads.length ? [{ email: { in: leads.map(lead => lead.email) } }] : []),
      ],
    });
  }

  return and.length ? { AND: and } : {};
}

async function enrichSuppressions(rows: Array<{
  id: string;
  email: string;
  reason: string;
  scope: string;
  source: string | null;
  unsubscribedAt: Date;
}>) {
  const leads = rows.length
    ? await prisma.lead.findMany({
        where: {
          OR: rows.map(row => ({ email: { equals: row.email, mode: 'insensitive' as const } })),
        },
        select: { id: true, email: true, name: true, company: true },
      })
    : [];
  const leadByEmail = new Map(leads.map(lead => [lead.email.toLowerCase(), lead]));
  return rows.map(row => {
    const lead = leadByEmail.get(row.email.toLowerCase());
    return {
      ...row,
      leadId: lead?.id ?? null,
      leadName: lead?.name ?? null,
      company: lead?.company ?? null,
    };
  });
}

const csvCell = (value: unknown): string => {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

const suppressionSourceLabel = (source: string | null): string => ({
  'confirmation-page': 'Página de confirmação',
  'one-click-header': 'Descadastro pelo provedor',
  'resend-webhook': 'Webhook do Resend',
}[source ?? ''] ?? source ?? 'Origem não informada');

const suppressionReasonLabel = (reason: string): string => ({
  unsubscribe: 'Desinscrição',
  complaint: 'Denúncia de spam',
}[reason] ?? reason);

router.get('/campaigns', getEmailCampaigns);
router.get('/campaigns/rdstation', getRdEmailCampaigns);
router.get('/campaigns/rdstation/sync', syncRdEmailCampaigns);
router.get('/automation/rdstation', getRdWorkflowEmailStats);
router.get('/automation/rdstation/sync', syncRdWorkflowEmailStats);
router.get('/rdstation/fields', getRdContactFields);
router.get('/sync/logs', getSyncLogs);
router.post('/campaigns', createEmailCampaign);
router.put('/campaigns/:id', updateEmailCampaign);
router.delete('/campaigns/:id', deleteEmailCampaign);

// Lista administrativa de endereços que não podem mais receber comunicações.
// Esta rota fica atrás do authMiddleware global; a rota pública de desinscrição
// continua exibindo apenas o endereço mascarado.
router.get('/suppressions/export', async (req: Request, res: Response) => {
  try {
    const where = await buildSuppressionWhere(req);
    const rows = await prisma.emailSuppression.findMany({
      where,
      orderBy: { unsubscribedAt: 'desc' },
      select: { id: true, email: true, scope: true, reason: true, source: true, unsubscribedAt: true },
    });
    const items = await enrichSuppressions(rows);
    const header = ['Nome', 'E-mail', 'Empresa', 'Categoria', 'Data da desinscrição', 'Origem', 'Motivo'];
    const lines = items.map(item => [
      item.leadName,
      item.email,
      item.company,
      emailSuppressionScopeLabel(item.scope),
      item.unsubscribedAt.toISOString(),
      suppressionSourceLabel(item.source),
      suppressionReasonLabel(item.reason),
    ].map(csvCell).join(';'));
    res.json({
      filename: `descadastros-email-${new Date().toISOString().slice(0, 10)}.csv`,
      count: items.length,
      csv: `\uFEFF${[header.map(csvCell).join(';'), ...lines].join('\n')}`,
    });
  } catch (error) {
    console.error('[email-suppressions] export failed', error);
    res.status(500).json({ error: 'Erro ao exportar descadastros' });
  }
});

router.get('/suppressions', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const where = await buildSuppressionWhere(req);
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const [rows, total, all, unsubscribe, complaint, recent, groupedSources, groupedScopes] = await Promise.all([
      prisma.emailSuppression.findMany({
        where,
        orderBy: { unsubscribedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, email: true, scope: true, reason: true, source: true, unsubscribedAt: true },
      }),
      prisma.emailSuppression.count({ where }),
      prisma.emailSuppression.count(),
      prisma.emailSuppression.count({ where: { reason: 'unsubscribe' } }),
      prisma.emailSuppression.count({ where: { reason: 'complaint' } }),
      prisma.emailSuppression.count({ where: { unsubscribedAt: { gte: last30Days } } }),
      prisma.emailSuppression.groupBy({ by: ['source'], _count: { _all: true }, orderBy: { source: 'asc' } }),
      prisma.emailSuppression.groupBy({ by: ['scope'], _count: { _all: true }, orderBy: { scope: 'asc' } }),
    ]);
    const items = await enrichSuppressions(rows);

    res.json({
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      summary: { total: all, unsubscribe, complaint, last30Days: recent },
      sources: groupedSources.map(item => ({ value: item.source ?? 'unknown', count: item._count._all })),
      scopes: groupedScopes.map(item => ({ value: item.scope, label: emailSuppressionScopeLabel(item.scope), count: item._count._all })),
    });
  } catch (error) {
    console.error('[email-suppressions] list failed', error);
    res.status(500).json({ error: 'Erro ao buscar descadastros' });
  }
});

// Emails enviados via Resend por lead
router.get('/sent/lead/:leadEmail', async (req: Request, res: Response) => {
  try {
    const emails = await prisma.emailSent.findMany({
      where:   { leadEmail: req.params.leadEmail },
      orderBy: { sentAt: 'desc' },
      take:    100,
      include: { template: { select: { body: true } } },
    });
    res.json(emails.map(({ template, ...email }) => ({
      ...email,
      // Registros anteriores à captura do HTML ainda podem usar o template.
      htmlBody: email.htmlBody ?? template?.body ?? null,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar emails' });
  }
});

// Emails recebidos via Resend Inbound por lead
router.get('/received/lead/:leadEmail', async (req: Request, res: Response) => {
  try {
    const emails = await prisma.emailReceived.findMany({
      where:   { leadEmail: req.params.leadEmail },
      orderBy: { receivedAt: 'desc' },
      take:    100,
    });
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar emails recebidos' });
  }
});

// Métricas agregadas de emails do sistema (para dashboard)
router.get('/sent/stats', async (_req: Request, res: Response) => {
  try {
    const [total, delivered, opened, clicked, bounced] = await Promise.all([
      prisma.emailSent.count(),
      prisma.emailSent.count({ where: { OR: [{ status: { in: ['delivered', 'opened', 'clicked'] } }, { openedAt: { not: null } }, { clickedAt: { not: null } }] } }),
      prisma.emailSent.count({ where: { OR: [{ openedAt: { not: null } }, { clickedAt: { not: null } }] } }),
      prisma.emailSent.count({ where: { clickedAt: { not: null } } }),
      prisma.emailSent.count({ where: { status: 'bounced' } }),
    ]);

    res.json({
      total,
      delivered,
      opened,
      clicked,
      bounced,
      deliveredRate: total > 0 ? Number((delivered / total * 100).toFixed(1)) : 0,
      openedRate:    delivered > 0 ? Number((opened    / delivered * 100).toFixed(1)) : 0,
      clickedRate:   delivered > 0 ? Number((clicked   / delivered * 100).toFixed(1)) : 0,
      bounceRate:    total > 0 ? Number((bounced / total * 100).toFixed(1)) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
});

export default router;
