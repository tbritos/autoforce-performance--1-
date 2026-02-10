import { Router } from 'express';
import {
  listSegmentationContacts,
  syncSegmentationContacts,
} from '../controllers/rdleads.controller';

const router = Router();

router.get('/segmentations/:id/contacts', listSegmentationContacts);
router.get('/segmentations/:id/contacts/sync', syncSegmentationContacts);

export default router;
