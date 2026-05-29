import { Router } from 'express';
import { ConnectionsController } from '../controllers/connections.controller';

const router = Router();

// GET  /api/connections                          — lista todas as plataformas e status
router.get('/', ConnectionsController.list);
router.get('/requirements', ConnectionsController.requirements);

// GET  /api/connections/:platform/auth-url       — URL para iniciar OAuth
router.get('/:platform/auth-url', ConnectionsController.getAuthUrl);

// GET  /api/connections/:platform/callback       — callback OAuth (abre em popup)
router.get('/:platform/callback', ConnectionsController.callback);

// POST /api/connections/:platform/disconnect     — desconectar plataforma
router.post('/:platform/disconnect', ConnectionsController.disconnect);
router.put('/:platform/config', ConnectionsController.updateConfig);

// POST /api/connections/:platform/sync           — forçar sync manual
router.post('/:platform/sync', ConnectionsController.triggerSync);

// POST /api/connections/migrate-env              — migrar tokens do .env para o banco
router.post('/migrate-env', ConnectionsController.migrateFromEnv);

export default router;
