import crypto from 'crypto';
import { Platform } from '@prisma/client';
import { PlatformConnectionService } from './platform-connection.service';

// ============================================================
// OAuth Service — handles all platform authorization flows
//
// Supported platforms:
//   META_ADS      → Facebook OAuth 2.0
//   GOOGLE_ADS    → Google OAuth 2.0 (shared with GA4 + Calendar)
//   GOOGLE_ANALYTICS → Google OAuth 2.0
//   GOOGLE_CALENDAR  → Google OAuth 2.0
//   RD_STATION    → RD Station OAuth 2.0
// ============================================================

const APP_URL = process.env.APP_URL || 'http://localhost:5000';

function withNgrokSkipParam(url: string): string {
  if (!url.includes('ngrok-free.')) return url;
  const parsed = new URL(url);
  parsed.searchParams.set('ngrok-skip-browser-warning', 'true');
  return parsed.toString();
}

// In-memory CSRF state store (use Redis in production for multi-instance)
const pendingStates = new Map<string, { platform: Platform; createdAt: number }>();

function generateState(platform: Platform): string {
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, { platform, createdAt: Date.now() });
  // Clean up states older than 10 minutes
  for (const [key, value] of pendingStates.entries()) {
    if (Date.now() - value.createdAt > 10 * 60 * 1000) {
      pendingStates.delete(key);
    }
  }
  return state;
}

function consumeState(state: string): Platform | null {
  const entry = pendingStates.get(state);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > 10 * 60 * 1000) {
    pendingStates.delete(state);
    return null;
  }
  pendingStates.delete(state);
  return entry.platform;
}

// ============================================================
// META ADS OAuth
// Required env vars: META_APP_ID, META_APP_SECRET
// ============================================================

const META_API_VERSION = 'v19.0';
const META_SCOPES = ['ads_read', 'ads_management', 'pages_read_engagement'].join(',');

