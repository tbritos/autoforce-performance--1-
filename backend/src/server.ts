import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/error.middleware';
import { authMiddleware } from './middleware/auth.middleware';

// Import routes
import dashboardRoutes from './routes/dashboard.routes';
import leadsRoutes from './routes/leads.routes';
import revenueRoutes from './routes/revenue.routes';
import okrsRoutes from './routes/okrs.routes';
import teamRoutes from './routes/team.routes';
import analyticsRoutes from './routes/analytics.routes';
import calendarRoutes from './routes/calendar.routes';
import campaignsRoutes from './routes/campaigns.routes';
import assetsRoutes from './routes/assets.routes';
import emailRoutes from './routes/email.routes';
import { startSyncScheduler } from './services/sync-scheduler.service';
import { startupConnectionCheck } from './controllers/connections.controller';
import authRoutes from './routes/auth.routes';
import webhookLeadsRoutes from './routes/webhook-leads.routes';
import leadHubRoutes from './routes/lead-hub.routes';
import connectionsRoutes from './routes/connections.routes';
import pipedriveWebhookRoutes from './routes/pipedrive-webhook.routes';
import utmLinksRoutes from './routes/utm-links.routes';
import utmDestinationsRoutes from './routes/utm-destinations.routes';
import funnelRoutes from './routes/funnel.routes';
import { protectedLeadWebhooksRouter, publicLeadWebhooksRouter } from './routes/lead-webhooks.routes';
import leadClassificationRulesRoutes from './routes/lead-classification-rules.routes';

dotenv.config();

