import { prisma } from '../config/database';
import { Prisma, LeadStatus } from '@prisma/client';
import { getGA4PageTotals } from './googleAnalytics.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FunnelStageInput {
  id:     string;
  name:   string;
  source: string;
  color?: string;
}

export interface CreateFunnelInput {
  name:             string;
  description?:     string;
  color?:           string;
  filterSource?:    string;
  filterMedium?:    string;
  filterCampaign?:  string;
  filterLandingPage?: string;
  leadTags?:        string[];
  impressionPages?: string[];
  campaignIds?:     string[];
  stagesConfig?:    FunnelStageInput[];
}

export type UpdateFunnelInput = Partial<CreateFunnelInput> & {
  sortOrder?: number;
  isActive?:  boolean;
};

// Ordinal rank of each forward funnel stage — used to compute, per lead, the highest
// stage it ever reached (current status ⊔ every status recorded in LeadStatusHistory).
// Without this, a lead that reached SQL and was later marked LOST vanishes from the
// SQL/MQL counts entirely (LOST isn't summed into any cumulative stage), which silently
// undercounts every stage in proportion to its loss rate. OPPORTUNITY is legacy (migrated
// to PROPOSAL) but old history rows may still reference it, so it shares PROPOSAL's rank.
const STAGE_ORDER: Partial<Record<LeadStatus, number>> = {
  LEAD: 1, MQL: 2, SQL: 3, SCHEDULED: 4, DEMO: 5, PROPOSAL: 6, OPPORTUNITY: 6, CLIENT: 7,
};

export type CumulativeStageKey = 'LEAD' | 'MQL' | 'SQL' | 'SCHEDULED' | 'DEMO' | 'PROPOSAL' | 'CLIENT';

const CUMULATIVE_STAGES: CumulativeStageKey[] = ['LEAD', 'MQL', 'SQL', 'SCHEDULED', 'DEMO', 'PROPOSAL', 'CLIENT'];

interface ResolvedScope {
  where:            Prisma.LeadWhereInput;
  impressionPages:  string[];
  campaignIds:      string[];
}

// ─── FunnelService ────────────────────────────────────────────────────────────

export class FunnelService {

  static async list() {
    return prisma.funnel.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  static async create(input: CreateFunnelInput) {
    const count = await prisma.funnel.count({ where: { isActive: true } });
    return prisma.funnel.create({
      data: {
        name:              input.name,
        description:       input.description       || null,
        color:             input.color             || '#3b82f6',
        filterSource:      input.filterSource      || null,
        filterMedium:      input.filterMedium      || null,
        filterCampaign:    input.filterCampaign    || null,
        filterLandingPage: input.filterLandingPage || null,
        leadTags:          input.leadTags          ?? [],
        impressionPages:   input.impressionPages   ?? [],
        campaignIds:       input.campaignIds       ?? [],
        stagesConfig:      input.stagesConfig ? (input.stagesConfig as unknown as Prisma.JsonArray) : Prisma.JsonNull,
        sortOrder:         count,
      },
    });
  }

  static async update(id: string, input: UpdateFunnelInput) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (input.name              !== undefined) data.name              = input.name;
    if (input.description       !== undefined) data.description       = input.description       || null;
    if (input.color             !== undefined) data.color             = input.color;
    if (input.filterSource      !== undefined) data.filterSource      = input.filterSource      || null;
    if (input.filterMedium      !== undefined) data.filterMedium      = input.filterMedium      || null;
    if (input.filterCampaign    !== undefined) data.filterCampaign    = input.filterCampaign    || null;
    if (input.filterLandingPage !== undefined) data.filterLandingPage = input.filterLandingPage || null;
    if (input.leadTags          !== undefined) data.leadTags          = input.leadTags;
    if (input.impressionPages   !== undefined) data.impressionPages   = input.impressionPages;
    if (input.campaignIds       !== undefined) data.campaignIds       = input.campaignIds;
    if (input.stagesConfig      !== undefined) data.stagesConfig      = input.stagesConfig ? (input.stagesConfig as unknown as Prisma.JsonArray) : Prisma.JsonNull;
    if (input.sortOrder         !== undefined) data.sortOrder         = input.sortOrder;
    if (input.isActive          !== undefined) data.isActive          = input.isActive;
    return prisma.funnel.update({ where: { id }, data });
  }

