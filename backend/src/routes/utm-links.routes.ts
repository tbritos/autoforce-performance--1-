import { Router } from 'express';
import { UTMLinksController } from '../controllers/utm-links.controller';

const router = Router();

// GET  /api/utm-links            — paginated list with filters
// POST /api/utm-links            — create a new UTM link
router.get('/',  UTMLinksController.list);
router.post('/', UTMLinksController.create);

// GET /api/utm-links/templates   — list saved templates
router.get('/templates', UTMLinksController.templates);

// GET /api/utm-links/campaigns   — campaign picker for the builder
router.get('/campaigns', UTMLinksController.campaigns);

// PATCH  /api/utm-links/:id/favorite  — toggle favorite
// DELETE /api/utm-links/:id           — soft delete
router.patch('/:id/favorite', UTMLinksController.toggleFavorite);
router.delete('/:id', UTMLinksController.remove);

export default router;
