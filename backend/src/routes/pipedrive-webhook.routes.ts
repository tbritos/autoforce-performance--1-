import { Router } from 'express';
import cors from 'cors';
import { PipedriveWebhookController } from '../controllers/pipedrive-webhook.controller';

const router = Router();

const pipedriveCors = cors({ origin: '*', methods: ['POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] });

// POST /api/pipedrive-webhook?token=<PIPEDRIVE_WEBHOOK_SECRET>
// Public endpoint — authenticated by query token, no JWT required
router.options('/', pipedriveCors);
router.post('/', pipedriveCors, PipedriveWebhookController.handle);

export default router;
