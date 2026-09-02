import { Router } from 'express';
import { AutomationJourneysController } from '../controllers/automation-journeys.controller';

const router = Router();

router.get('/', AutomationJourneysController.list);
router.post('/', AutomationJourneysController.create);
router.get('/nurture-groups', AutomationJourneysController.listNurtureGroups);
router.post('/nurture-groups', AutomationJourneysController.createNurtureGroup);
router.patch('/nurture-groups/:id', AutomationJourneysController.updateNurtureGroup);
router.get('/:id/executions', AutomationJourneysController.getExecutions);
router.get('/:id/execution-stats', AutomationJourneysController.getExecutionStats);
router.post('/:id/test', AutomationJourneysController.testRun);
router.post('/:id/reprocess-segment', AutomationJourneysController.reprocessSegment);
router.post('/:id/reprocess-conversion', AutomationJourneysController.reprocessConversion);
router.get('/:id/conversion-delivery-report', AutomationJourneysController.conversionDeliveryReport);
router.patch('/:id', AutomationJourneysController.update);
router.delete('/:id', AutomationJourneysController.remove);

export default router;
