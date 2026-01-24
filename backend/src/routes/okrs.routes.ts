import { Router } from 'express';
import { getOKRs, saveOKR } from '../controllers/okrs.controller';

const router = Router();

router.get('/', getOKRs);
router.post('/', saveOKR);

export default router;
