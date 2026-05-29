import { Router } from 'express';
import { UTMDestinationsController } from '../controllers/utm-destinations.controller';

const router = Router();

router.get('/',     UTMDestinationsController.list);
router.post('/',    UTMDestinationsController.create);
router.delete('/:id', UTMDestinationsController.remove);

export default router;
