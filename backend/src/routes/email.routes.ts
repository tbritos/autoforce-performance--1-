import { Router } from 'express';
import { getEmailCampaigns, createEmailCampaign, updateEmailCampaign, deleteEmailCampaign, getRdEmailCampaigns, syncRdEmailCampaigns, getRdWorkflowEmailStats, syncRdWorkflowEmailStats, getSyncLogs } from '../controllers/email.controller';

const router = Router();

router.get('/campaigns', getEmailCampaigns);
router.get('/campaigns/rdstation', getRdEmailCampaigns);
router.get('/campaigns/rdstation/sync', syncRdEmailCampaigns);
router.get('/automation/rdstation', getRdWorkflowEmailStats);
router.get('/automation/rdstation/sync', syncRdWorkflowEmailStats);
router.get('/sync/logs', getSyncLogs);
router.post('/campaigns', createEmailCampaign);
router.put('/campaigns/:id', updateEmailCampaign);
router.delete('/campaigns/:id', deleteEmailCampaign);

export default router;
