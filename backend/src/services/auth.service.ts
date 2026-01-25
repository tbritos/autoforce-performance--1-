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
    throw new Error('Invalid Google client');
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
