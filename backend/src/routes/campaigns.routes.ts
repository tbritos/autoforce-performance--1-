import { Router } from 'express';
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign, getMetaCampaigns } from '../controllers/campaigns.controller';

const router = Router();

router.get('/', getCampaigns);
router.get('/meta', getMetaCampaigns);
router.post('/', createCampaign);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

export default router;
