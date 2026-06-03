import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';

const router = Router();

router.get('/templates', WhatsAppController.getTemplates);

export default router;
