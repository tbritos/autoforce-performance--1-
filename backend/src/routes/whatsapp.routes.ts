import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';

const router = Router();

router.get('/phone-numbers', WhatsAppController.getPhoneNumbers);
router.get('/templates', WhatsAppController.getTemplates);
router.get('/leads/:leadId/conversation', WhatsAppController.getConversation);
router.get('/webhook', WhatsAppController.verifyWebhook);
router.post('/webhook', WhatsAppController.receiveWebhook);

export default router;
