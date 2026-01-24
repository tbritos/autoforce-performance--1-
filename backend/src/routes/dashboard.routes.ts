import { Router } from 'express';
import { getDashboardMetrics, getPerformanceHistory } from '../controllers/dashboard.controller';

const router = Router();

// GET /api/dashboard/metrics
router.get('/metrics', getDashboardMetrics);

// GET /api/dashboard/history
router.get('/history', getPerformanceHistory);

export default router;
