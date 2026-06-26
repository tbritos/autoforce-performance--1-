import { Router } from 'express';
import { SegmentController } from '../controllers/segment.controller';

const router = Router();

router.get('/',          SegmentController.list);
router.post('/',         SegmentController.create);
router.post('/preview',  SegmentController.preview);
router.get('/:id',       SegmentController.get);
router.put('/:id',       SegmentController.update);
router.delete('/:id',    SegmentController.remove);
router.get('/:id/leads', SegmentController.leads);

export default router;
