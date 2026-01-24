import { Router } from 'express';
import { getEmailCampaigns, createEmailCampaign, updateEmailCampaign, deleteEmailCampaign } from '../controllers/email.controller';

const router = Router();

router.get('/campaigns', getEmailCampaigns);
router.post('/campaigns', createEmailCampaign);
router.put('/campaigns/:id', updateEmailCampaign);
router.delete('/campaigns/:id', deleteEmailCampaign);

export default router;
