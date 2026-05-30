import { prisma } from '../config/database';
import { LeadStatus } from '@prisma/client';
import { PlatformConnectionService } from './platform-connection.service';

// ============================================================
// Pipedrive Service
// Syncs commercial Deal data from Pipedrive API.
//
// Important: Pipedrive is not a lead source for this system. Contacts from
// Pipedrive must not create Lead records. The Lead database is fed by webhooks,
// forms, tools and diagnostics. Pipedrive can only enrich/update existing leads
// when a matching deal/person is found.
//
// Auth: API Token (PIPEDRIVE_API_TOKEN) or via PlatformConnection.
// Domain: PIPEDRIVE_DOMAIN (e.g. "yourcompany" for yourcompany.pipedrive.com)
//
// Deal stage → LeadStatus mapping is stored in PlatformConnection.metadata
// so each client can configure it without code changes.
// ============================================================

const BASE = (domain: string) => `https://${domain}.pipedrive.com/api/v1`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipedriveDeal {
  id: number;
  title: string;
  status: 'open' | 'won' | 'lost' | 'deleted';
  stage_id: number;
  stage_name?: string;
  value: number;
  currency: string;
  person_id: { value: number; email?: Array<{ value: string; primary: boolean }>; phone?: Array<{ value: string; primary: boolean }> } | null;
  person_name?: string;
  person_email?: Array<{ value: string; primary: boolean }>; // may not be present in list endpoint
  expected_close_date?: string;
  close_time?: string;
  won_time?: string;
  lost_time?: string;
  add_time: string;
  update_time: string;
  [key: string]: unknown;
}

interface PipedriveListResponse<T> {
  success: boolean;
  data: T[] | null;
  additional_data?: { pagination?: { start: number; limit: number; more_items_in_collection: boolean; next_start?: number } };
}

// ─── Stage name → LeadStatus mapping ─────────────────────────────────────────

function stageNameToLeadStatus(stageName: string): LeadStatus | null {
  const n = stageName.toLowerCase();
  if (n.includes('mql'))                                     return 'MQL';
  if (n.includes('sql') || n.includes('qualificado'))        return 'SQL';
  if (n.includes('agendamento') || n.includes('no-show') || n.includes('noshow')) return 'SCHEDULED';
  if (n.includes('reuni') || n.includes('demo'))             return 'DEMO';
  if (n.includes('proposta') || n.includes('elabora') || n.includes('contrat')) return 'PROPOSAL';
  return null;
}

function resolveLeadStatus(
  deal: PipedriveDeal,
  stageMap: Record<string, LeadStatus>
): LeadStatus {
  if (deal.status === 'won')  return 'CLIENT';
  if (deal.status === 'lost') return 'LOST';

  // Explicit stage ID mapping configured in PlatformConnection.metadata
  if (deal.stage_id && stageMap[String(deal.stage_id)]) {
    return stageMap[String(deal.stage_id)];
  }

  // Stage name pattern matching (uses cache populated by loadStageNames)
  const stageName = stageNameCache.get(deal.stage_id);
  if (stageName) {
    const mapped = stageNameToLeadStatus(stageName);
    if (mapped) return mapped;
  }

  return 'SQL';
}

// ─── API client ──────────────────────────────────────────────────────────────

async function getCredentials(): Promise<{ token: string; domain: string; stageMap: Record<string, LeadStatus>; authType: 'api_token' | 'oauth' }> {
  // Try PlatformConnection first
  try {
    const tokens = await PlatformConnectionService.getTokens('PIPEDRIVE');
    const conn = await PlatformConnectionService.getConnection('PIPEDRIVE');
    const meta = (conn?.metadata ?? {}) as Record<string, unknown>;

    if (tokens?.accessToken) {
      return {
        token: tokens.accessToken,
        domain: (meta.domain as string) || process.env.PIPEDRIVE_DOMAIN || '',
        stageMap: (meta.stageMap as Record<string, LeadStatus>) || {},
        authType: meta.authType === 'api_token' ? 'api_token' : 'oauth',
      };
    }
  } catch {
    // fall through to .env
  }

  const token = process.env.PIPEDRIVE_API_TOKEN;
  const domain = process.env.PIPEDRIVE_DOMAIN;
  if (!token || !domain) {
    throw new Error('Pipedrive não conectado. Configure em Integrações ou adicione PIPEDRIVE_API_TOKEN e PIPEDRIVE_DOMAIN no .env');
  }
  return { token, domain, stageMap: {}, authType: 'api_token' };
}

