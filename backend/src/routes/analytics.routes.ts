import { Router } from 'express';
import { getLandingPages, getGA4Totals, syncGA4, getClarityData, testClarity } from '../controllers/analytics.controller';

const router = Router();

router.get('/landing-pages',      getLandingPages);
router.get('/ga4/totals',         getGA4Totals);
router.post('/sync-ga4',          syncGA4);
router.get('/clarity/metrics',    getClarityData);
router.get('/clarity/test',       testClarity);

export default router;
