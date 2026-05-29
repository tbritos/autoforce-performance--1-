import { Request, Response, NextFunction } from 'express';
import { Platform } from '@prisma/client';
import { OAuthService } from '../services/oauth.service';
import { PlatformConnectionService } from '../services/platform-connection.service';

const VALID_PLATFORMS = [
  'META_ADS', 'GOOGLE_ADS', 'GOOGLE_ANALYTICS', 'RD_STATION', 'PIPEDRIVE', 'CLARITY',
] as const satisfies readonly Platform[];

function parsePlatform(raw: string): Platform | null {
  return VALID_PLATFORMS.includes(raw as (typeof VALID_PLATFORMS)[number]) ? (raw as Platform) : null;
}

const OAUTH_ENV_REQUIREMENTS: Record<(typeof VALID_PLATFORMS)[number], string[]> = {
  META_ADS:          ['META_APP_ID', 'META_APP_SECRET', 'APP_URL'],
  GOOGLE_ADS:        ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ADS_DEVELOPER_TOKEN', 'APP_URL'],
  GOOGLE_ANALYTICS:  ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'APP_URL'],
  RD_STATION:        ['RD_STATION_CLIENT_ID', 'RD_STATION_CLIENT_SECRET', 'APP_URL'],
  PIPEDRIVE:         ['PIPEDRIVE_CLIENT_ID', 'PIPEDRIVE_CLIENT_SECRET', 'APP_URL'],
  CLARITY:           [], // API key — sem OAuth
};

async function testPlatformConnection(platform: Platform): Promise<{ ok: boolean; message: string }> {
  try {
    const token = await OAuthService.getValidToken(platform);

    switch (platform) {
      case 'META_ADS': {
        const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${token}`);
        const data = await res.json() as { name?: string; error?: { message: string } };
        if ((data as any).error) return { ok: false, message: (data as any).error.message };
        return { ok: true, message: `Conectado como ${data.name || 'conta desconhecida'}` };
      }

      case 'RD_STATION': {
        const res = await fetch('https://api.rd.services/platform/contacts?page=1&page_size=1', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          let detail = '';
          try { detail = await res.text(); } catch { /* ignore */ }
          return { ok: false, message: `HTTP ${res.status} — ${detail.slice(0, 200) || 'sem detalhes'}` };
        }
        return { ok: true, message: 'RD Station respondendo normalmente' };
      }

      case 'PIPEDRIVE': {
        const apiToken = process.env.PIPEDRIVE_API_TOKEN;
        const domain = process.env.PIPEDRIVE_DOMAIN || 'api';
        const url = apiToken
          ? `https://${domain}.pipedrive.com/v1/users/me?api_token=${apiToken}`
          : `https://api.pipedrive.com/v1/users/me`;
        const headers: Record<string, string> = apiToken ? {} : { Authorization: `Bearer ${token}` };
        const res = await fetch(url, { headers });
        const data = await res.json() as { success?: boolean; data?: { name?: string }; error?: string };
        if (!data.success) return { ok: false, message: data.error || 'Falha ao autenticar no Pipedrive' };
        return { ok: true, message: `Conectado como ${data.data?.name || 'usuário desconhecido'}` };
      }

      case 'GOOGLE_ANALYTICS': {
        const rawPropertyId = process.env.GA4_PROPERTY_ID;
        if (!rawPropertyId) return { ok: false, message: 'GA4_PROPERTY_ID não configurado no Railway' };
        const propertyId = rawPropertyId.split(',')[0].trim();
        const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}/metadata`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { ok: false, message: `HTTP ${res.status} — verifique as credenciais do GA4` };
        return { ok: true, message: `Google Analytics (property ${propertyId}) OK` };
      }

      case 'GOOGLE_ADS': {
        const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
        const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
        if (!customerId) return { ok: false, message: 'GOOGLE_ADS_CUSTOMER_ID não configurado no Railway' };
        if (!devToken) return { ok: false, message: 'GOOGLE_ADS_DEVELOPER_TOKEN não configurado no Railway' };
        const res = await fetch(`https://googleads.googleapis.com/v17/customers/${customerId}`, {
          headers: { Authorization: `Bearer ${token}`, 'developer-token': devToken },
        });
        if (!res.ok) return { ok: false, message: `HTTP ${res.status} — verifique o developer token e customer ID` };
        return { ok: true, message: `Google Ads (customer ${customerId}) OK` };
      }

      default:
        return { ok: false, message: 'Teste não implementado para esta plataforma' };
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}

