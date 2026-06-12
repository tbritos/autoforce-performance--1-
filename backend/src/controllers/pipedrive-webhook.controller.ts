import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { LeadStatus } from '@prisma/client';
import {
  PIPEDRIVE_FIELDS, PIPEDRIVE_OPTIONS,
  resolveSetField, resolveEnumField, extractSetupValue, sourceToOrigin,
} from '../services/pipedrive.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipedrivePerson {
  value: number;
  email?: PipedriveEmail[];
}

interface PipedriveEmail {
  value: string;
  primary: boolean;
}

interface PipedriveDealPayload {
  id: number;
  title?: string;
  status?: 'open' | 'won' | 'lost' | 'deleted';
  stage_id?: number;
  value?: number;
  currency?: string;
  person_id?: PipedrivePerson | null;
  person_email?: PipedriveEmail[];
  update_time?: string;
  add_time?: string;
  won_time?: string;
  lost_time?: string;
  [key: string]: unknown;
}

interface PipedriveWebhookBody {
  event: string; // e.g. 'updated.deal', 'added.deal'
  current: PipedriveDealPayload;
  previous?: Partial<PipedriveDealPayload> | null;
  meta?: {
    timestamp?: number;
    host?: string;
  };
}

// ─── Stage name cache (in-memory, resets on restart) ─────────────────────────

const stageNameCache = new Map<number, string>();

