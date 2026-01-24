import { Router } from 'express';
import { getCampaigns, createCampaign, updateCampaign, deleteCampaign } from '../controllers/campaigns.controller';

const router = Router();

router.get('/', getCampaigns);
router.post('/', createCampaign);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

export default router;
