import { Request, Response, NextFunction } from 'express';
import { WebhookLeadsService } from '../services/webhook-leads.service';

const getWebhookTokenFromRequest = (req: Request) => {
  const fromHeader =
    (req.headers['x-webhook-token'] as string | undefined) ||
    (req.headers['x-leads-webhook-token'] as string | undefined);

  const fromQuery = typeof req.query.token === 'string' ? req.query.token : undefined;
  return fromHeader || fromQuery;
};

export const listWebhookLeads = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

    const leads = await WebhookLeadsService.listLeads({ startDate, endDate });
    res.json(leads);
  } catch (error) {
    console.error('Error listing webhook leads:', error);
    next(error);
  }
};

export const receiveLeadsWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const expectedToken = process.env.LEADS_WEBHOOK_TOKEN;
    if (expectedToken) {
      const providedToken = getWebhookTokenFromRequest(req);
      if (!providedToken || providedToken !== expectedToken) {
        res.status(401).json({ error: 'Invalid webhook token' });
        return;
      }
    }

    const result = await WebhookLeadsService.ingestWebhook(req.body);
    res.status(202).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error('Error receiving leads webhook:', error);
    next(error);
  }
};
