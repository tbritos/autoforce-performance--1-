import crypto from 'crypto';
import { Platform } from '@prisma/client';
import { PlatformConnectionService } from './platform-connection.service';
import { getInstagramAppId, getInstagramAppSecret } from './instagram-env.service';

// ============================================================
// OAuth Service — handles all platform authorization flows
//
// Supported platforms:
//   META_ADS      → Facebook OAuth 2.0
//   INSTAGRAM     → Instagram Login for professional accounts
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

// Instagram uses a signed, stateless OAuth state so the callback keeps working
// across Railway restarts and multiple backend instances.
function generateInstagramState(): string {
  const secret = getInstagramAppSecret();
  if (!secret) throw new Error('INSTAGRAM_APP_SECRET não configurado no .env');

  const payload = Buffer.from(JSON.stringify({
    platform: 'INSTAGRAM',
    nonce: crypto.randomBytes(16).toString('hex'),
    expiresAt: Date.now() + 10 * 60 * 1000,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function consumeInstagramState(state: string): boolean {
  const secret = getInstagramAppSecret();
  if (!secret) return false;

  const [payload, receivedSignature] = state.split('.');
  if (!payload || !receivedSignature) return false;

  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest();
  let received: Buffer;
  try {
    received = Buffer.from(receivedSignature, 'base64url');
  } catch {
    return false;
  }
  if (received.length !== expectedSignature.length || !crypto.timingSafeEqual(received, expectedSignature)) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      platform?: string;
      expiresAt?: number;
    };
    return decoded.platform === 'INSTAGRAM'
      && typeof decoded.expiresAt === 'number'
      && decoded.expiresAt >= Date.now();
  } catch {
    return false;
  }
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
// INSTAGRAM OAuth — Instagram API with Instagram Login
// Required env vars: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET
// ============================================================

const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
].join(',');

export const INSTAGRAM_WEBHOOK_FIELDS = ['messages'] as const;

function getInstagramRedirectUri(): string {
  // Read at request time because dotenv is initialized by server.ts after imports.
  const appUrl = process.env.APP_URL || APP_URL;
  return withNgrokSkipParam(`${appUrl}/api/connections/INSTAGRAM/callback`);
}

function getInstagramGraphApiVersion(): string {
  return process.env.INSTAGRAM_GRAPH_API_VERSION || 'v24.0';
}

export function buildInstagramWebhookSubscriptionUrl(
  accountId: string,
  graphApiVersion = getInstagramGraphApiVersion(),
): URL {
  const url = new URL(`https://graph.instagram.com/${graphApiVersion}/${encodeURIComponent(accountId)}/subscribed_apps`);
  url.searchParams.set('subscribed_fields', INSTAGRAM_WEBHOOK_FIELDS.join(','));
  return url;
}

function getInstagramAuthUrl(): string {
  const clientId = getInstagramAppId();
  if (!clientId) throw new Error('INSTAGRAM_APP_ID não configurado no .env');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getInstagramRedirectUri(),
    response_type: 'code',
    scope: INSTAGRAM_SCOPES,
    state: generateInstagramState(),
    enable_fb_login: '0',
    force_authentication: '1',
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

async function instagramJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const raw = await response.text();
  let data: T & { error?: { message?: string }; error_message?: string };
  try {
    data = JSON.parse(raw) as T & { error?: { message?: string }; error_message?: string };
  } catch {
    throw new Error(`Instagram respondeu HTTP ${response.status} sem JSON válido`);
  }
  if (!response.ok || data.error || data.error_message) {
    const detail = data.error?.message || data.error_message || `HTTP ${response.status}`;
    throw new Error(`Instagram OAuth: ${detail}`);
  }
  return data;
}

async function handleInstagramCallback(rawCode: string): Promise<void> {
  const clientId = getInstagramAppId();
  const clientSecret = getInstagramAppSecret();
  if (!clientId || !clientSecret) {
    throw new Error('INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET não configurados');
  }

  // Instagram can append "#_" to the authorization code in some redirects.
  const code = rawCode.replace(/#_$/, '');
  const shortToken = await instagramJson<{
    access_token: string;
    user_id: number | string;
    permissions?: string[];
  }>('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: getInstagramRedirectUri(),
      code,
    }).toString(),
  });

  const longTokenUrl = new URL('https://graph.instagram.com/access_token');
  longTokenUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longTokenUrl.searchParams.set('client_secret', clientSecret);
  longTokenUrl.searchParams.set('access_token', shortToken.access_token);
  const longToken = await instagramJson<{ access_token: string; token_type?: string; expires_in?: number }>(
    longTokenUrl.toString(),
  );

  const accessToken = longToken.access_token || shortToken.access_token;
  const graphApiVersion = getInstagramGraphApiVersion();
  const profileUrl = new URL(`https://graph.instagram.com/${graphApiVersion}/me`);
  profileUrl.searchParams.set('fields', 'user_id,username');
  const profile = await instagramJson<{ id?: string; user_id?: string; username?: string }>(
    profileUrl.toString(),
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const accountId = String(profile.user_id || profile.id || shortToken.user_id);
  if (!accountId) throw new Error('Instagram não retornou o ID da conta profissional');

  const expiry = longToken.expires_in
    ? new Date(Date.now() + longToken.expires_in * 1000)
    : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  await PlatformConnectionService.saveConnection({
    platform: 'INSTAGRAM',
    accountId,
    accountName: profile.username ? `@${profile.username}` : `Instagram ${accountId}`,
    accessToken,
    tokenExpiry: expiry,
    metadata: {
      username: profile.username || null,
      authType: 'instagram_login',
      graphApiVersion,
      permissions: shortToken.permissions || INSTAGRAM_SCOPES.split(','),
      webhookSubscription: 'not_started',
    },
  });

  try {
    await ensureInstagramWebhookSubscription();
  } catch (error) {
    // A autorização da conta continua válida; a interface mostra o erro de eventos
    // e uma nova inicialização tenta a assinatura novamente.
    console.error('[instagram] Conta conectada, mas a assinatura do webhook falhou:', error);
  }
}

async function getInstagramToken(): Promise<string> {
  const tokens = await PlatformConnectionService.getTokens('INSTAGRAM');
  if (!tokens?.accessToken) {
    throw new Error('Instagram não conectado. Configure a conta no AutoChat.');
  }
  if (tokens.tokenExpiry && tokens.tokenExpiry <= new Date()) {
    await PlatformConnectionService.updateConnectionConfig({ platform: 'INSTAGRAM', status: 'EXPIRED' });
    throw new Error('Token do Instagram expirado. Reconecte a conta no AutoChat.');
  }
  return tokens.accessToken;
}

async function updateInstagramWebhookMetadata(patch: Record<string, unknown>): Promise<void> {
  const connection = await PlatformConnectionService.getInternalConnection('INSTAGRAM');
  const metadata = connection?.metadata
    && typeof connection.metadata === 'object'
    && !Array.isArray(connection.metadata)
    ? connection.metadata as Record<string, unknown>
    : {};
  await PlatformConnectionService.updateConnectionConfig({
    platform: 'INSTAGRAM',
    metadata: { ...metadata, ...patch },
  });
}

async function ensureInstagramWebhookSubscription(): Promise<{
  active: true;
  fields: string[];
}> {
  const connection = await PlatformConnectionService.getInternalConnection('INSTAGRAM');
  if (!connection?.accountId || connection.status !== 'CONNECTED') {
    throw new Error('Instagram não conectado para ativar os eventos');
  }

  const accessToken = await getInstagramToken();
  const url = buildInstagramWebhookSubscriptionUrl(connection.accountId);

  try {
    const result = await instagramJson<{ success?: boolean }>(url.toString(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (result.success !== true) {
      throw new Error('Instagram não confirmou a assinatura de eventos');
    }

    const subscribedAt = new Date().toISOString();
    await updateInstagramWebhookMetadata({
      webhookSubscription: 'active',
      webhookFields: [...INSTAGRAM_WEBHOOK_FIELDS],
      webhookSubscribedAt: subscribedAt,
      webhookSubscriptionError: null,
    });
    return { active: true, fields: [...INSTAGRAM_WEBHOOK_FIELDS] };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida ao assinar eventos';
    await updateInstagramWebhookMetadata({
      webhookSubscription: 'error',
      webhookSubscriptionError: message,
      webhookSubscriptionAttemptedAt: new Date().toISOString(),
    });
    throw error;
  }
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
      case 'INSTAGRAM':        return getInstagramAuthUrl();
      case 'GOOGLE_ADS':       return getGoogleAuthUrl('GOOGLE_ADS');
      case 'GOOGLE_ANALYTICS': return getGoogleAuthUrl('GOOGLE_ANALYTICS');
      case 'GOOGLE_CALENDAR':  return getGoogleAuthUrl('GOOGLE_CALENDAR');
      case 'RD_STATION':       return getRdAuthUrl();
      case 'PIPEDRIVE':        return getPipedriveAuthUrl();
      default: throw new Error(`Platform ${platform} não suporta OAuth`);
    }
  },

  async handleCallback(platform: Platform, code: string, state: string): Promise<void> {
    if (platform === 'INSTAGRAM') {
      if (!consumeInstagramState(state)) throw new Error('State OAuth inválido ou expirado');
    } else {
      const expectedPlatform = consumeState(state);
      if (!expectedPlatform) throw new Error('State OAuth inválido ou expirado');
      if (expectedPlatform !== platform) throw new Error('State OAuth não corresponde à plataforma');
    }

    switch (platform) {
      case 'META_ADS':
        return handleMetaCallback(code);
      case 'INSTAGRAM':
        return handleInstagramCallback(code);
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
      case 'INSTAGRAM':        return getInstagramToken();
      case 'GOOGLE_ADS':       return getGoogleToken('GOOGLE_ADS');
      case 'GOOGLE_ANALYTICS': return getGoogleToken('GOOGLE_ANALYTICS');
      case 'GOOGLE_CALENDAR':  return getGoogleToken('GOOGLE_CALENDAR');
      case 'RD_STATION':       return getRdToken();
      case 'PIPEDRIVE':        return getPipedriveToken();
      default: throw new Error(`Platform ${platform} não suportado`);
    }
  },

  ensureInstagramWebhookSubscription,
};
