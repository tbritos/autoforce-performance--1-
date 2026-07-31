import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { LeadStatus } from '@prisma/client';
import {
  PIPEDRIVE_FIELDS, PIPEDRIVE_OPTIONS,
  resolveSetField, resolveEnumField, extractSetupValue, sourceToOrigin,
} from '../services/pipedrive.service';
import { canApplyPipedriveDealToLead } from '../services/pipedrive-link.utils';

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
  pipeline_id?: number;
  value?: number;
  currency?: string;
  person_id?: PipedrivePerson | null;
  person_email?: PipedriveEmail[];
  update_time?: string;
  add_time?: string;
  won_time?: string;
  lost_time?: string;
  lost_reason?: string;
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

    const raw = req.body as any;

    console.log(`[pipedrive-webhook] meta:`, JSON.stringify(raw.meta));

    // Pipedrive v2 webhooks: { data, previous, meta: { action:"change", entity:"deal" } }
    // Pipedrive v1/API:     { event:"updated.deal", current, previous, meta }
    const entityType = raw.meta?.entity ?? raw.meta?.object ?? null;
    const event      = raw.event ?? (raw.meta?.action && entityType ? `${raw.meta.action}.${entityType}` : null);
    const current    = (raw.current ?? raw.data ?? null) as PipedriveDealPayload | null;
    const previous   = (raw.previous ?? null) as Partial<PipedriveDealPayload> | null;

    console.log(`[pipedrive-webhook] event="${event}" currentId="${current?.id}" status="${current?.status}"`);

    // Only handle deal events
    if (!event || !current?.id || !event.includes('deal')) {
      console.log(`[pipedrive-webhook] SKIPPED — event="${event}" currentId="${current?.id}"`);
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    console.log(`[pipedrive-webhook] event=${event} dealId=${current.id} title="${current.title}" stage=${current.stage_id} status=${current.status}`);
    if (current.status === 'won') {
      console.log(`[pipedrive-webhook] WON deal payload (custom fields):`, JSON.stringify(
        Object.fromEntries(Object.entries(current).filter(([k]) => /^[a-f0-9]{40}$/.test(k)))
      ));
    }

    // 2. Extract deal fields and find matching lead (optional — won+inbound deals are processed even without one)
    const email    = primaryEmail(current.person_email ?? current.person_id?.email ?? []);
    const personId = current.person_id?.value ? String(current.person_id.value) : null;
    const dealId   = String(current.id);
    const dealStatus = current.status ?? 'open';

    console.log(`[pipedrive-webhook] looking up lead — email="${email}" personId=${personId} dealId=${dealId}`);

    let lead = await prisma.lead.findFirst({ where: { pipedriveDealId: dealId } });
    if (!lead && email) {
      lead = await prisma.lead.findUnique({ where: { email: email.toLowerCase().trim() } });
    }
    if (!lead && personId) {
      lead = await prisma.lead.findFirst({ where: { pipedrivePersonId: personId } });
    }

    // Um e-mail/person_id compartilhado entre venda e onboarding não pode
    // substituir um vínculo de negócio que já foi estabelecido. Negócios
    // ganhos ainda seguem sem lead abaixo para registrar receita, mas não
    // alteram o card/snapshot do lead errado.
    if (lead && !canApplyPipedriveDealToLead(lead.pipedriveDealId, dealId)) {
      console.warn(
        `[pipedrive-webhook] deal #${dealId} nao pode substituir deal #${lead.pipedriveDealId} de ${lead.email}`,
      );
      if (dealStatus !== 'won') {
        res.status(200).json({ ok: true, skipped: true, reason: 'lead_link_conflict' });
        return;
      }
      lead = null;
    }

    if (lead) {
      console.log(`[pipedrive-webhook] lead found: ${lead.email} (current status: ${lead.status})`);
    } else {
      console.log(`[pipedrive-webhook] lead NOT FOUND — dealId=${dealId} email="${email}" personId=${personId}`);
      // Only skip immediately for non-won deals; won deals continue to check isInbound
      if (dealStatus !== 'won') {
        res.status(200).json({ ok: true, skipped: true });
        return;
      }
    }

    const dealTitle     = current.title ?? null;
    let   currentStage  = current.stage_id ?? null;
    const previousStage = previous?.stage_id ?? null;
    let   currentValue  = current.value ?? null;
    const previousValue = previous?.value ?? null;
    const occurredAt    = current.update_time
      ? new Date(current.update_time)
      : new Date();

    // 3. Resolve stage names + grab domain (best-effort, requires Pipedrive credentials)
    // For won/lost deals, also fetch the full deal to get all custom fields (v2 webhooks only send changed fields)
    let pipedriveDomain = process.env.PIPEDRIVE_DOMAIN || '';
    let fullDeal: Record<string, unknown> | null = null;
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

        // Fetch full deal to get all custom fields (webhook v2 only sends changed fields).
        // Needed whenever a lead is matched: partial payloads (e.g. only "value" changed)
        // may omit pipeline_id/stage_id/Canal de Origem, which breaks isInbound detection
        // and the Forecast snapshot otherwise.
        if (lead) {
          try {
            const dealUrl = new URL(`https://${pipedriveDomain}.pipedrive.com/api/v1/deals/${dealId}`);
            if (authType === 'api_token') dealUrl.searchParams.set('api_token', token);
            const dealRes = await fetch(dealUrl.toString(), {
              headers: authType === 'oauth' ? { Authorization: `Bearer ${token}` } : undefined,
            });
            if (dealRes.ok) {
              const dealJson = await dealRes.json() as { success: boolean; data?: Record<string, unknown> };
              if (dealJson.success && dealJson.data) {
                fullDeal = dealJson.data;
                console.log(`[pipedrive-webhook] fetched full deal custom fields:`, JSON.stringify(
                  Object.fromEntries(Object.entries(fullDeal).filter(([k]) => /^[a-f0-9]{40}$/.test(k)))
                ));

                // Partial webhook payloads may omit stage_id/value when a different field
                // changed — prefer the full deal's values so downstream status/Forecast
                // logic never operates on stale/missing data.
                const fd = fullDeal as PipedriveDealPayload;
                if (fd.stage_id != null) currentStage = fd.stage_id;
                if (fd.value != null) currentValue = fd.value;
                await resolveStageNames([currentStage], token, pipedriveDomain, authType);
              }
            }
          } catch {
            // Non-fatal
          }
        }
      }
    } catch {
      // Non-fatal
    }

    // For won deals, merge full deal data so custom fields are available
    const dealData = (fullDeal ?? current) as PipedriveDealPayload;

    // 4. Build events to create (only when lead is linked)
    const eventsToCreate: Array<Parameters<typeof prisma.pipedriveDealEvent.create>[0]['data']> = [];
    if (lead) {
      // v1: event="added.deal"; v2: event="change.deal" but previous is null/empty
      const isAdded = event === 'added.deal' || (event?.includes('deal') && (!previous || Object.keys(previous).length === 0));

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
    }

    // 5. Determine lead status changes (only when lead exists)
    const newLeadStatus  = lead ? resolveLeadStatus(dealStatus, currentStage) : null;
    const statusChanged  = lead ? lead.status !== newLeadStatus : false;
    const linkChanged    = lead
      ? (lead.pipedriveDealId !== dealId || (personId != null && lead.pipedrivePersonId !== personId))
      : false;

    // Determine revenue upsert — won+inbound deals always create RevenueEntry
    const canalOrigemRaw    = dealData[PIPEDRIVE_FIELDS.CANAL_ORIGEM];
    const isInbound         = Number(canalOrigemRaw) === 66;
    const shouldUpsertRevenue = dealStatus === 'won' && isInbound;

    console.log(`[pipedrive-webhook] events=${eventsToCreate.length} statusChanged=${statusChanged} linkChanged=${linkChanged} canalOrigem=${canalOrigemRaw} isInbound=${isInbound} shouldUpsertRevenue=${shouldUpsertRevenue} leadFound=${!!lead}`);

    if (eventsToCreate.length === 0 && !statusChanged && !linkChanged && !shouldUpsertRevenue) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    if (lead) console.log(`[pipedrive-webhook] updating lead ${lead.email}: ${lead.status} → ${newLeadStatus}`);

    await prisma.$transaction(async (tx) => {
      // Lead-dependent operations (only when lead is linked)
      if (lead) {
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
            status:            newLeadStatus!,
            // Forecast snapshot — only for inbound deals, same rule as status/revenue.
            ...(isInbound ? {
              pipedrivePipelineId: dealData.pipeline_id ?? null,
              pipedriveStageId:    currentStage,
              pipedriveStageName:  currentStage != null ? (stageNameCache.get(currentStage) ?? null) : null,
              pipedriveDealStatus: dealStatus,
              pipedriveDealValue:  dealData.value ?? null,
              pipedriveSetupValue: extractSetupValue(dealData[PIPEDRIVE_FIELDS.SETUP_VALUE]),
            } : {}),
            ...(newLeadStatus === 'CLIENT' && !lead.convertedAt ? { convertedAt: new Date() } : {}),
          },
        });

        if (prevStatus !== newLeadStatus) {
          await tx.leadStatusHistory.create({
            data: {
              leadEmail:  lead.email,
              fromStatus: prevStatus,
              toStatus:   newLeadStatus!,
              changedBy:  null,
              reason:     `Pipedrive deal #${dealId} — ${dealStatus} (webhook)`,
              lostReason: newLeadStatus === 'LOST' ? ((dealData.lost_reason as string) ?? null) : null,
            },
          });
        }
      }

      // RevenueEntry: created for any won+inbound deal, with or without a linked lead
      if (shouldUpsertRevenue) {
        const wonAt      = dealData.won_time ? new Date(dealData.won_time as string) : occurredAt;
        const setupVal   = extractSetupValue(dealData[PIPEDRIVE_FIELDS.SETUP_VALUE]);
        const produtos   = resolveSetField(dealData[PIPEDRIVE_FIELDS.PRODUTO_VENDA],    PIPEDRIVE_OPTIONS.PRODUTO_VENDA);
        const porqueComp = resolveSetField(dealData[PIPEDRIVE_FIELDS.PORQUE_COMPROU],   PIPEDRIVE_OPTIONS.PORQUE_COMPROU);
        const fornecedor = resolveSetField(dealData[PIPEDRIVE_FIELDS.FORNECEDOR_ATUAL], PIPEDRIVE_OPTIONS.FORNECEDOR_ATUAL);
        const vendedor   = resolveEnumField(dealData[PIPEDRIVE_FIELDS.VENDEDOR],        PIPEDRIVE_OPTIONS.VENDEDOR);
        const contrato   = (dealData[PIPEDRIVE_FIELDS.CONTRACT_LINK] as string | null) ?? null;
        const dealUrl    = pipedriveDomain ? `https://${pipedriveDomain}.pipedrive.com/deal/${dealId}` : null;
        const revenueEmail = lead?.email ?? email ?? null;
        const biz        = lead?.company || lead?.name || dealTitle || revenueEmail || dealId;

        console.log(`[pipedrive-webhook] creating RevenueEntry pipedrive-${dealId} leadEmail=${revenueEmail} biz="${biz}"`);

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
            ...(revenueEmail ? { leadEmail: revenueEmail } : {}),
            ...(dealUrl ? { dealUrl } : {}),
            updatedAt:       new Date(),
          },
          create: {
            id:              `pipedrive-${dealId}`,
            leadEmail:       revenueEmail,
            businessName:    biz,
            date:            wonAt,
            setupValue:      setupVal,
            mrrValue:        currentValue ?? 0,
            origin:          lead ? sourceToOrigin(lead.firstSource) : 'Pipedrive',
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
