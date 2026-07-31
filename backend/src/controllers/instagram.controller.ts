import { Request, Response, NextFunction } from 'express';
import {
  handleInstagramWebhook,
  getInstagramWebhookStatus,
  verifyInstagramWebhookSignature,
  verifyInstagramWebhookToken,
} from '../services/instagram-webhook.service';

type RequestWithRawBody = Request & { rawBody?: Buffer };

export class InstagramController {
  static async webhookStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!verifyInstagramWebhookToken(req.header('x-webhook-verify-token'))) {
        res.status(401).json({ error: 'Invalid Instagram webhook status token' });
        return;
      }

      const status = await getInstagramWebhookStatus();
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  }

  static verifyWebhook(req: Request, res: Response) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && verifyInstagramWebhookToken(token)) {
      res.status(200).send(String(challenge ?? ''));
      return;
    }

    res.status(403).json({ error: 'Invalid Instagram webhook verification token' });
  }

  static async receiveWebhook(req: RequestWithRawBody, res: Response, next: NextFunction) {
    try {
      const signature = req.header('x-hub-signature-256') || undefined;
      if (!req.rawBody || !verifyInstagramWebhookSignature(req.rawBody, signature)) {
        res.status(401).json({ error: 'Invalid Instagram webhook signature' });
        return;
      }

      const result = await handleInstagramWebhook(req.body);
      res.status(200).json({ ok: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
