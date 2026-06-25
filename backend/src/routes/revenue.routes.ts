import { Router } from 'express';
import { getRevenueHistory, saveRevenueEntry, updateRevenueEntry, deleteRevenueEntry, searchLeads } from '../controllers/revenue.controller';

const router = Router();

router.get('/transactions', getRevenueHistory);
router.get('/leads/search', searchLeads);
router.post('/transactions', saveRevenueEntry);
router.put('/transactions/:id', updateRevenueEntry);
router.delete('/transactions/:id', deleteRevenueEntry);

export default router;
