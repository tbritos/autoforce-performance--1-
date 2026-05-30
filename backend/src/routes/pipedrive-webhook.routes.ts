import { Router } from 'express';
import { PipedriveWebhookController } from '../controllers/pipedrive-webhook.controller';

const router = Router();

// POST /api/pipedrive-webhook?token=<PIPEDRIVE_WEBHOOK_SECRET>
// Public endpoint — authenticated by query token, no JWT required
router.post('/', PipedriveWebhookController.handle);

export default router;
