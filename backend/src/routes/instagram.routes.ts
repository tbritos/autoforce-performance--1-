import { Router } from 'express';
import { InstagramController } from '../controllers/instagram.controller';

const router = Router();

router.post('/data-deletion', InstagramController.requestDataDeletion);
router.get('/data-deletion/status', InstagramController.dataDeletionStatus);
router.get('/webhook/status', InstagramController.webhookStatus);
router.get('/webhook', InstagramController.verifyWebhook);
router.post('/webhook', InstagramController.receiveWebhook);

export default router;
