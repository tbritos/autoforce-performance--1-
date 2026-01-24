import { Router } from 'express';
import { getRevenueHistory, saveRevenueEntry } from '../controllers/revenue.controller';

const router = Router();

router.get('/transactions', getRevenueHistory);
router.post('/transactions', saveRevenueEntry);

export default router;
