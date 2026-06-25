import { Router } from 'express';
import { getRevenueHistory, saveRevenueEntry, updateRevenueEntry, deleteRevenueEntry, searchLeads, linkLead } from '../controllers/revenue.controller';

const router = Router();

router.get('/transactions', getRevenueHistory);
router.get('/leads/search', searchLeads);
router.post('/transactions', saveRevenueEntry);
router.put('/transactions/:id', updateRevenueEntry);
router.patch('/transactions/:id/lead', linkLead);
router.delete('/transactions/:id', deleteRevenueEntry);

export default router;
