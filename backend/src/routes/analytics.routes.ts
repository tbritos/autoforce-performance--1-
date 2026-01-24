import { Router } from 'express';
import { getLandingPages, syncGA4 } from '../controllers/analytics.controller';

const router = Router();

router.get('/landing-pages', getLandingPages);
router.post('/sync-ga4', syncGA4); // Endpoint para forçar sincronização

export default router;
