import { Router } from 'express';
import { LeadScoringController } from '../controllers/lead-scoring.controller';

const router = Router();

router.get('/',                LeadScoringController.list);
router.post('/',               LeadScoringController.create);
router.post('/install-recommended', LeadScoringController.installRecommended);
router.post('/apply-existing', LeadScoringController.applyExisting);
router.get('/:id',             LeadScoringController.get);
router.put('/:id',              LeadScoringController.update);
router.delete('/:id',          LeadScoringController.remove);

export default router;
