import { Router } from 'express';
import { createSessionToken, verifyAuthToken, verifyGoogleToken } from '../services/auth.service';

const router = Router();

router.post('/dev-login', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    res.status(403).json({ error: 'Only available in development' });
    return;
  }
  res.json({
    user: {
      email: 'dev@autoforce.com',
      name: 'Dev Local',
      avatar: 'https://ui-avatars.com/api/?name=Dev+Local&background=1440FF&color=fff',
      role: 'AutoForce Member',
    },
  });
});

router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body as { credential?: string };
    if (!credential) {
      res.status(400).json({ error: 'Missing credential' });
      return;
    }
    const user = await verifyGoogleToken(credential);
    const token = createSessionToken(user);
    res.json({ user, token });
  } catch (error) {
    next(error);
  }
});

router.post('/google/redirect', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
  try {
    const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
    if (!credential) {
      res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent('Missing credential')}`);
      return;
    }

    const user = await verifyGoogleToken(credential);
    const token = createSessionToken(user);
    const params = new URLSearchParams({
      auth_token: token,
      auth_user: JSON.stringify(user),
    });
    res.redirect(`${frontendUrl}/?${params.toString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google login failed';
    res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent(message)}`);
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

    if (process.env.NODE_ENV === 'development' && token === 'dev-local-bypass') {
      res.json({
        user: {
          email: 'dev@autoforce.com',
          name: 'Dev Local',
          avatar: 'https://ui-avatars.com/api/?name=Dev+Local&background=1440FF&color=fff',
          role: 'AutoForce Member',
        },
      });
      return;
    }

    const user = await verifyAuthToken(token);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