async function resolveStageNames(
  stageIds: (number | undefined | null)[],
  token: string,
  domain: string,
  authType: 'api_token' | 'oauth'
): Promise<void> {
  const missing = [...new Set(stageIds.filter((id): id is number => id != null && !stageNameCache.has(id)))];
  if (missing.length === 0) return;

  await Promise.allSettled(
    missing.map(async (id) => {
      try {
        const url = new URL(`https://${domain}.pipedrive.com/api/v1/stages/${id}`);
        if (authType === 'api_token') url.searchParams.set('api_token', token);
        const res = await fetch(url.toString(), {
          headers: authType === 'oauth' ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) {
          const json = await res.json() as { success: boolean; data?: { name: string } };
          if (json.success && json.data?.name) {
            stageNameCache.set(id, json.data.name);
          }
        }
      } catch {
        // Non-fatal: stage name stays undefined
      }
    })
  );
}

// ─── Stage name → Lead status ─────────────────────────────────────────────────

function stageNameToLeadStatus(stageName: string): LeadStatus | null {
  const n = stageName.toLowerCase();
  if (n.includes('mql'))                                     return 'MQL';
  if (n.includes('sql') || n.includes('qualificado'))        return 'SQL';
  if (n.includes('agendamento') || n.includes('no-show') || n.includes('noshow')) return 'SCHEDULED';
  if (n.includes('reuni') || n.includes('demo'))             return 'DEMO';
  if (n.includes('proposta') || n.includes('elabora') || n.includes('contrat')) return 'PROPOSAL';
  return null;
}

function resolveLeadStatus(dealStatus: string, stageId: number | null): LeadStatus {
  if (dealStatus === 'won')  return 'CLIENT';
  if (dealStatus === 'lost') return 'LOST';
  if (stageId != null) {
    const name = stageNameCache.get(stageId);
    if (name) {
      const mapped = stageNameToLeadStatus(name);
      if (mapped) return mapped;
    }
  }
  return 'SQL';
}

// ─── Primary email helper ─────────────────────────────────────────────────────

function primaryEmail(emails: PipedriveEmail[] = []): string | null {
  return emails.find(e => e.primary)?.value || emails[0]?.value || null;
}

// ─── Controller ───────────────────────────────────────────────────────────────

export class PipedriveWebhookController {

  static async handle(req: Request, res: Response): Promise<void> {
    // 1. Validate credentials — supports Basic Auth (Pipedrive webhook form) and query token (fallback)
    const secret = process.env.PIPEDRIVE_WEBHOOK_SECRET;
    if (secret) {
      let authorized = false;

      // Check HTTP Basic Auth: Authorization: Basic base64(user:password)
      const authHeader = req.headers.authorization ?? '';
      if (authHeader.startsWith('Basic ')) {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
        const password = decoded.split(':').slice(1).join(':'); // everything after first ":"
        if (password === secret) authorized = true;
      }

      // Fallback: query token only in non-production (token in URL leaks into server logs)
      if (!authorized && process.env.NODE_ENV !== 'production' && req.query.token === secret) authorized = true;

      if (!authorized) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    const body = req.body as PipedriveWebhookBody;
    const { event, current, previous } = body;

    // Only handle deal events
    if (!event || !current?.id || (!event.includes('deal'))) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    console.log(`[pipedrive-webhook] event=${event} dealId=${current.id} title="${current.title}" stage=${current.stage_id} status=${current.status}`);

    // 2. Find matching lead — email can be in person_email or nested in person_id.email
    const email = primaryEmail(current.person_email ?? current.person_id?.email ?? []);
    const personId = current.person_id?.value ? String(current.person_id.value) : null;

    console.log(`[pipedrive-webhook] looking up lead — email="${email}" personId=${personId}`);

    let lead = email
      ? await prisma.lead.findUnique({ where: { email: email.toLowerCase().trim() } })
      : null;

    if (!lead && personId) {
      lead = await prisma.lead.findFirst({ where: { pipedrivePersonId: personId } });
    }

    // No matching lead — acknowledge and skip silently
    if (!lead) {
      console.log(`[pipedrive-webhook] lead NOT FOUND — email="${email}" personId=${personId} — skipping`);
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    console.log(`[pipedrive-webhook] lead found: ${lead.email} (current status: ${lead.status})`);

    const dealId        = String(current.id);
    const dealTitle     = current.title ?? null;
    const dealStatus    = current.status ?? 'open';
    const currentStage  = current.stage_id ?? null;
    const previousStage = previous?.stage_id ?? null;
    const currentValue  = current.value ?? null;
    const previousValue = previous?.value ?? null;
    const occurredAt    = current.update_time
      ? new Date(current.update_time)
      : new Date();

    // 3. Resolve stage names + grab domain (best-effort, requires Pipedrive credentials)
    let pipedriveDomain = process.env.PIPEDRIVE_DOMAIN || '';
    try {
      const { PlatformConnectionService } = await import('../services/platform-connection.service');
      const tokens = await PlatformConnectionService.getTokens('PIPEDRIVE');
      const conn   = await PlatformConnectionService.getConnection('PIPEDRIVE');
      const meta   = (conn?.metadata ?? {}) as Record<string, unknown>;
      pipedriveDomain = (meta.domain as string) || pipedriveDomain;
      const authType: 'api_token' | 'oauth' = meta.authType === 'api_token' ? 'api_token' : 'oauth';
      const token  = tokens?.accessToken ?? process.env.PIPEDRIVE_API_TOKEN ?? '';

      if (token && pipedriveDomain) {
        await resolveStageNames([currentStage, previousStage], token, pipedriveDomain, authType);
      }
    } catch {
      // Non-fatal
    }

    // 4. Build events to create
    const eventsToCreate: Array<Parameters<typeof prisma.pipedriveDealEvent.create>[0]['data']> = [];
    const isAdded = event === 'added.deal';

    if (isAdded) {
      eventsToCreate.push({
        id:           `${dealId}-created-${occurredAt.getTime()}`,
        dealId,
        leadEmail:    lead.email,
        eventType:    'created',
        toStageId:    currentStage,
        toStageName:  currentStage != null ? (stageNameCache.get(currentStage) ?? null) : null,
        toValue:      currentValue,
        dealTitle,
        dealStatus,
        occurredAt,
        source:       'webhook',
      });
    } else {
      // Stage changed?
      if (currentStage != null && previousStage != null && currentStage !== previousStage) {
        eventsToCreate.push({
          id:           `${dealId}-stage-${occurredAt.getTime()}`,
          dealId,
          leadEmail:    lead.email,
          eventType:    'stage_changed',
          fromStageId:  previousStage,
          fromStageName: stageNameCache.get(previousStage) ?? null,
          toStageId:    currentStage,
          toStageName:  stageNameCache.get(currentStage) ?? null,
          dealTitle,
          dealStatus,
          occurredAt,
          source:       'webhook',
        });
      }

      // Status changed (won/lost/reopened)?
      const prevStatus = previous?.status;
      if (prevStatus !== undefined && prevStatus !== dealStatus) {
        const eventType =
          dealStatus === 'won'  ? 'won'  :
          dealStatus === 'lost' ? 'lost' : 'reopened';
        eventsToCreate.push({
          id:         `${dealId}-status-${occurredAt.getTime()}`,
          dealId,
          leadEmail:  lead.email,
          eventType,
          toValue:    currentValue,
          dealTitle,
          dealStatus,
          occurredAt,
          source:     'webhook',
        });
      }

      // Value changed?
      if (currentValue != null && previousValue != null && currentValue !== previousValue) {
        eventsToCreate.push({
          id:         `${dealId}-value-${occurredAt.getTime()}`,
          dealId,
          leadEmail:  lead.email,
          eventType:  'value_changed',
          fromValue:  previousValue,
          toValue:    currentValue,
          dealTitle,
          dealStatus,
          occurredAt,
          source:     'webhook',
        });
      }
    }

    console.log(`[pipedrive-webhook] events to create: ${eventsToCreate.length} — currentStage=${currentStage} previousStage=${previousStage} stageName="${currentStage != null ? stageNameCache.get(currentStage) : 'n/a'}"`);

    if (eventsToCreate.length === 0) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    // 5. Persist events + update lead atomically
    const newLeadStatus = resolveLeadStatus(dealStatus, currentStage);
    console.log(`[pipedrive-webhook] updating lead ${lead.email}: ${lead.status} → ${newLeadStatus}`);

    await prisma.$transaction(async (tx) => {
      for (const data of eventsToCreate) {
        await tx.pipedriveDealEvent.upsert({
          where: { id: data.id as string },
          update: {},
          create: data,
        });
      }

      const prevStatus = lead.status;
      await tx.lead.update({
        where: { email: lead.email },
        data: {
          pipedriveDealId:   dealId,
          pipedrivePersonId: personId ?? undefined,
          status:            newLeadStatus,
          lastSeenAt:        new Date(),
          ...(newLeadStatus === 'CLIENT' && !lead.convertedAt ? { convertedAt: new Date() } : {}),
        },
      });

      if (prevStatus !== newLeadStatus) {
        await tx.leadStatusHistory.create({
          data: {
            leadEmail:  lead.email,
            fromStatus: prevStatus,
            toStatus:   newLeadStatus,
            changedBy:  null,
            reason:     `Pipedrive deal #${dealId} — ${dealStatus} (webhook)`,
          },
        });
      }

      // If deal is won AND is inbound, create/update RevenueEntry
      const isInbound = Number(current[PIPEDRIVE_FIELDS.CANAL_ORIGEM]) === 66;
      if (dealStatus === 'won' && isInbound) {
        const wonAt      = current.won_time ? new Date(current.won_time as string) : occurredAt;
        const setupVal   = extractSetupValue(current[PIPEDRIVE_FIELDS.SETUP_VALUE]);
        const produtos   = resolveSetField(current[PIPEDRIVE_FIELDS.PRODUTO_VENDA],    PIPEDRIVE_OPTIONS.PRODUTO_VENDA);
        const porqueComp = resolveSetField(current[PIPEDRIVE_FIELDS.PORQUE_COMPROU],   PIPEDRIVE_OPTIONS.PORQUE_COMPROU);
        const fornecedor = resolveSetField(current[PIPEDRIVE_FIELDS.FORNECEDOR_ATUAL], PIPEDRIVE_OPTIONS.FORNECEDOR_ATUAL);
        const vendedor   = resolveEnumField(current[PIPEDRIVE_FIELDS.VENDEDOR],        PIPEDRIVE_OPTIONS.VENDEDOR);
        const contrato   = (current[PIPEDRIVE_FIELDS.CONTRACT_LINK] as string | null) ?? null;
        const dealUrl    = pipedriveDomain ? `https://${pipedriveDomain}.pipedrive.com/deal/${dealId}` : null;
        const biz        = lead.company || lead.name || lead.email;

        await tx.revenueEntry.upsert({
          where: { id: `pipedrive-${dealId}` },
          update: {
            mrrValue:        currentValue ?? 0,
            setupValue:      setupVal,
            businessName:    biz,
            product:         produtos,
            closedBy:        vendedor,
            whyBought:       porqueComp,
            currentSupplier: fornecedor,
            contractLink:    contrato,
            ...(dealUrl ? { dealUrl } : {}),
            updatedAt:       new Date(),
          },
          create: {
            id:              `pipedrive-${dealId}`,
            leadEmail:       lead.email,
            businessName:    biz,
            date:            wonAt,
            setupValue:      setupVal,
            mrrValue:        currentValue ?? 0,
            origin:          sourceToOrigin(lead.firstSource),
            originType:      'INBOUND',
            product:         produtos,
            closedBy:        vendedor,
            whyBought:       porqueComp,
            currentSupplier: fornecedor,
            contractLink:    contrato,
            ...(dealUrl ? { dealUrl } : {}),
          },
        });
      }
    });

    res.status(200).json({ ok: true, events: eventsToCreate.length });
  }
}
