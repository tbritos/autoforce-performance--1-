import { Router } from 'express';
import { getDailyLeads, saveDailyLead } from '../controllers/leads.controller';

const router = Router();

// Rota para buscar o histórico (GET /api/leads/daily)
router.get('/daily', getDailyLeads);

// Rota para salvar um novo dia (POST /api/leads/daily)
router.post('/daily', saveDailyLead);

export default router;