// Returns true if this platform has credentials in env vars worth trying
function hasEnvCredentials(platform: (typeof VALID_PLATFORMS)[number]): boolean {
  switch (platform) {
    case 'RD_STATION':      return !!(process.env.RD_STATION_REFRESH_TOKEN || process.env.RD_STATION_ACCESS_TOKEN);
    case 'META_ADS':        return !!process.env.META_ACCESS_TOKEN;
    case 'PIPEDRIVE':       return !!(process.env.PIPEDRIVE_API_TOKEN && process.env.PIPEDRIVE_DOMAIN);
    case 'GOOGLE_ANALYTICS':return !!(process.env.GA4_CREDENTIALS_JSON || process.env.GA4_CREDENTIALS_PATH);
    case 'GOOGLE_ADS':      return !!(process.env.GOOGLE_ADS_CUSTOMER_ID && process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
    default:                return false;
  }
}

export class ConnectionsController {

  // GET /api/connections
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const connections = await PlatformConnectionService.listConnections();
      const map = new Map(connections.map((c: { platform: string; [k: string]: unknown }) => [c.platform, c]));
      const result = VALID_PLATFORMS.map(p => map.get(p) || {
        platform: p,
        status: 'DISCONNECTED',
        accountId: null,
        accountName: null,
        lastSyncAt: null,
        syncCount: 0,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // GET /api/connections/:platform/auth-url
  static async getAuthUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const platform = parsePlatform(req.params.platform);
      if (!platform) { res.status(400).json({ error: 'Plataforma inválida' }); return; }
      const url = OAuthService.getAuthUrl(platform);
      res.json({ url });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/connections/requirements
  static async requirements(req: Request, res: Response, next: NextFunction) {
    try {
      const result = VALID_PLATFORMS.map(platform => {
        const requiredEnv = OAUTH_ENV_REQUIREMENTS[platform];
        let missingEnv = requiredEnv.filter(name => !process.env[name] || !String(process.env[name]).trim());
        let readyForOAuth = missingEnv.length === 0;

        if (platform === 'PIPEDRIVE' && process.env.PIPEDRIVE_API_TOKEN && process.env.PIPEDRIVE_DOMAIN) {
          missingEnv = [];
          readyForOAuth = true;
        }

        return {
          platform,
          requiredEnv,
          missingEnv,
          readyForOAuth,
        };
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // GET /api/connections/:platform/callback  (OAuth callback)
  static async callback(req: Request, res: Response, next: NextFunction) {
    try {
      const platform = parsePlatform(req.params.platform);
      if (!platform) { res.status(400).send('Plataforma inválida'); return; }

      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const state = typeof req.query.state === 'string' ? req.query.state : '';
      const error = typeof req.query.error === 'string' ? req.query.error : '';

      if (error) {
        res.send(`<html><body><script>window.opener?.postMessage({type:'oauth_error',platform:'${platform}',error:'${error}'},'*');window.close();</script>Erro: ${error}</body></html>`);
        return;
      }

      if (!code || !state) { res.status(400).send('Parâmetros OAuth ausentes'); return; }

      await OAuthService.handleCallback(platform, code, state);

      // Close the popup and notify the parent window
      res.send(`
        <html>
          <body>
            <p>Conectado com sucesso! Esta janela vai fechar automaticamente.</p>
            <script>
              window.opener?.postMessage({ type: 'oauth_success', platform: '${platform}' }, '*');
              setTimeout(() => window.close(), 1500);
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      res.send(`<html><body><script>window.opener?.postMessage({type:'oauth_error',platform:'${req.params.platform}',error:'${message}'},'*');window.close();</script>Erro: ${message}</body></html>`);
    }
  }

  // POST /api/connections/:platform/disconnect
  static async disconnect(req: Request, res: Response, next: NextFunction) {
    try {
      const platform = parsePlatform(req.params.platform);
      if (!platform) { res.status(400).json({ error: 'Plataforma inválida' }); return; }
      const result = await PlatformConnectionService.disconnectPlatform(platform);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // PUT /api/connections/:platform/config
  static async updateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const platform = parsePlatform(req.params.platform);
      if (!platform) { res.status(400).json({ error: 'Plataforma invalida' }); return; }

      const body = req.body as {
        accountId?: string;
        accountName?: string;
        extraIds?: string[];
        accessToken?: string;
        refreshToken?: string;
        tokenExpiry?: string;
        metadata?: Record<string, unknown>;
      };

      const current = await PlatformConnectionService.getInternalConnection(platform);
      const currentMetadata = (current?.metadata ?? {}) as Record<string, unknown>;
      const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? { ...currentMetadata, ...body.metadata }
        : currentMetadata;

      const accessToken = typeof body.accessToken === 'string' && body.accessToken.trim()
        ? body.accessToken.trim()
        : undefined;
      const refreshToken = typeof body.refreshToken === 'string' && body.refreshToken.trim()
        ? body.refreshToken.trim()
        : undefined;
      const tokenExpiry = body.tokenExpiry ? new Date(body.tokenExpiry) : undefined;
      const existingTokens = await PlatformConnectionService.getTokens(platform);

      const hasToken = Boolean(accessToken || refreshToken || existingTokens?.accessToken || existingTokens?.refreshToken);
      const hasServiceAccount = (platform === 'GOOGLE_ANALYTICS' || platform === 'GOOGLE_CALENDAR')
        && Boolean(metadata.serviceAccountJson || metadata.serviceAccountPath);
      const shouldBeConnected = hasToken || hasServiceAccount;

      const result = await PlatformConnectionService.updateConnectionConfig({
        platform,
        accountId: body.accountId,
        accountName: body.accountName,
        extraIds: Array.isArray(body.extraIds) ? body.extraIds : undefined,
        accessToken,
        refreshToken,
        tokenExpiry,
        metadata,
        status: shouldBeConnected ? 'CONNECTED' : (current?.status as any) || 'DISCONNECTED',
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/connections/:platform/sync
  static async triggerSync(req: Request, res: Response, next: NextFunction) {
    try {
      const platform = parsePlatform(req.params.platform);
      if (!platform) { res.status(400).json({ error: 'Plataforma inválida' }); return; }

      const { triggerSync } = await import('../services/sync-scheduler.service');
      const result = await triggerSync(platform);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/connections/:platform/test  — verifica conexão real com a plataforma
  static async testConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const platform = parsePlatform(req.params.platform);
      if (!platform) { res.status(400).json({ error: 'Plataforma inválida' }); return; }
      const result = await testPlatformConnection(platform);
      // Persist result to DB so the status badge reflects reality
      if (result.ok) {
        await PlatformConnectionService.updateConnectionConfig({ platform, status: 'CONNECTED' });
      } else {
        await PlatformConnectionService.markError(platform, result.message);
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/connections/migrate-env  — one-time migration of .env tokens to DB
  static async migrateFromEnv(req: Request, res: Response, next: NextFunction) {
    try {
      const results: Record<string, string> = {};

      // RD Station
      const rdRefresh = process.env.RD_STATION_REFRESH_TOKEN;
      const rdDirect = process.env.RD_STATION_ACCESS_TOKEN;
      if (rdRefresh || rdDirect) {
        await PlatformConnectionService.saveConnection({
          platform: 'RD_STATION',
          accessToken: rdDirect,
          refreshToken: rdRefresh,
          metadata: { workspaceId: process.env.RD_STATION_WORKSPACE_ID },
        });
        results.RD_STATION = 'migrado';
      } else {
        results.RD_STATION = 'sem credenciais no .env';
      }

      // Meta Ads
      const metaToken = process.env.META_ACCESS_TOKEN;
      const metaAccountId = process.env.META_AD_ACCOUNT_ID;
      if (metaToken) {
        await PlatformConnectionService.saveConnection({
          platform: 'META_ADS',
          accessToken: metaToken,
          metadata: { adAccountId: metaAccountId },
        });
        results.META_ADS = 'migrado';
      } else {
        results.META_ADS = 'sem credenciais no .env';
      }

      // Google Analytics (service account — stored in metadata)
      const ga4Json = process.env.GA4_CREDENTIALS_JSON;
      const ga4Path = process.env.GA4_CREDENTIALS_PATH;
      const ga4Property = process.env.GA4_PROPERTY_ID;
      const ga4Properties = process.env.GA4_PROPERTY_IDS || ga4Property;
      if (ga4Json || ga4Path) {
        await PlatformConnectionService.saveConnection({
          platform: 'GOOGLE_ANALYTICS',
          metadata: {
            propertyId: ga4Property,
            propertyIds: ga4Properties,
            serviceAccountJson: ga4Json || null,
            serviceAccountPath: ga4Path || null,
          },
        });
        results.GOOGLE_ANALYTICS = 'migrado (service account)';
      } else {
        results.GOOGLE_ANALYTICS = 'sem credenciais no .env';
      }

      // Google Ads (OAuth token + account metadata)
      const googleAdsCustomerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
      if (googleAdsCustomerId) {
        await PlatformConnectionService.saveConnection({
          platform: 'GOOGLE_ADS',
          metadata: { customerId: googleAdsCustomerId },
        });
        results.GOOGLE_ADS = 'metadata migrada; conecte OAuth Google para sincronizar';
      } else {
        results.GOOGLE_ADS = 'sem GOOGLE_ADS_CUSTOMER_ID no .env';
      }

      // Google Calendar (OAuth or service account metadata)
      const calendarId = process.env.GOOGLE_CALENDAR_ID;
      const calendarJson = process.env.GOOGLE_CALENDAR_CREDENTIALS_JSON || process.env.GA4_CREDENTIALS_JSON;
      const calendarPath = process.env.GOOGLE_CALENDAR_CREDENTIALS_PATH || process.env.GA4_CREDENTIALS_PATH;
      if (calendarId || calendarJson || calendarPath) {
        await PlatformConnectionService.saveConnection({
          platform: 'GOOGLE_CALENDAR',
          metadata: {
            calendarId: calendarId || null,
            serviceAccountJson: calendarJson || null,
            serviceAccountPath: calendarPath || null,
          },
        });
        results.GOOGLE_CALENDAR = 'metadata migrada';
      } else {
        results.GOOGLE_CALENDAR = 'sem credenciais no .env';
      }

      // Pipedrive (API token legacy path)
      const pipedriveToken = process.env.PIPEDRIVE_API_TOKEN;
      const pipedriveDomain = process.env.PIPEDRIVE_DOMAIN;
      if (pipedriveToken && pipedriveDomain) {
        await PlatformConnectionService.saveConnection({
          platform: 'PIPEDRIVE',
          accessToken: pipedriveToken,
          metadata: { domain: pipedriveDomain, authType: 'api_token' },
        });
        results.PIPEDRIVE = 'migrado';
      } else {
        results.PIPEDRIVE = 'sem PIPEDRIVE_API_TOKEN/PIPEDRIVE_DOMAIN no .env';
      }

      res.json({ message: 'Migracao concluida', results });
    } catch (err) {
      next(err);
    }
  }
}

// Called once on server startup — migrates env var tokens to DB and tests each platform.
// Platforms already with a non-DISCONNECTED DB record are skipped.
export async function startupConnectionCheck(): Promise<void> {
  const platforms = ['META_ADS', 'PIPEDRIVE', 'GOOGLE_ANALYTICS', 'RD_STATION', 'GOOGLE_ADS'] as const;

  for (const platform of platforms) {
    try {
      const existing = await PlatformConnectionService.getInternalConnection(platform);
      if (existing && existing.status !== 'DISCONNECTED') continue;
      if (!hasEnvCredentials(platform)) continue;

      // For API-token platforms, save token to DB before testing
      if (platform === 'PIPEDRIVE') {
        await PlatformConnectionService.saveConnection({ platform, accessToken: process.env.PIPEDRIVE_API_TOKEN!, metadata: { domain: process.env.PIPEDRIVE_DOMAIN, authType: 'api_token' } });
      }
      if (platform === 'META_ADS') {
        await PlatformConnectionService.saveConnection({ platform, accessToken: process.env.META_ACCESS_TOKEN!, metadata: { adAccountId: process.env.META_AD_ACCOUNT_ID } });
      }
      if (platform === 'GOOGLE_ANALYTICS') {
        await PlatformConnectionService.saveConnection({ platform, metadata: { propertyId: process.env.GA4_PROPERTY_ID, serviceAccountJson: process.env.GA4_CREDENTIALS_JSON || null, serviceAccountPath: process.env.GA4_CREDENTIALS_PATH || null } });
      }

      const result = await testPlatformConnection(platform);
      if (result.ok) {
        await PlatformConnectionService.updateConnectionConfig({ platform, status: 'CONNECTED' });
        console.log(`[connections] ${platform}: OK — ${result.message}`);
      } else {
        await PlatformConnectionService.markError(platform, result.message);
        console.log(`[connections] ${platform}: ERRO — ${result.message}`);
      }
    } catch (err) {
      console.error(`[connections] ${platform}: exceção no startup — ${err instanceof Error ? err.message : err}`);
    }
  }
}
