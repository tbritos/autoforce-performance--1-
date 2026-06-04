import { Router, Request, Response, NextFunction } from 'express';
import { createSessionToken, verifyAuthToken, verifyGoogleToken } from '../services/auth.service';

const router = Router();

const SESSION_COOKIE = 'af_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

function setSessionCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    // cross-origin (Vercel → Railway) requires sameSite: 'none' with secure: true
    sameSite: isProd ? 'none' : 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

function clearSessionCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });
}

router.post('/dev-login', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    res.status(403).json({ error: 'Only available in development' });
    return;
  }
  const devUser = {
    email: 'dev@autoforce.com',
    name: 'Dev Local',
    avatar: 'https://ui-avatars.com/api/?name=Dev+Local&background=1440FF&color=fff',
    role: 'AutoForce Member',
  };
  const token = createSessionToken(devUser);
  setSessionCookie(res, token);
  res.json({ user: devUser });
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
    setSessionCookie(res, token);
    // FIX: token no longer returned in response body — only in httpOnly cookie
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.post('/google/redirect', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
  try {
    const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
    if (!credential) {
      res.redirect(`${frontendUrl}/#auth?auth_error=${encodeURIComponent('Missing credential')}`);
      return;
    }

    const user = await verifyGoogleToken(credential);
    const token = createSessionToken(user);
    setSessionCookie(res, token);
    // FIX: only user info in URL — token travels via httpOnly cookie
    const params = new URLSearchParams({ auth_user: JSON.stringify(user) });
    res.redirect(`${frontendUrl}/#auth?${params.toString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google login failed';
    res.redirect(`${frontendUrl}/#auth?auth_error=${encodeURIComponent(message)}`);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    // FIX: read token from httpOnly cookie first, fallback to Authorization header
    const cookieToken = (req.cookies as Record<string, string | undefined>)?.[SESSION_COOKIE];
    const authHeader = req.headers.authorization || '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const token = cookieToken || headerToken;

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

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

export default router;
