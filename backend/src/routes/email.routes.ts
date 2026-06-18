import { Router } from 'express';
import { Request, Response } from 'express';
import { getEmailCampaigns, createEmailCampaign, updateEmailCampaign, deleteEmailCampaign, getRdEmailCampaigns, syncRdEmailCampaigns, getRdWorkflowEmailStats, syncRdWorkflowEmailStats, getSyncLogs, getRdContactFields } from '../controllers/email.controller';
import { prisma } from '../config/database';

const router = Router();

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

// Emails enviados via Resend por lead
router.get('/sent/lead/:leadEmail', async (req: Request, res: Response) => {
  try {
    const emails = await prisma.emailSent.findMany({
      where:   { leadEmail: req.params.leadEmail },
      orderBy: { sentAt: 'desc' },
      take:    100,
    });
    res.json(emails);
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
