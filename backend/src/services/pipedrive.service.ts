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
  person_id: { value: number } | null;
  person_name?: string;
  person_email?: Array<{ value: string; primary: boolean }>;
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

// ─── Default deal status → LeadStatus mapping ────────────────────────────────

const DEFAULT_STATUS_MAP: Record<string, LeadStatus> = {
  open: 'OPPORTUNITY',
  won: 'CLIENT',
  lost: 'LOST',
};

function resolveLeadStatus(
  deal: PipedriveDeal,
  stageMap: Record<string, LeadStatus>
): LeadStatus {
  // Stage-specific mapping takes priority over deal status
  if (deal.stage_id && stageMap[String(deal.stage_id)]) {
    return stageMap[String(deal.stage_id)];
  }
  return DEFAULT_STATUS_MAP[deal.status] ?? 'OPPORTUNITY';
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

export async function syncPipedriveDeals(): Promise<{ synced: number; errors: number }> {
  const { token, domain, stageMap, authType } = await getCredentials();
  const deals = await fetchAllPages<PipedriveDeal>('/deals', token, domain, authType);

  let synced = 0;
  let errors = 0;

  for (const deal of deals) {
    // Resolve lead email from deal person
    const personEmails = deal.person_email ?? [];
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
