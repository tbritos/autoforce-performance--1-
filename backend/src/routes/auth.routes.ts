import { Router } from 'express';
import { verifyGoogleToken } from '../services/auth.service';

const router = Router();

router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body as { credential?: string };
    if (!credential) {
      res.status(400).json({ error: 'Missing credential' });
      return;
    }
    const user = await verifyGoogleToken(credential);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
