import { Router } from 'express';
import { LeadClassificationRulesController } from '../controllers/lead-classification-rules.controller';

const router = Router();

router.get('/', LeadClassificationRulesController.list);
router.post('/', LeadClassificationRulesController.create);
router.post('/:id/run-existing', LeadClassificationRulesController.runExistingLeads);
router.patch('/:id', LeadClassificationRulesController.update);
router.delete('/:id', LeadClassificationRulesController.remove);

export default router;
