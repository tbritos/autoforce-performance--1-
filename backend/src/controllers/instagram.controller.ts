import { Request, Response, NextFunction } from 'express';
import {
  handleInstagramWebhook,
  getInstagramWebhookStatus,
  verifyInstagramWebhookSignature,
  verifyInstagramWebhookToken,
} from '../services/instagram-webhook.service';
import {
  deleteInstagramUserData,
  getInstagramDataDeletionStatus,
  parseInstagramDataDeletionSignedRequest,
} from '../services/instagram-data-deletion.service';

type RequestWithRawBody = Request & { rawBody?: Buffer };

export class InstagramController {
  static async requestDataDeletion(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = parseInstagramDataDeletionSignedRequest(req.body?.signed_request);
      const result = await deleteInstagramUserData(userId);
      res.status(200).json({
        url: result.statusUrl,
        confirmation_code: result.confirmationCode,
      });
    } catch (error) {
      if (error instanceof Error && /signed_request|assinatura|algoritmo|user_id/.test(error.message)) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  }

  static async dataDeletionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const status = await getInstagramDataDeletionStatus(code);
      if (!status) {
        res.status(404).send('<!doctype html><meta charset="utf-8"><title>Pedido não encontrado</title><h1>Pedido não encontrado</h1>');
        return;
      }
      res.status(200).send(`<!doctype html>
        <html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Exclusão de dados do Instagram</title></head>
        <body style="font-family:system-ui,sans-serif;max-width:680px;margin:60px auto;padding:0 20px;color:#17233c">
          <h1>Exclusão de dados concluída</h1>
          <p>Os dados associados à conexão do Instagram foram removidos do AutoChat.</p>
          <p><strong>Código de confirmação:</strong> ${status.confirmationCode}</p>
          <p><strong>Status:</strong> concluído</p>
        </body></html>`);
    } catch (error) {
      next(error);
    }
  }

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
