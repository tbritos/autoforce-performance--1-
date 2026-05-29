import { Router } from 'express';
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign, getMetaCampaigns, getGoogleAdsCampaigns } from '../controllers/campaigns.controller';

const router = Router();

router.get('/', getCampaigns);
router.get('/meta', getMetaCampaigns);
router.get('/google', getGoogleAdsCampaigns);
router.post('/', createCampaign);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

export default router;