async function pipedriveGet<T>(
  path: string,
  token: string,
  domain: string,
  authType: 'api_token' | 'oauth',
  params: Record<string, string | number> = {}
): Promise<T> {
  const url = new URL(`${BASE(domain)}${path}`);
  if (authType === 'api_token') {
    url.searchParams.set('api_token', token);
  }
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: authType === 'oauth' ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pipedrive API error (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function fetchAllPages<T>(
  path: string,
  token: string,
  domain: string,
  authType: 'api_token' | 'oauth'
): Promise<T[]> {
  const all: T[] = [];
  let start = 0;
  const limit = 100;

  while (true) {
    const res = await pipedriveGet<PipedriveListResponse<T>>(path, token, domain, authType, { start, limit });
    if (!res.success || !res.data) break;
    all.push(...res.data);

    const pagination = res.additional_data?.pagination;
    if (!pagination?.more_items_in_collection) break;
    start = pagination.next_start ?? start + limit;
  }

  return all;
}

// ─── Stage name cache (in-memory per process) ────────────────────────────────

const stageNameCache = new Map<number, string>();

async function loadStageNames(
  stageIds: (number | null | undefined)[],
  token: string,
  domain: string,
  authType: 'api_token' | 'oauth'
): Promise<void> {
  const missing = [...new Set(stageIds.filter((id): id is number => id != null && !stageNameCache.has(id)))];
  if (missing.length === 0) return;
  await Promise.allSettled(missing.map(async (id) => {
    try {
      const url = new URL(`${BASE(domain)}/stages/${id}`);
      if (authType === 'api_token') url.searchParams.set('api_token', token);
      const res = await fetch(url.toString(), {
        headers: authType === 'oauth' ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        const json = await res.json() as { success: boolean; data?: { name: string } };
        if (json.success && json.data?.name) stageNameCache.set(id, json.data.name);
      }
    } catch { /* non-fatal */ }
  }));
}

// ─── Deal history backfill ────────────────────────────────────────────────────

interface PipedriveDealChange {
  object: string;
  timestamp: string;
  data: {
    field?: string;
    old_value?: unknown;
    new_value?: unknown;
  };
}

async function fetchDealHistory(
  dealId: number,
  token: string,
  domain: string,
  authType: 'api_token' | 'oauth'
): Promise<PipedriveDealChange[]> {
  try {
    const url = new URL(`${BASE(domain)}/deals/${dealId}/updates`);
    if (authType === 'api_token') url.searchParams.set('api_token', token);
    url.searchParams.set('items', 'dealChange');
    url.searchParams.set('limit', '200');
    const res = await fetch(url.toString(), {
      headers: authType === 'oauth' ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return [];
    const json = await res.json() as { success: boolean; data?: PipedriveDealChange[] };
    return json.success ? (json.data ?? []) : [];
  } catch {
    return [];
  }
}

async function recordDealEvents(
  deal: PipedriveDeal,
  leadEmail: string,
  token: string,
  domain: string,
  authType: 'api_token' | 'oauth'
): Promise<void> {
  const dealId = String(deal.id);
  const dealTitle = typeof deal.title === 'string' ? deal.title : null;

  const lastEvent = await prisma.pipedriveDealEvent.findFirst({
    where: { dealId },
    orderBy: { occurredAt: 'desc' },
  });

  if (!lastEvent) {
    // First time seeing this deal — backfill full history
    const history = await fetchDealHistory(deal.id, token, domain, authType);
    const stageHistory = history.filter(h => h.data?.field === 'stage_id' || h.data?.field === 'status' || h.data?.field === 'value');

    // Collect all stage IDs for name resolution
    const stageIds: number[] = [];
    for (const h of stageHistory) {
      if (h.data?.field === 'stage_id') {
        const prev = Number(h.data.old_value);
        const next = Number(h.data.new_value);
        if (!isNaN(prev)) stageIds.push(prev);
        if (!isNaN(next)) stageIds.push(next);
      }
    }
    if (deal.stage_id) stageIds.push(deal.stage_id);
    await loadStageNames(stageIds, token, domain, authType);

    const eventsToCreate: Array<Record<string, unknown>> = [];

    for (const h of stageHistory) {
      const occurredAt = new Date(h.timestamp);
      if (isNaN(occurredAt.getTime())) continue;

      if (h.data?.field === 'stage_id') {
        const fromId = Number(h.data.old_value);
        const toId   = Number(h.data.new_value);
        eventsToCreate.push({
          id:           `${dealId}-stage-${occurredAt.getTime()}-backfill`,
          dealId,
          leadEmail,
          eventType:    'stage_changed',
          fromStageId:  isNaN(fromId) ? null : fromId,
          fromStageName: isNaN(fromId) ? null : (stageNameCache.get(fromId) ?? null),
          toStageId:    isNaN(toId)   ? null : toId,
          toStageName:  isNaN(toId)   ? null : (stageNameCache.get(toId) ?? null),
          dealTitle,
          dealStatus:   deal.status,
          occurredAt,
          source:       'backfill',
        });
      } else if (h.data?.field === 'status') {
        const newStatus = String(h.data.new_value ?? '');
        const eventType = newStatus === 'won' ? 'won' : newStatus === 'lost' ? 'lost' : newStatus === 'open' ? 'reopened' : null;
        if (eventType) {
          eventsToCreate.push({
            id:         `${dealId}-status-${occurredAt.getTime()}-backfill`,
            dealId,
            leadEmail,
            eventType,
            dealTitle,
            dealStatus: newStatus,
            occurredAt,
            source:     'backfill',
          });
        }
      } else if (h.data?.field === 'value') {
        eventsToCreate.push({
          id:         `${dealId}-value-${occurredAt.getTime()}-backfill`,
          dealId,
          leadEmail,
          eventType:  'value_changed',
          fromValue:  h.data.old_value != null ? Number(h.data.old_value) : null,
          toValue:    h.data.new_value != null ? Number(h.data.new_value) : null,
          dealTitle,
          dealStatus: deal.status,
          occurredAt,
          source:     'backfill',
        });
      }
    }

    // Always add a 'created' event at deal add_time
    const createdAt = new Date(deal.add_time);
    if (!isNaN(createdAt.getTime())) {
      eventsToCreate.unshift({
        id:           `${dealId}-created-backfill`,
        dealId,
        leadEmail,
        eventType:    'created',
        toStageId:    deal.stage_id ?? null,
        toStageName:  deal.stage_id != null ? (stageNameCache.get(deal.stage_id) ?? null) : null,
        toValue:      typeof deal.value === 'number' ? deal.value : null,
        dealTitle,
        dealStatus:   deal.status,
        occurredAt:   createdAt,
        source:       'backfill',
      });
    }

    if (eventsToCreate.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.pipedriveDealEvent.createMany({ data: eventsToCreate as any, skipDuplicates: true });
    }
    return;
  }

  // Subsequent syncs: detect changes since last event
  const occurredAt = new Date(deal.update_time);
  if (isNaN(occurredAt.getTime())) return;

  const currentStageId = deal.stage_id ?? null;
  const currentStatus  = deal.status;
  const currentValue   = typeof deal.value === 'number' ? deal.value : null;

  await loadStageNames([currentStageId, lastEvent.toStageId], token, domain, authType);

  const newEvents: Array<Record<string, unknown>> = [];

  if (currentStageId != null && currentStageId !== lastEvent.toStageId) {
    newEvents.push({
      id:           `${dealId}-stage-${occurredAt.getTime()}-sync`,
      dealId,
      leadEmail,
      eventType:    'stage_changed',
      fromStageId:  lastEvent.toStageId,
      fromStageName: lastEvent.toStageName,
      toStageId:    currentStageId,
      toStageName:  stageNameCache.get(currentStageId) ?? null,
      dealTitle,
      dealStatus:   currentStatus,
      occurredAt,
      source:       'sync',
    });
  }

  if (currentStatus !== lastEvent.dealStatus) {
    const eventType = currentStatus === 'won' ? 'won' : currentStatus === 'lost' ? 'lost' : 'reopened';
    newEvents.push({
      id:         `${dealId}-status-${occurredAt.getTime()}-sync`,
      dealId,
      leadEmail,
      eventType,
      toValue:    currentValue,
      dealTitle,
      dealStatus: currentStatus,
      occurredAt,
      source:     'sync',
    });
  }

  if (currentValue != null && currentValue !== lastEvent.toValue) {
    newEvents.push({
      id:         `${dealId}-value-${occurredAt.getTime()}-sync`,
      dealId,
      leadEmail,
      eventType:  'value_changed',
      fromValue:  lastEvent.toValue,
      toValue:    currentValue,
      dealTitle,
      dealStatus: currentStatus,
      occurredAt,
      source:     'sync',
    });
  }

  if (newEvents.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.pipedriveDealEvent.createMany({ data: newEvents as any, skipDuplicates: true });
  }
}

// ─── Sync logic ───────────────────────────────────────────────────────────────

function primaryEmail(emails: Array<{ value: string; primary: boolean }> = []): string | null {
  return emails.find(e => e.primary)?.value || emails[0]?.value || null;
}

export async function syncPipedrivePersons(): Promise<{ synced: number; errors: number }> {
  // Deprecated by product decision: Pipedrive contacts are not top-of-funnel
  // leads. Keep this as a no-op so any old imports/calls do not reintroduce
  // Pipedrive as a lead ingestion source.
  return { synced: 0, errors: 0 };
}

// Pipelines a sincronizar: novo_cliente (2) e upsell (5)
const SYNC_PIPELINE_IDS = [2, 5];

export async function syncPipedriveDeals(): Promise<{ synced: number; errors: number }> {
  const { token, domain, stageMap, authType } = await getCredentials();

  // Fetch only from sales pipelines — ignore CS/relationship pipelines
  const dealArrays = await Promise.all(
    SYNC_PIPELINE_IDS.map(pid =>
      fetchAllPages<PipedriveDeal>(`/pipelines/${pid}/deals`, token, domain, authType)
    )
  );
  // Only inbound deals (Canal de Origem = Inbound, option 66)
  const deals = dealArrays.flat().filter(d => d[FIELD_CANAL_ORIGEM] === OPT_CANAL_INBOUND);

  // Remove OPPORTUNITY status history records created before stage mapping was implemented
  await prisma.leadStatusHistory.deleteMany({
    where: { OR: [{ toStatus: 'OPPORTUNITY' }, { fromStatus: 'OPPORTUNITY' }] },
  });

  // Pre-load stage names so resolveLeadStatus can use pattern matching
  const allStageIds = [...new Set(deals.map(d => d.stage_id).filter((id): id is number => id != null))];
  await loadStageNames(allStageIds, token, domain, authType);

  let synced = 0;
  let errors = 0;

  for (const deal of deals) {
    // Resolve lead email: Pipedrive returns emails in person_id.email (list endpoint)
    // or in person_email (single deal endpoint). Try both.
    const personEmails = deal.person_email ?? deal.person_id?.email ?? [];
    const email = primaryEmail(personEmails) ?? null;

    // Also try lookup by pipedrivePersonId if no email
    const personId = deal.person_id?.value ? String(deal.person_id.value) : null;

    let lead = email
      ? await prisma.lead.findUnique({ where: { email: email.toLowerCase().trim() } })
      : null;

    if (!lead && personId) {
      lead = await prisma.lead.findFirst({ where: { pipedrivePersonId: personId } });
    }

    if (!lead) continue;

    const newStatus = resolveLeadStatus(deal, stageMap);
    const prevStatus = lead.status;

    try {
      await prisma.$transaction(async (tx) => {
        // Update lead status and Pipedrive deal reference
        await tx.lead.update({
          where: { email: lead!.email },
          data: {
            status:         newStatus,
            pipedriveDealId: String(deal.id),
            lastSeenAt:     new Date(),
            ...(newStatus === 'CLIENT' && !lead!.convertedAt ? { convertedAt: new Date() } : {}),
          },
        });

        // Record status change if it changed
        if (prevStatus !== newStatus) {
          await tx.leadStatusHistory.create({
            data: {
              leadEmail:  lead!.email,
              fromStatus: prevStatus,
              toStatus:   newStatus,
              changedBy:  null,
              reason:     `Pipedrive deal #${deal.id} — ${deal.status}`,
            },
          });
        }

        // If deal was won, create or update RevenueEntry
        if (deal.status === 'won' && deal.value > 0) {
          const closeDate = deal.won_time || deal.close_time || deal.add_time;
          const dateObj = new Date(closeDate);

          await tx.revenueEntry.upsert({
            where: {
              // Composite approach: find by leadEmail + date
              // Using findFirst + upsert is safer; use create with unique check
              id: `pipedrive-${deal.id}`,
            },
            update: {
              mrrValue:  deal.value,
              updatedAt: new Date(),
            },
            create: {
              id:           `pipedrive-${deal.id}`,
              leadEmail:    lead!.email,
              businessName: deal.person_name || lead!.name || lead!.email,
              date:         dateObj,
              setupValue:   0,
              mrrValue:     deal.value,
              origin:       'Pipedrive',
              originType:   'INBOUND',
              product:      [deal.title],
              closedBy:     null,
            },
          });
        }
      });

      synced++;

      // Record deal events: backfill on first link, detect changes on subsequent syncs.
      // Fire-and-forget — errors here must not fail the main sync.
      recordDealEvents(deal, lead!.email, token, domain, authType).catch(() => {});
    } catch {
      errors++;
    }
  }

  return { synced, errors };
}

export async function syncPipedrive(): Promise<{ synced: number; errors: number }> {
  const deals   = await syncPipedriveDeals();
  return {
    synced: deals.synced,
    errors: deals.errors,
  };
}

// ─── Constants — field keys & option IDs ─────────────────────────────────────

const FIELD_CANAL_ORIGEM      = '9459f9b49acca8552e69c0ee0898f751b05b4fe6';
const FIELD_DETALHAMENTO_MKT  = '973cdb7b69d83ee7dafb4d5e433bb02e4fa33820';
const FIELD_REFERENCIA_ORIGEM = 'cfd4bf93806bfadbb695db78bd807bb9cb26662c';

const OPT_CANAL_INBOUND = 66;

const PIPELINE_IDS = { novo_cliente: 2, upsell: 5 } as const;
// First stage of each pipeline (MQL for Novo Cliente, SQL for Upsell)
const PIPELINE_INITIAL_STAGE = { novo_cliente: 6, upsell: 26 } as const;

// utm_medium → Detalhamento MKT option id
function detalhamentoMktId(medium?: string | null): number | null {
  if (!medium) return null;
  const m = medium.toLowerCase();
  if (['cpc', 'ppc', 'paid', 'paidsocial', 'paid_social', 'cpm'].some(k => m.includes(k))) return 75; // Mídia Paga
  if (['email', 'newsletter', 'disparo'].some(k => m.includes(k))) return 79;                          // Base Ativa
  if (['event', 'evento'].some(k => m.includes(k))) return 77;                                         // Eventos
  if (['organic', 'seo', 'content', 'blog'].some(k => m.includes(k))) return 76;                      // Inbound Marketing
  return null;
}

// ─── POST / PATCH helpers ─────────────────────────────────────────────────────

async function pipedrivePost<T>(
  path: string,
  token: string,
  domain: string,
  authType: 'api_token' | 'oauth',
  body: Record<string, unknown>
): Promise<T> {
  const url = new URL(`${BASE(domain)}${path}`);
  if (authType === 'api_token') url.searchParams.set('api_token', token);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authType === 'oauth' ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json() as { success: boolean; data: T; error?: string };
  if (!json.success) throw new Error(`Pipedrive POST ${path} failed: ${json.error ?? res.status}`);
  return json.data;
}

async function pipedriveSearch<T>(
  path: string,
  token: string,
  domain: string,
  authType: 'api_token' | 'oauth',
  params: Record<string, string>
): Promise<T | null> {
  const url = new URL(`${BASE(domain)}${path}`);
  if (authType === 'api_token') url.searchParams.set('api_token', token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), {
    headers: authType === 'oauth' ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  const json = await res.json() as { success: boolean; data?: { items?: Array<{ item: T }> } };
  return json.data?.items?.[0]?.item ?? null;
}

// ─── Create deal for a lead (called by rules engine & manual qualification) ───

type FieldMapping = { fieldKey: string; sourceType: 'lead_field' | 'fixed'; leadField?: string; fixedValue?: string };

function resolveLeadFieldValue(lead: Record<string, unknown>, fieldKey: string): string | number | null {
  const v = lead[fieldKey];
  if (v === null || v === undefined) return null;
  return typeof v === 'number' ? v : String(v);
}

function resolveTemplate(template: string, lead: Record<string, unknown>): string {
  let result = template
    .replace('{nome}',         String(lead.name             ?? ''))
    .replace('{empresa}',      String(lead.company          ?? ''))
    .replace('{email}',        String(lead.email            ?? ''))
    .replace('{telefone}',     String(lead.phone            ?? ''))
    .replace('{cargo}',        String(lead.jobTitle         ?? ''))
    .replace('{origem}',       String(lead.firstSource      ?? ''))
    .replace('{midia}',        String(lead.firstMedium      ?? ''))
    .replace('{campanha}',     String(lead.firstCampaign    ?? ''))
    .replace('{landing_page}', String(lead.firstLandingPage ?? ''))
    .replace('{score}',        String(lead.score            ?? ''));
  const customFields = (lead.customFields as Record<string, unknown>) ?? {};
  result = result.replace(/\{cf\.([^}]+)\}/g, (_, name) => String(customFields[name] ?? ''));
  return result.trim();
}

function buildDealFieldValue(
  mapping: FieldMapping,
  lead: Record<string, unknown>,
): unknown {
  if (mapping.sourceType === 'fixed') {
    const v = mapping.fixedValue ?? '';
    if (!v) return undefined;
    // Comma-separated IDs for set fields
    if (v.includes(',')) return v.split(',').map(Number).filter(Boolean);
    // Numeric string → number (option IDs for enum fields)
    const asNum = Number(v);
    if (!isNaN(asNum) && v.trim() !== '') return asNum;
    // Template string for varchar/text
    return resolveTemplate(v, lead);
  }
  // lead_field
  const field = mapping.leadField ?? '';
  if (!field) return undefined;
  // Detalhamento MKT from UTM medium
  if (mapping.fieldKey === '973cdb7b69d83ee7dafb4d5e433bb02e4fa33820') {
    return detalhamentoMktId(String(lead[field] ?? '')) ?? undefined;
  }
  return resolveLeadFieldValue(lead, field) ?? undefined;
}

export async function createDealForLead(
  leadEmail: string,
  pipeline: 'novo_cliente' | 'upsell',
  fieldMappings?: FieldMapping[],
  noteTemplate?: string
): Promise<{ dealId: string; personId: string }> {
  const { token, domain, authType } = await getCredentials();

  const lead = await prisma.lead.findUnique({ where: { email: leadEmail.toLowerCase().trim() } });
  if (!lead) throw new Error(`Lead não encontrado: ${leadEmail}`);

  const leadRecord = lead as unknown as Record<string, unknown>;

  // ── 1. Find or create Person ────────────────────────────────────────────────
  let personId: string;

  if (lead.pipedrivePersonId) {
    personId = lead.pipedrivePersonId;
  } else {
    const existing = await pipedriveSearch<{ id: number }>(
      '/persons/search', token, domain, authType,
      { term: lead.email, fields: 'email', exact_match: 'true' }
    );
    if (existing?.id) {
      personId = String(existing.id);
    } else {
      const personPayload: Record<string, unknown> = {
        name:  lead.name || lead.email,
        email: [{ value: lead.email, primary: true }],
      };
      if (lead.phone)    personPayload.phone     = [{ value: lead.phone, primary: true }];
      if (lead.jobTitle) personPayload.job_title  = lead.jobTitle;
      const person = await pipedrivePost<{ id: number }>('/persons', token, domain, authType, personPayload);
      personId = String(person.id);
    }
  }

  // ── 2. Find or create Organization ─────────────────────────────────────────
  let orgId: number | undefined;

  if (lead.company) {
    const existingOrg = await pipedriveSearch<{ id: number }>(
      '/organizations/search', token, domain, authType,
      { term: lead.company, fields: 'name', exact_match: 'true' }
    );
    if (existingOrg?.id) {
      orgId = existingOrg.id;
    } else {
      const org = await pipedrivePost<{ id: number }>('/organizations', token, domain, authType, { name: lead.company });
      orgId = org.id;
      await fetch(
        `${BASE(domain)}/persons/${personId}${authType === 'api_token' ? `?api_token=${token}` : ''}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(authType === 'oauth' ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ org_id: orgId }),
        }
      );
    }
  }

  // ── 3. Build deal payload from fieldMappings (or sensible defaults) ─────────
  const dealPayload: Record<string, unknown> = {
    pipeline_id: PIPELINE_IDS[pipeline],
    stage_id:    PIPELINE_INITIAL_STAGE[pipeline],
    person_id:   Number(personId),
  };
  if (orgId) dealPayload.org_id = orgId;

  if (fieldMappings && fieldMappings.length > 0) {
    for (const mapping of fieldMappings) {
      const value = buildDealFieldValue(mapping, leadRecord);
      if (value !== undefined && value !== null && value !== '') {
        dealPayload[mapping.fieldKey] = value;
      }
    }
    // Ensure title is always set
    if (!dealPayload.title) {
      dealPayload.title = `${lead.name ?? lead.email}${lead.company ? ` — ${lead.company}` : ''}`;
    }
  } else {
    // Default mapping when no fieldMappings configured
    dealPayload.title = `${lead.name ?? lead.email}${lead.company ? ` — ${lead.company}` : ''}`;
    dealPayload[FIELD_CANAL_ORIGEM] = OPT_CANAL_INBOUND;
    const mktId = detalhamentoMktId(lead.firstMedium);
    if (mktId) dealPayload[FIELD_DETALHAMENTO_MKT] = mktId;
    if (lead.firstCampaign) dealPayload[FIELD_REFERENCIA_ORIGEM] = lead.firstCampaign;
  }

  // ── 4. Create Deal ──────────────────────────────────────────────────────────
  const deal = await pipedrivePost<{ id: number }>('/deals', token, domain, authType, dealPayload);
  const dealId = String(deal.id);

  // ── 4b. Create Note (if template provided) ──────────────────────────────────
  if (noteTemplate?.trim()) {
    const noteContent = resolveTemplate(noteTemplate, lead as unknown as Record<string, unknown>);
    await pipedrivePost('/notes', token, domain, authType, {
      content:             noteContent,
      deal_id:             deal.id,
      pinned_to_deal_flag: 1,
    });
  }

  // ── 5. Persist IDs back to lead ─────────────────────────────────────────────
  await prisma.lead.update({
    where: { email: lead.email },
    data: {
      pipedriveDealId:   dealId,
      pipedrivePersonId: personId,
      status:            'MQL',
      qualifiedAt:       lead.qualifiedAt ?? new Date(),
    },
  });

  await prisma.leadStatusHistory.create({
    data: {
      leadEmail:  lead.email,
      fromStatus: lead.status,
      toStatus:   'MQL',
      changedBy:  null,
      reason:     `Negócio criado no Pipedrive (#${dealId}) — pipeline: ${pipeline}`,
    },
  });

  return { dealId, personId };
}

// ─── Deal stage map helper (for configuration UI) ────────────────────────────

export async function fetchPipedriveStages(): Promise<Array<{ id: number; name: string; pipeline_name: string }>> {
  const { token, domain, authType } = await getCredentials();
  const res = await pipedriveGet<PipedriveListResponse<{ id: number; name: string; pipeline_id: number; pipeline_name: string }>>(
    '/stages',
    token,
    domain,
    authType
  );
  return (res.data ?? []).map(s => ({ id: s.id, name: s.name, pipeline_name: s.pipeline_name }));
}
