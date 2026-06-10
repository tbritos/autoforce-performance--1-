import { Router } from 'express';
import { AIAgentsController } from '../controllers/ai-agents.controller';

const router = Router();

router.get('/knowledge', AIAgentsController.listKnowledge);
router.post('/knowledge', AIAgentsController.createKnowledge);
router.patch('/knowledge/:id', AIAgentsController.updateKnowledge);
router.delete('/knowledge/:id', AIAgentsController.removeKnowledge);

router.get('/logs', AIAgentsController.listLogs);
router.get('/memories', AIAgentsController.listMemories);

router.get('/', AIAgentsController.listAgents);
router.post('/', AIAgentsController.createAgent);
router.get('/:id', AIAgentsController.getAgent);
router.patch('/:id', AIAgentsController.updateAgent);
router.delete('/:id', AIAgentsController.removeAgent);

export default router;