function getMetaAuthUrl(): string {
  const clientId = process.env.META_APP_ID;
  if (!clientId) throw new Error('META_APP_ID não configurado no .env');

  const state = generateState('META_ADS');
  const redirectUri = encodeURIComponent(withNgrokSkipParam(`${APP_URL}/api/connections/META_ADS/callback`));

  return (
    `https://www.facebook.com/${META_API_VERSION}/dialog/oauth` +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&scope=${encodeURIComponent(META_SCOPES)}` +
    `&state=${state}` +
    `&response_type=code`
  );
}

async function handleMetaCallback(code: string): Promise<void> {
  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;
  if (!clientId || !clientSecret) throw new Error('META_APP_ID e META_APP_SECRET não configurados');

  const redirectUri = withNgrokSkipParam(`${APP_URL}/api/connections/META_ADS/callback`);

  // Exchange code for long-lived token
  const tokenUrl =
    `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token` +
    `?client_id=${clientId}` +
    `&client_secret=${clientSecret}` +
    `&code=${code}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  const res = await fetch(tokenUrl);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta token error: ${text}`);
  }

  const data = (await res.json()) as { access_token: string; token_type: string; expires_in?: number };

  // Exchange short-lived token for long-lived (60 days)
  const longLivedUrl =
    `https://graph.facebook.com/${META_API_VERSION}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${clientId}` +
    `&client_secret=${clientSecret}` +
    `&fb_exchange_token=${data.access_token}`;

  const longRes = await fetch(longLivedUrl);
  const longData = (await longRes.json()) as { access_token: string; expires_in?: number };
  const finalToken = longData.access_token || data.access_token;

  // Fetch ad account info
  const meUrl = `https://graph.facebook.com/${META_API_VERSION}/me?fields=id,name&access_token=${finalToken}`;
  const meRes = await fetch(meUrl);
  const me = (await meRes.json()) as { id?: string; name?: string };

  const expiry = longData.expires_in
    ? new Date(Date.now() + longData.expires_in * 1000)
    : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days fallback

  await PlatformConnectionService.saveConnection({
    platform: 'META_ADS',
    accountId: me.id,
    accountName: me.name,
    accessToken: finalToken,
    tokenExpiry: expiry,
    metadata: { adAccountId: process.env.META_AD_ACCOUNT_ID },
  });
}

async function getMetaToken(): Promise<string> {
  const tokens = await PlatformConnectionService.getTokens('META_ADS');
  if (tokens?.accessToken) {
    // Meta long-lived tokens don't auto-refresh — warn if close to expiry
    if (tokens.tokenExpiry && tokens.tokenExpiry < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
      console.warn('Meta token expira em menos de 7 dias — reconecte a conta no painel de Conexões');
    }
    return tokens.accessToken;
  }
  // Fallback to .env
  const envToken = process.env.META_ACCESS_TOKEN;
  if (envToken) return envToken;
  throw new Error('Meta Ads não conectado. Configure no painel de Conexões.');
}

// ============================================================
// GOOGLE OAuth (GA4 + Google Ads + Calendar — shared flow)
// Required env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// ============================================================

const GOOGLE_SCOPES_BY_PLATFORM: Partial<Record<Platform, string[]>> = {
  GOOGLE_ANALYTICS: [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
  GOOGLE_ADS: [
    'https://www.googleapis.com/auth/adwords',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
  GOOGLE_CALENDAR: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
};

function getGoogleAuthUrl(platform: Platform): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID não configurado no .env');

  const state = generateState(platform);
  const redirectUri = encodeURIComponent(`${APP_URL}/api/connections/${platform}/callback`);
  const scopes = (GOOGLE_SCOPES_BY_PLATFORM[platform] || []).join(' ');

  return (
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${state}` +
    `&response_type=code` +
    `&access_type=offline` +
    `&prompt=consent`
  );
}

async function exchangeGoogleCode(code: string, platform: Platform): Promise<void> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados');

  const redirectUri = `${APP_URL}/api/connections/${platform}/callback`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token error: ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type: string;
  };

  // Fetch user info
  const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const info = (await infoRes.json()) as { email?: string; name?: string };

  const expiry = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : undefined;

  // Save the token only for the Google product that completed OAuth.
  const metadata: Record<string, unknown> = {};
  if (platform === 'GOOGLE_ANALYTICS') {
    metadata.propertyId = process.env.GA4_PROPERTY_ID;
    metadata.propertyIds = process.env.GA4_PROPERTY_IDS || process.env.GA4_PROPERTY_ID;
  }
  if (platform === 'GOOGLE_CALENDAR') {
    metadata.calendarId = process.env.GOOGLE_CALENDAR_ID || info.email;
  }

  await PlatformConnectionService.saveConnection({
    platform,
    accountId: info.email,
    accountName: info.name || info.email,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiry: expiry,
    metadata,
  });
}

async function refreshGoogleToken(platform: Platform): Promise<string> {
  const tokens = await PlatformConnectionService.getTokens(platform);
  if (!tokens?.refreshToken) throw new Error(`Google refresh token não encontrado para ${platform}`);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET não configurados');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    await PlatformConnectionService.markError(platform, `Token refresh failed: ${text}`);
    throw new Error(`Google token refresh error: ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  const expiry = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined;

  await PlatformConnectionService.saveConnection({
    platform,
    accessToken: data.access_token,
    refreshToken: tokens.refreshToken,
    tokenExpiry: expiry,
  });

  return data.access_token;
}

async function getGoogleToken(platform: Platform): Promise<string> {
  const tokens = await PlatformConnectionService.getTokens(platform);

  if (tokens?.accessToken) {
    // Refresh if token is expired or expires in next 5 minutes
    const isExpired = tokens.tokenExpiry && tokens.tokenExpiry < new Date(Date.now() + 5 * 60 * 1000);
    if (isExpired && tokens.refreshToken) {
      return refreshGoogleToken(platform);
    }
    return tokens.accessToken;
  }

  // Fallback: try to get a token using service account (GA4 only)
  if (platform === 'GOOGLE_ANALYTICS') {
    return getGoogleServiceAccountToken();
  }

  throw new Error(`${platform} não conectado. Configure no painel de Conexões.`);
}

async function getGoogleServiceAccountToken(): Promise<string> {
  const { google } = await import('googleapis');
  const credentialsJson = process.env.GA4_CREDENTIALS_JSON;
  const credentialsPath = process.env.GA4_CREDENTIALS_PATH;

  if (!credentialsJson && !credentialsPath) {
    throw new Error('Google Analytics não conectado. Configure no painel de Conexões.');
  }

  const auth = credentialsJson
    ? new google.auth.GoogleAuth({
        credentials: JSON.parse(credentialsJson),
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      })
    : new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
      });

  const client = await auth.getClient();
  const tokenResponse = await (client as any).getAccessToken();
  return tokenResponse.token as string;
}

// ============================================================
// RD STATION OAuth
// Required env vars: RD_STATION_CLIENT_ID, RD_STATION_CLIENT_SECRET
// ============================================================

function getRdAuthUrl(): string {
  const clientId = process.env.RD_STATION_CLIENT_ID;
  if (!clientId) throw new Error('RD_STATION_CLIENT_ID não configurado no .env');

  const state = generateState('RD_STATION');
  const redirectUri = encodeURIComponent(`${APP_URL}/api/connections/RD_STATION/callback`);

  return (
    `https://api.rd.services/auth/dialog` +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&state=${state}`
  );
}

async function handleRdCallback(code: string): Promise<void> {
  const clientId = process.env.RD_STATION_CLIENT_ID;
  const clientSecret = process.env.RD_STATION_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('RD_STATION_CLIENT_ID e RD_STATION_CLIENT_SECRET não configurados');

  const res = await fetch('https://api.rd.services/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RD Station token error: ${text}`);
  }

  const data = (await res.json()) as { access_token: string; refresh_token: string; expires_in?: number };

  const expiry = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);

  await PlatformConnectionService.saveConnection({
    platform: 'RD_STATION',
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiry: expiry,
    metadata: { workspaceId: process.env.RD_STATION_WORKSPACE_ID },
  });
}

