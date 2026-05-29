import { Router } from 'express';
import { FunnelController } from '../controllers/funnel.controller';

const router = Router();

// GET  /api/funnels        — list all active funnels
// POST /api/funnels        — create a funnel
router.get('/',    FunnelController.list);
router.post('/',   FunnelController.create);

// GET  /api/funnels/stats  — computed stats with optional UTM filters
router.get('/stats', FunnelController.stats);

// PATCH  /api/funnels/:id  — update a funnel
// DELETE /api/funnels/:id  — soft-delete a funnel
router.patch('/:id',  FunnelController.update);
router.delete('/:id', FunnelController.remove);

export default router;
