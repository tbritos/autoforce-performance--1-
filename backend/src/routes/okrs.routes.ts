import { Router } from 'express';
import { getOKRs, saveOKR, updateOKR, deleteOKR } from '../controllers/okrs.controller';

const router = Router();

router.get('/', getOKRs);
router.post('/', saveOKR);
router.put('/:id', updateOKR);
router.delete('/:id', deleteOKR);

export default router;
