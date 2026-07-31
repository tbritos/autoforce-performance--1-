import { Router } from 'express';
import { InstagramController } from '../controllers/instagram.controller';

const router = Router();

router.get('/webhook', InstagramController.verifyWebhook);
router.post('/webhook', InstagramController.receiveWebhook);

export default router;
