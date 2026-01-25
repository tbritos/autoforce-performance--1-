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

router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await verifyGoogleToken(token);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
