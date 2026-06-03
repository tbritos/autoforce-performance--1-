import { Router, Request, Response, NextFunction } from 'express';
import { fetchPipedriveStages } from '../services/pipedrive.service';

const router = Router();

// GET /api/pipedrive/stages
router.get('/stages', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stages = await fetchPipedriveStages();
    res.json(stages);
  } catch (err) {
    next(err);
  }
});

export default router;
