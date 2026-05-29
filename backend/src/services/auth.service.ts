import jwt from 'jsonwebtoken';

type GoogleTokenInfo = {
  aud: string;
  email: string;
  email_verified: string;
  name?: string;
  picture?: string;
  hd?: string;
};

export type AuthUser = {
  email: string;
  name: string;
  avatar: string;
  role: string;
};

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const DEFAULT_SESSION_EXPIRES_IN = '30d';

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET nao configurado. Defina JWT_SECRET nas variaveis de ambiente.');
  }
  return secret;
}

export const verifyGoogleToken = async (token: string): Promise<AuthUser> => {
  if (!token) {
    throw new Error('Missing Google token');
  }

  const response = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${token}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token error: ${text}`);
  }

  const data = (await response.json()) as GoogleTokenInfo;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN || 'autoforce.com';

  if (!clientId || data.aud !== clientId) {
    throw new Error(`Invalid Google client: aud="${data.aud}" expected="${clientId}"`);
  }

  if (data.email_verified !== 'true') {
    throw new Error('Email not verified');
  }

  if (!data.email || !data.email.endsWith(`@${allowedDomain}`)) {
    throw new Error('Email domain not allowed');
  }

  return {
    email: data.email,
    name: data.name || data.email.split('@')[0],
    avatar: data.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.email)}`,
    role: 'AutoForce Member',
  };
};

export const createSessionToken = (user: AuthUser): string => {
  const expiresIn = (process.env.AUTH_SESSION_EXPIRES_IN || DEFAULT_SESSION_EXPIRES_IN) as jwt.SignOptions['expiresIn'];

  return jwt.sign(
    {
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
    },
    getSessionSecret(),
    {
      expiresIn,
      issuer: 'autoforce-performance',
      audience: 'autoforce-performance-users',
    }
  );
};

export const verifySessionToken = (token: string): AuthUser => {
  const payload = jwt.verify(token, getSessionSecret(), {
    issuer: 'autoforce-performance',
    audience: 'autoforce-performance-users',
  }) as jwt.JwtPayload;

  if (typeof payload.email !== 'string') {
    throw new Error('Invalid session token');
  }

  return {
    email: payload.email,
    name: typeof payload.name === 'string' ? payload.name : payload.email.split('@')[0],
    avatar: typeof payload.avatar === 'string' ? payload.avatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.email)}`,
    role: typeof payload.role === 'string' ? payload.role : 'AutoForce Member',
  };
};

export const verifyAuthToken = async (token: string): Promise<AuthUser> => {
  try {
    return verifySessionToken(token);
  } catch {
    // Transitional fallback for users who still have a Google ID token saved locally.
    return verifyGoogleToken(token);
  }
};