async function getRdToken(): Promise<string> {
  const tokens = await PlatformConnectionService.getTokens('RD_STATION');

  if (tokens?.accessToken) {
    const isExpired = tokens.tokenExpiry && tokens.tokenExpiry < new Date(Date.now() + 5 * 60 * 1000);
    if (!isExpired) return tokens.accessToken;

    // Refresh using stored refresh token
    if (tokens.refreshToken) {
      return refreshRdToken(tokens.refreshToken);
    }
  }

  // Fallback to .env refresh token
  const envRefresh = process.env.RD_STATION_REFRESH_TOKEN;
  if (envRefresh) {
    return refreshRdToken(envRefresh);
  }

  const envDirect = process.env.RD_STATION_ACCESS_TOKEN;
  if (envDirect) return envDirect;

  throw new Error('RD Station não conectado. Configure no painel de Conexões.');
}

async function refreshRdToken(refreshToken: string): Promise<string> {
  const clientId = process.env.RD_STATION_CLIENT_ID;
  const clientSecret = process.env.RD_STATION_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('RD Station credentials not configured');

  const res = await fetch('https://api.rd.services/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    await PlatformConnectionService.markError('RD_STATION', `Token refresh failed: ${text}`);
    throw new Error(`RD token refresh error: ${text}`);
  }

  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  const expiry = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined;

  await PlatformConnectionService.saveConnection({
    platform: 'RD_STATION',
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    tokenExpiry: expiry,
  });

  return data.access_token;
}

// ============================================================
// PIPEDRIVE — API Token (simpler than OAuth for internal use)
// Required env vars: PIPEDRIVE_API_TOKEN, PIPEDRIVE_DOMAIN
// OAuth 2.0 also supported when PIPEDRIVE_CLIENT_ID is set.
// ============================================================

