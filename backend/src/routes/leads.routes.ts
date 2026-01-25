import { Router } from 'express';
import { getDailyLeads, saveDailyLead, updateDailyLead, deleteDailyLead } from '../controllers/leads.controller';

const router = Router();

// Rota para buscar o histórico (GET /api/leads/daily)
router.get('/daily', getDailyLeads);

// Rota para salvar um novo dia (POST /api/leads/daily)
router.post('/daily', saveDailyLead);

// Atualizar e remover registros (PUT/DELETE /api/leads/daily/:id)
router.put('/daily/:id', updateDailyLead);
router.delete('/daily/:id', deleteDailyLead);

export default router;
