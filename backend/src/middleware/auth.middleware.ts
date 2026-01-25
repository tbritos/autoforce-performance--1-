import { Request, Response, NextFunction } from 'express';
import { verifyGoogleToken } from '../services/auth.service';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.path === '/health' || req.path.startsWith('/auth')) {
      next();
      return;
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await verifyGoogleToken(token);
    (req as Request & { user?: typeof user }).user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
