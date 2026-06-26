import { prisma } from '../config/database';
import { LeadStatus, Prisma } from '@prisma/client';
import { normalizePhoneE164 } from '../utils/phone';

// ============================================================
// Helpers
// ============================================================

export const normalizeEmail = (email: string): string =>
  email.toLowerCase().trim();

// Fill-blank upsert: only updates a field if the current value is null/undefined.
// Returns the merged update payload (only fields that were actually blank).
function buildFillBlankUpdate(
  existing: Record<string, any>,
  incoming: Record<string, any>
): Record<string, any> {
  const update: Record<string, any> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined && value !== null && value !== '' &&
        (existing[key] === null || existing[key] === undefined || existing[key] === '')) {
      update[key] = value;
    }
  }
  return update;
}

// ============================================================
// Types
// ============================================================

export interface UpsertLeadInput {
  email: string;
  name?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  city?: string;
  state?: string;
}

export interface RecordConversionInput {
  leadEmail: string;
  source: string;
  externalId?: string;
  campaignId?: string;
  campaignName?: string;
  formName?: string;
  landingPage?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  rawData: Record<string, any>;
  convertedAt?: Date;
}

export interface ProcessWebhookInput {
  source: string;
  payload: Record<string, any>;
  leadData: UpsertLeadInput;
  conversionData: Omit<RecordConversionInput, 'leadEmail'>;
}

export interface LeadFilter {
  status?: LeadStatus;
  search?: string;
  isHot?: boolean;
  tag?: string;
  assignedTo?: string;
  startDate?: string;
  endDate?: string;
  customField?: string;
  customValue?: string;
  conversionSource?: string;
  orderBy?: 'lastSeenAt' | 'firstSeenAt' | 'conversionsCount' | 'name';
  orderDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface UpdateLeadProfileInput {
  name?: string | null;
  phone?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  city?: string | null;
  state?: string | null;
  assignedTo?: string | null;
  isHot?: boolean;
  score?: number | null;
  pipedriveDealId?: string | null;
  pipedrivePersonId?: string | null;
}

// ============================================================
// LeadHubService
// ============================================================

export class LeadHubService {

  // ----------------------------------------------------------
  // Core: upsert lead by email
  //
  // Rules:
  //   - email is always normalized (lowercase + trim)
  //   - on create: set all provided fields + first-touch attribution
  //   - on update: fill blanks only — never overwrite existing data
  // ----------------------------------------------------------
  static async upsertLead(
    input: UpsertLeadInput,
    firstTouchData?: {
      source?: string;
      medium?: string;
      campaign?: string;
      landingPage?: string;
    }
  ) {
    const email = normalizeEmail(input.email);

    const existing = await prisma.lead.findUnique({ where: { email } });

    if (!existing) {
      return prisma.lead.create({
        data: {
          email,
          name: input.name || null,
          phone: normalizePhoneE164(input.phone),
          company: input.company || null,
          jobTitle: input.jobTitle || null,
          city: input.city || null,
          state: input.state || null,
          firstSource: firstTouchData?.source || null,
          firstMedium: firstTouchData?.medium || null,
          firstCampaign: firstTouchData?.campaign || null,
          firstLandingPage: firstTouchData?.landingPage || null,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        },
      });
    }

    // Atualiza campos que chegarem preenchidos no webhook
    // Campos vazios/nulos no input não sobrescrevem dados existentes
    const profileUpdate: Record<string, any> = {};
    const fields = { name: input.name, phone: input.phone, company: input.company, jobTitle: input.jobTitle, city: input.city, state: input.state };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null && value !== '') {
        profileUpdate[key] = value;
      }
    }

