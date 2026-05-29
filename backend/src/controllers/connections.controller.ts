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

function getEnvStatus(platform: (typeof VALID_PLATFORMS)[number]): 'CONNECTED' | 'DISCONNECTED' {
  switch (platform) {
    case 'RD_STATION':
      return (process.env.RD_STATION_REFRESH_TOKEN || process.env.RD_STATION_ACCESS_TOKEN) ? 'CONNECTED' : 'DISCONNECTED';
    case 'META_ADS':
      return process.env.META_ACCESS_TOKEN ? 'CONNECTED' : 'DISCONNECTED';
    case 'PIPEDRIVE':
      return (process.env.PIPEDRIVE_API_TOKEN && process.env.PIPEDRIVE_DOMAIN) ? 'CONNECTED' : 'DISCONNECTED';
    case 'GOOGLE_ANALYTICS':
      return (process.env.GA4_CREDENTIALS_JSON || process.env.GA4_CREDENTIALS_PATH) ? 'CONNECTED' : 'DISCONNECTED';
    case 'GOOGLE_ADS':
      return process.env.GOOGLE_ADS_CUSTOMER_ID ? 'CONNECTED' : 'DISCONNECTED';
    default:
      return 'DISCONNECTED';
  }
}

export class ConnectionsController {

  // GET /api/connections
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const connections = await PlatformConnectionService.listConnections();
      const map = new Map(connections.map((c: { platform: string; [k: string]: unknown }) => [c.platform, c]));
      const result = VALID_PLATFORMS.map(p => {
        if (map.has(p)) return map.get(p);
        const envStatus = getEnvStatus(p);
        return {
          platform: p,
          status: envStatus,
          accountId: null,
          accountName: null,
          lastSyncAt: null,
          syncCount: 0,
        };
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
