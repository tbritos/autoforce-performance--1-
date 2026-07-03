import { Router } from 'express';
import { AutomationJourneysController } from '../controllers/automation-journeys.controller';

const router = Router();

router.get('/', AutomationJourneysController.list);
router.post('/', AutomationJourneysController.create);
router.get('/:id/executions', AutomationJourneysController.getExecutions);
router.get('/:id/execution-stats', AutomationJourneysController.getExecutionStats);
router.post('/:id/test', AutomationJourneysController.testRun);
router.post('/:id/reprocess-segment', AutomationJourneysController.reprocessSegment);
router.patch('/:id', AutomationJourneysController.update);
router.delete('/:id', AutomationJourneysController.remove);

export default router;