    return prisma.lead.update({
      where: { email },
      data: {
        ...profileUpdate,
        lastSeenAt: new Date(),
      },
    });
  }

  // ----------------------------------------------------------
  // Record a conversion touchpoint (immutable — never edited)
  // Skips silently if externalId+source already exists (dedup).
  // ----------------------------------------------------------
  static async recordConversion(input: RecordConversionInput) {
    const email = normalizeEmail(input.leadEmail);

    // Skip duplicate conversions
    if (input.externalId) {
      const existing = await prisma.leadConversion.findUnique({
        where: {
          externalId_source: {
            externalId: input.externalId,
            source: input.source,
          },
        },
      });
      if (existing) return existing;
    }

    return prisma.leadConversion.create({
      data: {
        leadEmail: email,
        source: input.source,
        externalId: input.externalId || null,
        campaignId: input.campaignId || null,
        campaignName: input.campaignName || null,
        formName: input.formName || null,
        landingPage: input.landingPage || null,
        utmSource: input.utmSource || null,
        utmMedium: input.utmMedium || null,
        utmCampaign: input.utmCampaign || null,
        utmContent: input.utmContent || null,
        utmTerm: input.utmTerm || null,
        rawData: input.rawData as Prisma.JsonObject,
        convertedAt: input.convertedAt || new Date(),
      },
    });
  }

  // ----------------------------------------------------------
  // High-level: process a webhook payload atomically.
  // 1. Log the raw webhook
  // 2. Upsert the lead
  // 3. Record the conversion
  // 4. Mark log as processed (or error)
  // ----------------------------------------------------------
  static async processWebhook(input: ProcessWebhookInput): Promise<{
    lead: Awaited<ReturnType<typeof LeadHubService.upsertLead>>;
    conversionId: string | null;
    logId: string;
  }> {
    const email = normalizeEmail(input.leadData.email);

    // Step 1: write raw log immediately (before any processing)
    const log = await prisma.webhookLog.create({
      data: {
        source: input.source,
        payload: input.payload as Prisma.JsonObject,
        status: 'processing',
        leadEmail: email || null,
      },
    });

    try {
      // Step 2: upsert lead with first-touch data from conversion
      const lead = await LeadHubService.upsertLead(input.leadData, {
        source: input.conversionData.utmSource,
        medium: input.conversionData.utmMedium,
        campaign: input.conversionData.utmCampaign,
        landingPage: input.conversionData.landingPage,
      });

      // Step 3: record the conversion touchpoint
      const conversion = await LeadHubService.recordConversion({
        ...input.conversionData,
        leadEmail: email,
      });

      // Step 4: mark log as processed
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: { status: 'processed', processedAt: new Date(), leadEmail: email },
      });

      return { lead, conversionId: conversion.id, logId: log.id };
    } catch (error) {
      // Mark log as error for debugging
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          processedAt: new Date(),
        },
      });
      throw error;
    }
  }

  // ----------------------------------------------------------
  // Query: paginated lead list with filters
  // ----------------------------------------------------------
  static async listLeads(filters: LeadFilter = {}) {
    const page = Math.max(1, filters.page || 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize || 25));
    const skip = (page - 1) * pageSize;

    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.isHot !== undefined) {
      where.isHot = filters.isHot;
    }

    if (filters.tag) {
      where.tags = { has: filters.tag };
    }

    if (filters.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters.startDate || filters.endDate) {
      where.firstSeenAt = {};
      if (filters.startDate) {
        where.firstSeenAt.gte = new Date(`${filters.startDate}T00:00:00`);
      }
      if (filters.endDate) {
        where.firstSeenAt.lte = new Date(`${filters.endDate}T23:59:59`);
      }
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (filters.conversionSource) {
      const q = filters.conversionSource.trim();
      where.conversions = {
        some: {
          OR: [
            { source: { contains: q, mode: 'insensitive' } },
            { formName: { contains: q, mode: 'insensitive' } },
          ],
        },
      };
    }

    if (filters.customField && filters.customValue) {
      const def = await prisma.leadCustomFieldDef.findUnique({ where: { name: filters.customField } });
      const jsonFilter: Prisma.JsonFilter<'Lead'> = {
        path: [filters.customField],
        ...(def?.fieldType === 'boolean'
          ? { equals: filters.customValue === 'true' }
          : def?.fieldType === 'number'
            ? { equals: Number(filters.customValue) }
            : { string_contains: filters.customValue }),
      };
      where.customFields = jsonFilter;
    }

    const dir = filters.orderDir ?? 'desc';
    const orderBy: Prisma.LeadOrderByWithRelationInput =
      filters.orderBy === 'firstSeenAt'      ? { firstSeenAt: dir } :
      filters.orderBy === 'conversionsCount' ? { conversions: { _count: dir } } :
      filters.orderBy === 'name'             ? { name: dir } :
      { lastSeenAt: dir };

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          company: true,
          status: true,
          score: true,
          isHot: true,
          tags: true,
          assignedTo: true,
          firstSource: true,
          firstMedium: true,
          firstCampaign: true,
          firstSeenAt: true,
          lastSeenAt: true,
          _count: { select: { conversions: true } },
        },
      }),
    ]);

    return {
      leads,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ----------------------------------------------------------
  // Query: full 360° lead profile (Capivara)
  // ----------------------------------------------------------
  private static readonly PROFILE_CONVERSIONS_LIMIT   = 10;
  private static readonly PROFILE_STATUS_HISTORY_LIMIT = 15;

  private static async enrichProfile(lead: Awaited<ReturnType<typeof prisma.lead.findUnique>> & {
    conversions: unknown[];
    statusHistory: unknown[];
  } | null) {
    if (!lead) return null;
    const [conversionsTotal, statusHistoryTotal] = await Promise.all([
      prisma.leadConversion.count({ where: { lead: { id: lead.id } } }),
      prisma.leadStatusHistory.count({ where: { lead: { id: lead.id } } }),
    ]);
    return { ...lead, conversionsTotal, statusHistoryTotal, pipedriveDomain: process.env.PIPEDRIVE_DOMAIN ?? null };
  }

  static async getLeadProfile(emailRaw: string) {
    const email = normalizeEmail(emailRaw);
    const lead = await prisma.lead.findUnique({
      where: { email },
      include: {
        conversions:   { orderBy: { convertedAt: 'desc' }, take: this.PROFILE_CONVERSIONS_LIMIT },
        statusHistory: { orderBy: { changedAt:   'desc' }, take: this.PROFILE_STATUS_HISTORY_LIMIT },
        revenueEntries: { orderBy: { date: 'desc' } },
      },
    });
    return this.enrichProfile(lead);
  }

  static async getLeadProfileById(id: string) {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        conversions:   { orderBy: { convertedAt: 'desc' }, take: this.PROFILE_CONVERSIONS_LIMIT },
        statusHistory: { orderBy: { changedAt:   'desc' }, take: this.PROFILE_STATUS_HISTORY_LIMIT },
        revenueEntries: { orderBy: { date: 'desc' } },
      },
    });
    return this.enrichProfile(lead);
  }

  static async getAllConversions(leadId: string) {
    return prisma.leadConversion.findMany({
      where: { lead: { id: leadId } },
      orderBy: { convertedAt: 'desc' },
    });
  }

  static async updateLeadProfileById(id: string, input: UpdateLeadProfileInput) {
    const cleanString = (value: string | null | undefined) => {
      if (value === undefined) return undefined;
      const trimmed = value?.trim() ?? '';
      return trimmed === '' ? null : trimmed;
    };

    const data: Prisma.LeadUpdateInput = {
      ...(input.name !== undefined ? { name: cleanString(input.name) } : {}),
      ...(input.phone !== undefined ? { phone: normalizePhoneE164(input.phone) } : {}),
      ...(input.company !== undefined ? { company: cleanString(input.company) } : {}),
      ...(input.jobTitle !== undefined ? { jobTitle: cleanString(input.jobTitle) } : {}),
      ...(input.city !== undefined ? { city: cleanString(input.city) } : {}),
      ...(input.state !== undefined ? { state: cleanString(input.state) } : {}),
      ...(input.assignedTo !== undefined ? { assignedTo: cleanString(input.assignedTo) } : {}),
      ...(input.isHot !== undefined ? { isHot: input.isHot } : {}),
      ...(input.score !== undefined ? { score: input.score ?? 0 } : {}),
      ...(input.pipedriveDealId !== undefined ? { pipedriveDealId: cleanString(input.pipedriveDealId) } : {}),
      ...(input.pipedrivePersonId !== undefined ? { pipedrivePersonId: cleanString(input.pipedrivePersonId) } : {}),
    };

    const updated = await prisma.lead.update({
      where: { id },
      data,
    });

    if (input.score !== undefined) {
      import('./automation-engine.service').then(({ fireTrigger }) => {
        fireTrigger('score_updated', updated.email, { score: updated.score });
      }).catch(() => {});
    }

    return updated;
  }

  // ----------------------------------------------------------
  // Mutation: change lead status with audit trail
  // Both the status update and the history record are written
  // in a single transaction to ensure consistency.
  // ----------------------------------------------------------
  static async updateLeadStatus(
    emailRaw: string,
    newStatus: LeadStatus,
    changedBy?: string,
    reason?: string
  ) {
    const email = normalizeEmail(emailRaw);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { email } });

    if (lead.status === newStatus) return lead;

    const updated = await prisma.$transaction(async (tx) => {
      const timestamps: Partial<Prisma.LeadUpdateInput> = {};
      if (newStatus === 'MQL' && !lead.qualifiedAt) {
        timestamps.qualifiedAt = new Date();
      }
      if (newStatus === 'CLIENT' && !lead.convertedAt) {
        timestamps.convertedAt = new Date();
      }

      const result = await tx.lead.update({
        where: { email },
        data: { status: newStatus, ...timestamps },
      });

      await tx.leadStatusHistory.create({
        data: {
          leadEmail: email,
          fromStatus: lead.status,
          toStatus: newStatus,
          changedBy: changedBy || null,
          reason: reason || null,
        },
      });

      return result;
    });

    // Skip automation trigger when the engine itself is changing status (avoids loops)
    if (changedBy !== 'automation') {
      import('./automation-engine.service').then(({ fireTrigger }) => {
        fireTrigger('status_changed', email, { fromStatus: lead.status, toStatus: newStatus });
      }).catch(() => {});
    }

    return updated;
  }

  static async updateLeadStatusById(
    id: string,
    newStatus: LeadStatus,
    changedBy?: string,
    reason?: string
  ) {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id } });

    if (lead.status === newStatus) return lead;

    return prisma.$transaction(async (tx) => {
      const timestamps: Partial<Prisma.LeadUpdateInput> = {};
      if (newStatus === 'MQL' && !lead.qualifiedAt) {
        timestamps.qualifiedAt = new Date();
      }
      if (newStatus === 'CLIENT' && !lead.convertedAt) {
        timestamps.convertedAt = new Date();
      }

      const updated = await tx.lead.update({
        where: { id },
        data: { status: newStatus, ...timestamps },
      });

      await tx.leadStatusHistory.create({
        data: {
          leadEmail: lead.email,
          fromStatus: lead.status,
          toStatus: newStatus,
          changedBy: changedBy || null,
          reason: reason || null,
        },
      });

      return updated;
    });
  }

  // ----------------------------------------------------------
  // Query: KPI stats for a date range (dashboard cards)
  // ----------------------------------------------------------
  static async getLeadStats(start: Date, end: Date) {
    const [leads, mqls, sqls] = await Promise.all([
      prisma.lead.count({
        where: { deletedAt: null, firstSeenAt: { gte: start, lte: end } },
      }),
      prisma.leadStatusHistory.count({
        where: { toStatus: 'MQL', changedAt: { gte: start, lte: end } },
      }),
      prisma.leadStatusHistory.count({
        where: { toStatus: 'SQL', changedAt: { gte: start, lte: end } },
      }),
    ]);
    return { leads, mqls, sqls };
  }

  // ----------------------------------------------------------
  // Query: drill-down leads for a dashboard card
  // ----------------------------------------------------------
  static async drillDownLeads(params: {
    event?: string;   // 'leads_created' | 'became_mql' | 'became_sql' | 'became_scheduled' | 'became_client' | 'became_lost'
    status?: string;  // current-status filter (Lead por Etapa)
    source?: string;  // firstSource filter (Leads por Canal)
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page     = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, params.pageSize ?? 25));
    const skip     = (page - 1) * pageSize;

    const fromDate = params.from ? new Date(params.from + 'T00:00:00') : undefined;
    const toDate   = params.to   ? new Date(params.to   + 'T23:59:59') : undefined;

    const leadSelect = {
      id: true, email: true, name: true, company: true,
      status: true, firstSeenAt: true, lastSeenAt: true, isHot: true,
    } as const;

    // Case 1: leads created in period
    if (params.event === 'leads_created') {
      const where = {
        deletedAt: null as null,
        ...(fromDate || toDate ? { firstSeenAt: { gte: fromDate, lte: toDate } } : {}),
      };
      const [total, leads] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.findMany({ where, select: leadSelect, orderBy: { firstSeenAt: 'desc' }, skip, take: pageSize }),
      ]);
      return { total, page, pageSize, leads: leads.map(l => ({ ...l, eventDate: l.firstSeenAt })) };
    }

    // Case 2: leads that reached a status in the period (historical query)
    const statusEventMap: Record<string, string> = {
      became_mql:       'MQL',
      became_sql:       'SQL',
      became_scheduled: 'SCHEDULED',
      became_demo:      'DEMO',
      became_proposal:  'PROPOSAL',
      became_client:    'CLIENT',
      became_lost:      'LOST',
    };
    if (params.event && statusEventMap[params.event]) {
      const toStatus = statusEventMap[params.event];
      const histories = await prisma.leadStatusHistory.findMany({
        where: {
          toStatus: toStatus as any,
          ...(fromDate || toDate ? { changedAt: { gte: fromDate, lte: toDate } } : {}),
        },
        select: { leadEmail: true, changedAt: true },
        orderBy: { changedAt: 'desc' },
      });
      // Deduplicate by email, keep most recent event per lead
      const seen = new Set<string>();
      const unique: { leadEmail: string; changedAt: Date }[] = [];
      for (const h of histories) {
        if (!seen.has(h.leadEmail)) { seen.add(h.leadEmail); unique.push(h); }
      }
      const total  = unique.length;
      const paged  = unique.slice(skip, skip + pageSize);
      const emails = paged.map(h => h.leadEmail);
      const leadsData = await prisma.lead.findMany({
        where: { email: { in: emails }, deletedAt: null },
        select: leadSelect,
      });
      const leadsMap = new Map(leadsData.map(l => [l.email, l]));
      const leads = paged
        .map(h => { const l = leadsMap.get(h.leadEmail); return l ? { ...l, eventDate: h.changedAt } : null; })
        .filter((l): l is NonNullable<typeof l> => l !== null);
      return { total, page, pageSize, leads };
    }

    // Case 3: current status filter (Lead por Etapa)
    if (params.status) {
      const where = { deletedAt: null as null, status: params.status as any };
      const [total, leads] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.findMany({ where, select: leadSelect, orderBy: { lastSeenAt: 'desc' }, skip, take: pageSize }),
      ]);
      return { total, page, pageSize, leads: leads.map(l => ({ ...l, eventDate: l.lastSeenAt })) };
    }

    // Case 4: source filter (Leads por Canal)
    if (params.source) {
      const where = { deletedAt: null as null, firstSource: params.source };
      const [total, leads] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.findMany({ where, select: leadSelect, orderBy: { firstSeenAt: 'desc' }, skip, take: pageSize }),
      ]);
      return { total, page, pageSize, leads: leads.map(l => ({ ...l, eventDate: l.firstSeenAt })) };
    }

    return { total: 0, page: 1, pageSize, leads: [] };
  }

  // ----------------------------------------------------------
  // Query: funnel counts by status
  // ----------------------------------------------------------
  static async getFunnelCounts() {
    const counts = await prisma.lead.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { _all: true },
    });

    const result: Record<string, number> = {
      LEAD: 0, MQL: 0, SQL: 0, OPPORTUNITY: 0, CLIENT: 0, LOST: 0, DISQUALIFIED: 0,
    };

    for (const row of counts) {
      result[row.status] = row._count._all;
    }

    return result;
  }

  // ----------------------------------------------------------
  // Mutation: add/remove tags
  // ----------------------------------------------------------
  static async addTag(emailRaw: string, tag: string) {
    const email = normalizeEmail(emailRaw);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { email } });
    if (lead.tags.includes(tag)) return lead;
    const updated = await prisma.lead.update({
      where: { email },
      data: { tags: { push: tag } },
    });
    import('./automation-engine.service').then(({ fireTrigger }) => {
      fireTrigger('tag_added', email, { tag });
    }).catch(() => {});
    return updated;
  }

  static async addTagById(id: string, tag: string) {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id } });
    if (lead.tags.includes(tag)) return lead;
    const updated = await prisma.lead.update({
      where: { id },
      data: { tags: { push: tag } },
    });
    import('./automation-engine.service').then(({ fireTrigger }) => {
      fireTrigger('tag_added', lead.email, { tag });
    }).catch(() => {});
    return updated;
  }

  static async removeTag(emailRaw: string, tag: string) {
    const email = normalizeEmail(emailRaw);
    const lead = await prisma.lead.findUniqueOrThrow({ where: { email } });
    return prisma.lead.update({
      where: { email },
      data: { tags: lead.tags.filter(t => t !== tag) },
    });
  }

  static async removeTagById(id: string, tag: string) {
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id } });
    return prisma.lead.update({
      where: { id },
      data: { tags: lead.tags.filter(t => t !== tag) },
    });
  }

  // ----------------------------------------------------------
  // Mutation: update notes (free-text, overwrite)
  // ----------------------------------------------------------
  static async updateNotes(emailRaw: string, notes: string) {
    const email = normalizeEmail(emailRaw);
    return prisma.lead.update({
      where: { email },
      data: { notes },
    });
  }

  static async updateNotesById(id: string, notes: string) {
    return prisma.lead.update({
      where: { id },
      data: { notes },
    });
  }

  // ----------------------------------------------------------
  // Query: export leads as CSV rows
  // Returns raw data; caller is responsible for serialization.
  // ----------------------------------------------------------
  static async exportLeads(filters: LeadFilter = {}): Promise<Record<string, string>[]> {
    const where: Prisma.LeadWhereInput = { deletedAt: null };

    if (filters.status) where.status = filters.status;
    if (filters.isHot !== undefined) where.isHot = filters.isHot;
    if (filters.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters.startDate || filters.endDate) {
      where.firstSeenAt = {};
      if (filters.startDate) where.firstSeenAt.gte = new Date(`${filters.startDate}T00:00:00`);
      if (filters.endDate) where.firstSeenAt.lte = new Date(`${filters.endDate}T23:59:59`);
    }
    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { name:  { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (filters.customField && filters.customValue) {
      const def = await prisma.leadCustomFieldDef.findUnique({ where: { name: filters.customField } });
      const jsonFilter: Prisma.JsonFilter<'Lead'> = {
        path: [filters.customField],
        ...(def?.fieldType === 'boolean'
          ? { equals: filters.customValue === 'true' }
          : def?.fieldType === 'number'
            ? { equals: Number(filters.customValue) }
            : { string_contains: filters.customValue }),
      };
      where.customFields = jsonFilter;
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      take: 10_000,
      select: {
        email: true, name: true, phone: true, company: true, jobTitle: true,
        city: true, state: true, status: true, score: true, isHot: true,
        tags: true, assignedTo: true, firstSource: true, firstMedium: true,
        firstCampaign: true, firstLandingPage: true, firstSeenAt: true, lastSeenAt: true,
        convertedAt: true, qualifiedAt: true, notes: true,
        _count: { select: { conversions: true } },
      },
    });

    return leads.map(l => ({
      email:          l.email,
      nome:           l.name ?? '',
      telefone:       l.phone ?? '',
      empresa:        l.company ?? '',
      cargo:          l.jobTitle ?? '',
      cidade:         l.city ?? '',
      estado:         l.state ?? '',
      status:         l.status,
      score:          l.score != null ? String(l.score) : '',
      hot:            l.isHot ? 'sim' : 'não',
      tags:           l.tags.join('; '),
      responsavel:    l.assignedTo ?? '',
      origem:         l.firstSource ?? '',
      midia:          l.firstMedium ?? '',
      campanha:       l.firstCampaign ?? '',
      landing_page:   l.firstLandingPage ?? '',
      conversoes:     String(l._count.conversions),
      primeiro_contato: l.firstSeenAt?.toISOString() ?? '',
      ultimo_contato:   l.lastSeenAt?.toISOString() ?? '',
      qualificado_em:   l.qualifiedAt?.toISOString() ?? '',
      convertido_em:    l.convertedAt?.toISOString() ?? '',
      notas:          l.notes ?? '',
    }));
  }

  // ----------------------------------------------------------
  // Query: lead count grouped by firstSource
  // ----------------------------------------------------------
  static async getBySource(): Promise<{ source: string; count: number }[]> {
    const rows = await prisma.lead.groupBy({
      by: ['firstSource'],
      where: { deletedAt: null },
      _count: { id: true },
    });
    return rows
      .map(r => ({ source: r.firstSource || 'Direto', count: r._count.id }))
      .sort((a, b) => b.count - a.count);
  }

  // ----------------------------------------------------------
  // All unique tags across non-deleted leads
  // ----------------------------------------------------------
  static async getAllTags(): Promise<string[]> {
    const rows = await prisma.lead.findMany({
      where: { deletedAt: null },
      select: { tags: true },
    });
    const set = new Set<string>();
    for (const row of rows) {
      for (const tag of row.tags ?? []) set.add(tag);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  // ----------------------------------------------------------
  // Soft delete (never hard delete)
  // ----------------------------------------------------------
  static async deleteLead(emailRaw: string) {
    const email = normalizeEmail(emailRaw);
    return prisma.lead.update({
      where: { email },
      data: { deletedAt: new Date() },
    });
  }

  static async deleteLeadById(id: string) {
    return prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ----------------------------------------------------------
  // One-time migration: WebhookLead → Lead + LeadConversion
  // Safe to run multiple times (idempotent via externalId dedup).
  // ----------------------------------------------------------
  static async migrateWebhookLeads(): Promise<{ migrated: number; skipped: number; errors: number }> {
    const webhookLeads = await prisma.webhookLead.findMany();
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const wl of webhookLeads) {
      if (!wl.email) { skipped++; continue; }
      const email = normalizeEmail(wl.email);

      try {
        await prisma.$transaction(async (tx) => {
          // Upsert lead (fill-blank)
          const existing = await tx.lead.findUnique({ where: { email } });
          if (!existing) {
            await tx.lead.create({
              data: {
                email,
                name:       wl.name       || null,
                phone:      wl.phone      || null,
                company:    wl.company    || null,
                firstSource: 'rdstation_webhook',
                firstSeenAt: wl.lastConversionDate ?? new Date(),
                lastSeenAt:  wl.lastConversionDate ?? new Date(),
              },
            });
          } else {
            await tx.lead.update({
              where: { email },
              data: {
                name:    existing.name    || wl.name    || null,
                phone:   existing.phone   || wl.phone   || null,
                company: existing.company || wl.company || null,
              },
            });
          }

          // Dedup: skip if conversion already recorded
          if (wl.externalId) {
            const dup = await tx.leadConversion.findUnique({
              where: { externalId_source: { externalId: wl.externalId, source: 'rdstation_webhook' } },
            });
            if (dup) return;
          }

          await tx.leadConversion.create({
            data: {
              leadEmail:      email,
              source:         'rdstation_webhook',
              externalId:     wl.externalId,
              campaignName:   wl.conversionName   || null,
              formName:       wl.conversionIdentifier || null,
              rawData:        { externalId: wl.externalId, conversionIdentifier: wl.conversionIdentifier },
              convertedAt:    wl.lastConversionDate ?? new Date(),
            },
          });
        });
        migrated++;
      } catch {
        errors++;
      }
    }

    return { migrated, skipped, errors };
  }
}