  static async remove(id: string) {
    return prisma.funnel.update({ where: { id }, data: { isActive: false } });
  }

  // ── Shared scope resolution (funnel config + Lead WHERE) for stats and drill-down ──

  private static async resolveScope(funnelId: string | null, startDate?: string, endDate?: string): Promise<ResolvedScope> {
    let funnel: {
      leadTags: string[]; impressionPages: string[]; campaignIds: string[];
      filterSource: string | null; filterMedium: string | null;
      filterCampaign: string | null; filterLandingPage: string | null;
    } | null = null;

    if (funnelId) {
      funnel = await prisma.funnel.findUnique({
        where: { id: funnelId },
        select: {
          leadTags: true, impressionPages: true, campaignIds: true,
          filterSource: true, filterMedium: true, filterCampaign: true, filterLandingPage: true,
        },
      });
      if (!funnel) throw new Error(`Funnel ${funnelId} not found`);
    }

    // Leads desqualificados (bot/inoperantes) nao contam em nenhum dashboard.
    const where: Prisma.LeadWhereInput = { deletedAt: null, status: { not: 'DISQUALIFIED' } };
    if (startDate || endDate) {
      where.firstSeenAt = {
        ...(startDate ? { gte: new Date(startDate).toISOString() } : {}),
        ...(endDate   ? { lte: new Date(`${endDate}T23:59:59`).toISOString() } : {}),
      };
    }
    if (funnel) {
      if (funnel.leadTags.length > 0) {
        where.tags = { hasSome: funnel.leadTags };
      } else {
        // firstCampaign/firstLandingPage are stored as the RAW value captured at conversion
        // time (full URL with utm_id/fbclid/etc. query string, or the exact utm_campaign text) —
        // no two visits share the exact same string, so an exact match effectively never hits.
        // `contains` matches the meaningful part (e.g. the page path, or the campaign name)
        // regardless of the tracking noise around it.
        if (funnel.filterSource)      where.firstSource      = funnel.filterSource;
        if (funnel.filterMedium)      where.firstMedium      = funnel.filterMedium;
        if (funnel.filterCampaign)    where.firstCampaign    = { contains: funnel.filterCampaign,    mode: 'insensitive' };
        if (funnel.filterLandingPage) where.firstLandingPage = { contains: funnel.filterLandingPage, mode: 'insensitive' };
      }
    }

    return {
      where,
      impressionPages: funnel?.impressionPages ?? [],
      campaignIds:     funnel?.campaignIds     ?? [],
    };
  }

  // For each lead, the highest funnel-stage rank it ever reached: its current status
  // combined with every status ever recorded for it in LeadStatusHistory.
  private static async computePeakRanks(leads: Array<{ email: string; status: LeadStatus }>): Promise<Map<string, number>> {
    const peak = new Map<string, number>();
    for (const lead of leads) peak.set(lead.email, STAGE_ORDER[lead.status] ?? 0);

    if (leads.length > 0) {
      const history = await prisma.leadStatusHistory.findMany({
        where: { leadEmail: { in: leads.map(l => l.email) } },
        select: { leadEmail: true, toStatus: true },
      });
      for (const h of history) {
        const rank = STAGE_ORDER[h.toStatus];
        if (rank === undefined) continue;
        if (rank > (peak.get(h.leadEmail) ?? 0)) peak.set(h.leadEmail, rank);
      }
    }

    return peak;
  }

  // ── Stats for a specific funnel (or unified when funnelId is null) ─────────

