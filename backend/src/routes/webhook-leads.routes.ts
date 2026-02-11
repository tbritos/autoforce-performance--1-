import { Router } from 'express';
import {
  listWebhookLeads,
  receiveLeadsWebhook,
} from '../controllers/webhook-leads.controller';

const router = Router();

router.get('/leads', listWebhookLeads);
router.post('/leads', receiveLeadsWebhook);

export default router;
