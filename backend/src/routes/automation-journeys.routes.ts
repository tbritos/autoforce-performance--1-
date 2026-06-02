import { Router } from 'express';
import { AutomationJourneysController } from '../controllers/automation-journeys.controller';

const router = Router();

router.get('/', AutomationJourneysController.list);
router.post('/', AutomationJourneysController.create);
router.patch('/:id', AutomationJourneysController.update);
router.delete('/:id', AutomationJourneysController.remove);

export default router;