  static async getStats(funnelId: string | null, startDate?: string, endDate?: string) {
    const { where, impressionPages, campaignIds } = await this.resolveScope(funnelId, startDate, endDate);

    const adsWhere = campaignIds.length > 0 ? { campaignId: { in: campaignIds } } : undefined;

    const [statusRows, leads, ga4Agg, adsAgg] = await Promise.all([
      prisma.lead.groupBy({ by: ['status'], where, _count: { id: true } }),
      prisma.lead.findMany({ where, select: { email: true, status: true } }),
      getGA4PageTotals(startDate, endDate, impressionPages),
      adsWhere
        ? prisma.campaignMetrics.aggregate({
            where: adsWhere,
            _sum: { spend: true, impressions: true, clicks: true },
          })
        : Promise.resolve({ _sum: { spend: 0, impressions: 0, clicks: 0 } }),
    ]);

    // Current-status snapshot — used for the "Distribuição por Status" breakdown
    const counts: Record<string, number> = {
      LEAD: 0, MQL: 0, SQL: 0,
      SCHEDULED: 0, DEMO: 0, PROPOSAL: 0,
      CLIENT: 0, LOST: 0, DISQUALIFIED: 0,
    };
    for (const row of statusRows) counts[row.status] = row._count.id;

    // Cumulative "ever reached" counts — used for the funnel bars (fixes leads that
    // were later marked LOST disappearing from the stages they actually passed through)
    const peakRanks = await this.computePeakRanks(leads);
    const everReachedCounts: Record<CumulativeStageKey, number> = {
      LEAD: 0, MQL: 0, SQL: 0, SCHEDULED: 0, DEMO: 0, PROPOSAL: 0, CLIENT: 0,
    };
    for (const rank of peakRanks.values()) {
      for (const stage of CUMULATIVE_STAGES) {
        if (rank >= STAGE_ORDER[stage]!) everReachedCounts[stage]++;
      }
    }

    // MRR
    const emails = leads.map(l => l.email);
    const mrrAgg = emails.length > 0
      ? await prisma.revenueEntry.aggregate({
          where: { leadEmail: { in: emails } },
          _sum: { mrrValue: true },
        })
      : { _sum: { mrrValue: 0 } };

    return {
      funnelCounts:      counts,
      everReachedCounts,
      totalLeads:        emails.length,
      mrr:               mrrAgg._sum.mrrValue    || 0,
      impressions:       ga4Agg.views            || 0,
      gaClicks:          ga4Agg.totalClicks      || 0,
      gaUsers:           ga4Agg.users            || 0,
      adSpend:           adsAgg._sum.spend       || 0,
      adImpressions:     adsAgg._sum.impressions || 0,
      adClicks:          adsAgg._sum.clicks      || 0,
      gaErrors:          ga4Agg.errors,
    };
  }

  // ── Drill-down: leads that ever reached (peak) at least the given stage ────

  static async getLeadsForStage(
    funnelId: string | null,
    stage: CumulativeStageKey,
    startDate?: string,
    endDate?: string,
    page = 1,
    pageSize = 25,
  ): Promise<{
    total: number;
    page: number;
    pageSize: number;
    leads: Array<{
      id: string; email: string; name: string | null; company: string | null;
      phone: string | null; status: LeadStatus; score: number; firstSeenAt: Date;
    }>;
  }> {
    const targetRank = STAGE_ORDER[stage];
    if (targetRank === undefined) throw new Error(`Etapa inválida para drill-down: ${stage}`);

    const { where } = await this.resolveScope(funnelId, startDate, endDate);

    const leads = await prisma.lead.findMany({
      where,
      select: { id: true, email: true, name: true, company: true, phone: true, status: true, score: true, firstSeenAt: true },
    });

    const peakRanks = await this.computePeakRanks(leads);
    const matching = leads
      .filter(l => (peakRanks.get(l.email) ?? 0) >= targetRank)
      .sort((a, b) => b.firstSeenAt.getTime() - a.firstSeenAt.getTime());

    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const skip     = (safePage - 1) * safeSize;

    return {
      total:    matching.length,
      page:     safePage,
      pageSize: safeSize,
      leads:    matching.slice(skip, skip + safeSize),
    };
  }
}