// Validação de variáveis de ambiente obrigatórias
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET', 'GOOGLE_CLIENT_ID', 'ENCRYPTION_KEY'] as const;
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`[startup] Variáveis de ambiente ausentes: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Railway (e qualquer reverse proxy) passa o IP real via X-Forwarded-For
app.set('trust proxy', 1);

// Security headers — desabilita CSP pois é uma API REST pura
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Body parsing — antes do CORS para estar disponível no redirect do Google
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Google Sign-In redirect — registrado ANTES do CORS pois o POST vem de accounts.google.com
// O Express processa rotas na ordem de registro; esta captura o request antes do middleware global
app.post('/api/auth/google/redirect', async (req, res) => {
  const { verifyGoogleToken, createSessionToken } = await import('./services/auth.service');
  const frontendUrl = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
  try {
    const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
    if (!credential) {
      res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent('Missing credential')}`);
      return;
    }
    const user = await verifyGoogleToken(credential);
    const token = createSessionToken(user);
    const params = new URLSearchParams({ auth_token: token, auth_user: JSON.stringify(user) });
    res.redirect(`${frontendUrl}/?${params.toString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google login failed';
    res.redirect(`${frontendUrl}/?auth_error=${encodeURIComponent(message)}`);
  }
});

// CORS para todas as outras rotas /api
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}));

// Rate limiting para endpoints de autenticação
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  skip: () => process.env.NODE_ENV === 'development',
});

// Rate limiting para webhooks públicos (sem autenticação)
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de requisições atingido.' },
  skip: () => process.env.NODE_ENV === 'development',
});

// Rate limiting para webhook do Pipedrive (deals mudam com frequência moderada)
const pipedriveWebhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de requisições atingido.' },
  skip: () => process.env.NODE_ENV === 'development',
});

// RD Station OAuth callback helper
app.get('/rdstation/callback', (req, res) => {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const code  = escape(typeof req.query.code  === 'string' ? req.query.code  : '');
  const state = escape(typeof req.query.state === 'string' ? req.query.state : '');

  res.status(200).send(`
    <html>
      <head><title>RD Station OAuth</title></head>
      <body style="font-family: Arial, sans-serif; padding: 24px;">
        <h2>RD Station OAuth</h2>
        <p>Copie o code abaixo e use no POST para gerar o refresh token.</p>
        <pre style="background:#111827;color:#fff;padding:12px;border-radius:8px;">${code || 'code nao encontrado'}</pre>
        ${state ? `<p><strong>state:</strong> ${state}</p>` : ''}
      </body>
    </html>
  `);
});


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'AutoForce Performance API is running' });
});

// Auth routes
app.use('/api/auth', authLimiter, authRoutes);

// Public incoming lead webhooks — sem autenticação, com rate limit
app.use('/api/lead-webhooks', webhookLimiter, publicLeadWebhooksRouter);

// Pipedrive deal webhooks — público, autenticado por query token
app.use('/api/pipedrive-webhook', pipedriveWebhookLimiter, pipedriveWebhookRoutes);

// Public UTM redirect — /r/:code → increment clicks → redirect to fullUrl
app.get('/r/:code', async (req, res) => {
  try {
    const { UTMLinksService } = await import('./services/utm-links.service');
    const fullUrl = await UTMLinksService.incrementClicks(req.params.code);
    if (!fullUrl) { res.status(404).send('Link não encontrado'); return; }
    res.redirect(302, fullUrl);
  } catch {
    res.status(500).send('Erro interno');
  }
});

// ── Admin: backfill de ganhos (one-time, protegido por token) ─────────────────
// Chame: POST /api/admin/backfill-revenue?token=<PIPEDRIVE_WEBHOOK_SECRET>
app.post('/api/admin/backfill-revenue', async (req, res) => {
  const secret = process.env.PIPEDRIVE_WEBHOOK_SECRET;
  if (secret && req.query.token !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token  = process.env.PIPEDRIVE_API_TOKEN ?? '';
  const domain = process.env.PIPEDRIVE_DOMAIN ?? '';
  if (!token || !domain) {
    res.status(500).json({ error: 'PIPEDRIVE_API_TOKEN ou PIPEDRIVE_DOMAIN não configurados.' });
    return;
  }

  // Debug mode: GET /api/admin/backfill-revenue?token=...&debug=1
  // Returns raw first deal to inspect what fields Pipedrive is returning
  if (req.query.debug === '1') {
    const url = new URL(`https://${domain}.pipedrive.com/api/v1/deals`);
    url.searchParams.set('api_token', token);
    url.searchParams.set('pipeline_id', '2');
    url.searchParams.set('status', 'won');
    url.searchParams.set('limit', '1');
    const json = await fetch(url.toString()).then(r => r.json()) as { data: unknown[] | null };
    const deal = json.data?.[0] ?? null;
    if (!deal) { res.json({ error: 'no deals found' }); return; }
    const keys = Object.keys(deal as object);
    const canalKey = '9459f9b49acca8552e69c0ee0898f751b05b4fe6';
    res.json({ canalValue: (deal as Record<string, unknown>)[canalKey], totalKeys: keys.length, sampleKeys: keys.slice(0, 20), deal });
    return;
  }

  try {
    const { PIPEDRIVE_FIELDS, PIPEDRIVE_OPTIONS, resolveSetField, resolveEnumField, extractSetupValue, sourceToOrigin } = await import('./services/pipedrive.service');
    const { prisma } = await import('./config/database');

    const FIELD_CANAL_ORIGEM = '9459f9b49acca8552e69c0ee0898f751b05b4fe6';
    const OPT_CANAL_INBOUND  = 66;

    async function fetchAllWonDeals(pipelineId: number): Promise<Record<string, unknown>[]> {
      const all: Record<string, unknown>[] = [];
      let start = 0;
      while (true) {
        // Use /deals?pipeline_id= (not /pipelines/{id}/deals) — only this endpoint returns custom fields
        const url = new URL(`https://${domain}.pipedrive.com/api/v1/deals`);
        url.searchParams.set('api_token', token);
        url.searchParams.set('pipeline_id', String(pipelineId));
        url.searchParams.set('status', 'won');
        url.searchParams.set('start', String(start));
        url.searchParams.set('limit', '100');
        const json = await fetch(url.toString()).then(r => r.json()) as { success: boolean; data: Record<string, unknown>[] | null; additional_data?: { pagination?: { more_items_in_collection: boolean; next_start?: number } } };
        if (!json.success || !json.data) break;
        all.push(...json.data);
        const p = json.additional_data?.pagination;
        if (!p?.more_items_in_collection) break;
        start = p.next_start ?? start + 100;
      }
      return all;
    }

    const primaryEmail = (emails: Array<{ value: string; primary: boolean }> = []) =>
      emails.find(e => e.primary)?.value || emails[0]?.value || null;

    const [deals2, deals5] = await Promise.all([fetchAllWonDeals(2), fetchAllWonDeals(5)]);
    const allDeals    = [...deals2, ...deals5];
    const inbound     = allDeals.filter(d => Number(d[FIELD_CANAL_ORIGEM]) === OPT_CANAL_INBOUND);
    const inboundIds  = new Set(inbound.map(d => String(d.id)));

    // 1. Remover entradas não-inbound
    const existing = await prisma.revenueEntry.findMany({ where: { id: { startsWith: 'pipedrive-' } }, select: { id: true, businessName: true } });
    const toDelete  = existing.filter(e => !inboundIds.has(e.id.replace('pipedrive-', '')));
    let deleted = 0;
    for (const e of toDelete) {
      await prisma.revenueEntry.delete({ where: { id: e.id } });
      deleted++;
    }

    // 2. Upsert entradas inbound
    let created = 0, updated = 0, skipped = 0, errors = 0;
    const log: string[] = [];

    for (const deal of inbound) {
      const dealId   = String(deal.id);
      const emails   = (deal.person_email ?? (deal.person_id as any)?.email ?? []) as Array<{ value: string; primary: boolean }>;
      const email    = primaryEmail(emails);
      const personId = (deal.person_id as any)?.value ? String((deal.person_id as any).value) : null;

      let lead = email ? await prisma.lead.findUnique({ where: { email: email.toLowerCase().trim() } }) : null;
      if (!lead && personId) lead = await prisma.lead.findFirst({ where: { pipedrivePersonId: personId } });
      if (!lead) { skipped++; log.push(`SKIP #${dealId} ${deal.title} — sem lead`); continue; }

      try {
        const setupVal   = extractSetupValue(deal[PIPEDRIVE_FIELDS.SETUP_VALUE]);
        const produtos   = resolveSetField(deal[PIPEDRIVE_FIELDS.PRODUTO_VENDA],    PIPEDRIVE_OPTIONS.PRODUTO_VENDA);
        const porqueComp = resolveSetField(deal[PIPEDRIVE_FIELDS.PORQUE_COMPROU],   PIPEDRIVE_OPTIONS.PORQUE_COMPROU);
        const fornecedor = resolveSetField(deal[PIPEDRIVE_FIELDS.FORNECEDOR_ATUAL], PIPEDRIVE_OPTIONS.FORNECEDOR_ATUAL);
        const vendedor   = resolveEnumField(deal[PIPEDRIVE_FIELDS.VENDEDOR],        PIPEDRIVE_OPTIONS.VENDEDOR);
        const contrato   = (deal[PIPEDRIVE_FIELDS.CONTRACT_LINK] as string | null) ?? null;
        const dealUrl    = `https://${domain}.pipedrive.com/deal/${dealId}`;
        const biz        = lead.company || (deal.person_name as string | null) || lead.name || lead.email;
        const orig       = sourceToOrigin(lead.firstSource);
        const wonAt      = new Date((deal.won_time || deal.close_time || deal.add_time) as string);

        const prev = await prisma.revenueEntry.findUnique({ where: { id: `pipedrive-${dealId}` } });
        await prisma.revenueEntry.upsert({
          where:  { id: `pipedrive-${dealId}` },
          update: { mrrValue: deal.value as number, setupValue: setupVal, businessName: biz, origin: orig, product: produtos, closedBy: vendedor, whyBought: porqueComp, currentSupplier: fornecedor, contractLink: contrato, dealUrl, updatedAt: new Date() },
          create: { id: `pipedrive-${dealId}`, leadEmail: lead.email, businessName: biz, date: wonAt, setupValue: setupVal, mrrValue: deal.value as number, origin: orig, originType: 'INBOUND', product: produtos, closedBy: vendedor, whyBought: porqueComp, currentSupplier: fornecedor, contractLink: contrato, dealUrl },
        });
        if (prev) { updated++; log.push(`UPDATE #${dealId} ${deal.title}`); }
        else       { created++; log.push(`CREATE #${dealId} ${deal.title}`); }
      } catch (err) {
        errors++;
        log.push(`ERROR #${dealId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    res.json({ ok: true, total: allDeals.length, inbound: inbound.length, deleted, created, updated, skipped, errors, log });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Admin: enriquecer ganhos existentes com dados do Pipedrive ────────────────
// Chame: POST /api/admin/enrich-revenue?token=<PIPEDRIVE_WEBHOOK_SECRET>
// Para cada RevenueEntry já no sistema, busca o deal correspondente no Pipedrive
// pelo nome e atualiza com vendedor, produtos, dealUrl, MRR, etc.
app.post('/api/admin/enrich-revenue', async (req, res) => {
  const secret = process.env.PIPEDRIVE_WEBHOOK_SECRET;
  if (secret && req.query.token !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token  = process.env.PIPEDRIVE_API_TOKEN ?? '';
  const domain = process.env.PIPEDRIVE_DOMAIN ?? '';
  if (!token || !domain) {
    res.status(500).json({ error: 'PIPEDRIVE_API_TOKEN ou PIPEDRIVE_DOMAIN não configurados.' });
    return;
  }

  try {
    const { PIPEDRIVE_FIELDS, PIPEDRIVE_OPTIONS, resolveSetField, resolveEnumField, extractSetupValue } = await import('./services/pipedrive.service');
    const { prisma } = await import('./config/database');

    const FIELD_CANAL_ORIGEM = '9459f9b49acca8552e69c0ee0898f751b05b4fe6';
    const OPT_CANAL_INBOUND  = 66;

    // Normaliza nome para comparação: minúsculas, só alfanumérico
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Busca todos os deals ganhos das pipelines 2 e 5
    async function fetchAllWonDeals(pipelineId: number): Promise<Record<string, unknown>[]> {
      const all: Record<string, unknown>[] = [];
      let start = 0;
      while (true) {
        const url = new URL(`https://${domain}.pipedrive.com/api/v1/deals`);
        url.searchParams.set('api_token', token);
        url.searchParams.set('pipeline_id', String(pipelineId));
        url.searchParams.set('status', 'won');
        url.searchParams.set('start', String(start));
        url.searchParams.set('limit', '100');
        const json = await fetch(url.toString()).then(r => r.json()) as { success: boolean; data: Record<string, unknown>[] | null; additional_data?: { pagination?: { more_items_in_collection: boolean; next_start?: number } } };
        if (!json.success || !json.data) break;
        all.push(...json.data);
        const p = json.additional_data?.pagination;
        if (!p?.more_items_in_collection) break;
        start = p.next_start ?? start + 100;
      }
      return all;
    }

    const [deals2, deals5] = await Promise.all([fetchAllWonDeals(2), fetchAllWonDeals(5)]);
    // Deduplica por deal ID (mesmo deal pode aparecer em mais de uma pipeline)
    const dealMap = new Map<string, Record<string, unknown>>();
    for (const d of [...deals2, ...deals5]) dealMap.set(String(d.id), d);
    const inboundDeals = [...dealMap.values()].filter(d => Number(d[FIELD_CANAL_ORIGEM]) === OPT_CANAL_INBOUND);

    // Busca todos os ganhos do sistema
    const entries = await prisma.revenueEntry.findMany();

    let enriched = 0, notFound = 0, errors = 0;
    const log: string[] = [];

    for (const entry of entries) {
      const entryNorm = norm(entry.businessName);

      // Encontra o deal com maior sobreposição de nome
      const match = inboundDeals.find(d => {
        const dealNorm = norm(String(d.title ?? ''));
        return dealNorm.includes(entryNorm) || entryNorm.includes(dealNorm);
      });

      if (!match) {
        notFound++;
        log.push(`NOT FOUND: "${entry.businessName}"`);
        continue;
      }

      try {
        const dealId     = String(match.id);
        const setupVal   = extractSetupValue(match[PIPEDRIVE_FIELDS.SETUP_VALUE]);
        const produtos   = resolveSetField(match[PIPEDRIVE_FIELDS.PRODUTO_VENDA],    PIPEDRIVE_OPTIONS.PRODUTO_VENDA);
        const porqueComp = resolveSetField(match[PIPEDRIVE_FIELDS.PORQUE_COMPROU],   PIPEDRIVE_OPTIONS.PORQUE_COMPROU);
        const fornecedor = resolveSetField(match[PIPEDRIVE_FIELDS.FORNECEDOR_ATUAL], PIPEDRIVE_OPTIONS.FORNECEDOR_ATUAL);
        const vendedor   = resolveEnumField(match[PIPEDRIVE_FIELDS.VENDEDOR],        PIPEDRIVE_OPTIONS.VENDEDOR);
        const contrato   = (match[PIPEDRIVE_FIELDS.CONTRACT_LINK] as string | null) ?? null;
        const dealUrl    = `https://${domain}.pipedrive.com/deal/${dealId}`;

        await prisma.revenueEntry.update({
          where: { id: entry.id },
          data: {
            mrrValue:        match.value as number,
            setupValue:      setupVal,
            product:         produtos,
            closedBy:        vendedor,
            whyBought:       porqueComp,
            currentSupplier: fornecedor,
            contractLink:    contrato,
            dealUrl,
            updatedAt:       new Date(),
          },
        });

        enriched++;
        log.push(`OK "${entry.businessName}" → deal #${dealId} "${match.title}" | MRR=R$${match.value} Vendedor=${vendedor ?? '-'} Produtos=${produtos.join(', ') || '-'}`);
      } catch (err) {
        errors++;
        log.push(`ERROR "${entry.businessName}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    res.json({ ok: true, total: entries.length, inboundDeals: inboundDeals.length, enriched, notFound, errors, log });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Auth middleware for protected routes
app.use('/api', authMiddleware);

// RD Station OAuth token exchange
app.post('/api/rdstation/token', async (req, res, next) => {
  try {
    const { code } = req.body as { code?: string };
    const clientId = process.env.RD_STATION_CLIENT_ID;
    const clientSecret = process.env.RD_STATION_CLIENT_SECRET;

    if (!code || !clientId || !clientSecret) {
      res.status(400).json({
        error: 'Missing code or RD Station credentials',
      });
      return;
    }

    const response = await fetch('https://api.rd.services/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).send(text);
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// RD Station workspace lookup
app.get('/api/rdstation/workspaces', async (req, res, next) => {
  try {
    const { getRdAccessToken } = await import('./services/rdstation.service');
    const token = await getRdAccessToken();

    const response = await fetch('https://api.rd.services/platform/workspaces', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).send(text);
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get('/api/rdstation/test', async (req, res, next) => {
  try {
    const { getRdAccessToken } = await import('./services/rdstation.service');
    await getRdAccessToken();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// API Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/okrs', okrsRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/webhooks', webhookLeadsRoutes);
app.use('/api/lead-hub', leadHubRoutes);
app.use('/api/lead-webhooks', protectedLeadWebhooksRouter);
app.use('/api/lead-rules', leadClassificationRulesRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/utm-links', utmLinksRoutes);
app.use('/api/utm-destinations', utmDestinationsRoutes);
app.use('/api/funnels', funnelRoutes);

// Error handling middleware (deve ser o último)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 AutoForce Performance API`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

startSyncScheduler();
startupConnectionCheck().catch(err => console.error('[connections] startup check failed:', err));

export default app;