function getPipedriveAuthUrl(): string {
  const clientId = process.env.PIPEDRIVE_CLIENT_ID;
  if (!clientId) throw new Error('PIPEDRIVE_CLIENT_ID não configurado no .env');

  const state = generateState('PIPEDRIVE');
  const redirectUri = encodeURIComponent(`${APP_URL}/api/connections/PIPEDRIVE/callback`);

  return (
    `https://oauth.pipedrive.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&state=${state}`
  );
}

async function handlePipedriveCallback(code: string): Promise<void> {
  const clientId     = process.env.PIPEDRIVE_CLIENT_ID;
  const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('PIPEDRIVE_CLIENT_ID e PIPEDRIVE_CLIENT_SECRET não configurados');

  const redirectUri = `${APP_URL}/api/connections/PIPEDRIVE/callback`;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://oauth.pipedrive.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pipedrive token error: ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    api_domain?: string;
  };

  const domain = data.api_domain?.replace('https://', '').replace('.pipedrive.com', '') || process.env.PIPEDRIVE_DOMAIN || '';
  const expiry = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined;

  await PlatformConnectionService.saveConnection({
    platform: 'PIPEDRIVE',
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiry: expiry,
    metadata: { domain, authType: 'oauth' },
  });
}

async function getPipedriveToken(): Promise<string> {
  const tokens = await PlatformConnectionService.getTokens('PIPEDRIVE');
  if (tokens?.accessToken) return tokens.accessToken;

  const envToken = process.env.PIPEDRIVE_API_TOKEN;
  if (envToken) return envToken;

  throw new Error('Pipedrive não conectado. Configure em Integrações ou adicione PIPEDRIVE_API_TOKEN no .env');
}

// ============================================================
// Public API
// ============================================================

export const OAuthService = {
  getAuthUrl(platform: Platform): string {
    switch (platform) {
      case 'META_ADS':         return getMetaAuthUrl();
      case 'GOOGLE_ADS':       return getGoogleAuthUrl('GOOGLE_ADS');
      case 'GOOGLE_ANALYTICS': return getGoogleAuthUrl('GOOGLE_ANALYTICS');
      case 'GOOGLE_CALENDAR':  return getGoogleAuthUrl('GOOGLE_CALENDAR');
      case 'RD_STATION':       return getRdAuthUrl();
      case 'PIPEDRIVE':        return getPipedriveAuthUrl();
      default: throw new Error(`Platform ${platform} não suporta OAuth`);
    }
  },

  async handleCallback(platform: Platform, code: string, state: string): Promise<void> {
    const expectedPlatform = consumeState(state);
    if (!expectedPlatform) throw new Error('State OAuth inválido ou expirado');
    if (expectedPlatform !== platform) throw new Error('State OAuth não corresponde à plataforma');

    switch (platform) {
      case 'META_ADS':
        return handleMetaCallback(code);
      case 'GOOGLE_ADS':
      case 'GOOGLE_ANALYTICS':
      case 'GOOGLE_CALENDAR':
        return exchangeGoogleCode(code, platform);
      case 'RD_STATION':
        return handleRdCallback(code);
      case 'PIPEDRIVE':
        return handlePipedriveCallback(code);
      default:
        throw new Error(`Callback OAuth não implementado para ${platform}`);
    }
  },

  async getValidToken(platform: Platform): Promise<string> {
    switch (platform) {
      case 'META_ADS':         return getMetaToken();
      case 'GOOGLE_ADS':       return getGoogleToken('GOOGLE_ADS');
      case 'GOOGLE_ANALYTICS': return getGoogleToken('GOOGLE_ANALYTICS');
      case 'GOOGLE_CALENDAR':  return getGoogleToken('GOOGLE_CALENDAR');
      case 'RD_STATION':       return getRdToken();
      case 'PIPEDRIVE':        return getPipedriveToken();
      default: throw new Error(`Platform ${platform} não suportado`);
    }
  },
};
