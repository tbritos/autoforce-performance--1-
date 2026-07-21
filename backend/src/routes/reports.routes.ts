import { Router } from 'express';
import { ReportsController } from '../controllers/reports.controller';

const router = Router();

// GET  /api/reports/metrics        — catálogo de métricas disponíveis
// POST /api/reports/query-metric   — roda uma métrica ao vivo (usado pelos widgets)
router.get('/metrics', ReportsController.metrics);
router.get('/field-values', ReportsController.fieldValues);
router.post('/query-metric', ReportsController.queryMetric);
router.post('/drill-down', ReportsController.drillDown);

// CRUD de relatórios
router.get('/', ReportsController.list);
router.post('/', ReportsController.create);
router.get('/:id', ReportsController.get);
router.patch('/:id', ReportsController.update);
router.delete('/:id', ReportsController.remove);
router.patch('/:id/favorite', ReportsController.toggleFavorite);
router.patch('/:id/privacy', ReportsController.updatePrivacy);

export default router;
