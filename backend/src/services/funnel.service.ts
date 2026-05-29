import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

export type UpdateFunnelInput = Partial<CreateFunnelInput> & {
  sortOrder?: number;
  isActive?:  boolean;
};

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
    if (input.sortOrder         !== undefined) data.sortOrder         = input.sortOrder;
    if (input.isActive          !== undefined) data.isActive          = input.isActive;
    return prisma.funnel.update({ where: { id }, data });
  }

  static async remove(id: string) {
    return prisma.funnel.update({ where: { id }, data: { isActive: false } });
  }

  // ── Stats for a specific funnel (or unified when funnelId is null) ─────────

  static async getStats(funnelId: string | null, startDate?: string, endDate?: string) {
    // Resolve funnel config
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

    // Build lead WHERE — prefer tag-based; fall back to UTM filters for legacy funnels
    const where: Prisma.LeadWhereInput = { deletedAt: null };
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
        if (funnel.filterSource)      where.firstSource      = funnel.filterSource;
        if (funnel.filterMedium)      where.firstMedium      = funnel.filterMedium;
        if (funnel.filterCampaign)    where.firstCampaign    = funnel.filterCampaign;
        if (funnel.filterLandingPage) where.firstLandingPage = funnel.filterLandingPage;
      }
    }

    // Parallel: leads, GA4 pages, campaign ad spend
    const pages       = funnel?.impressionPages ?? [];
    const campaignIds = funnel?.campaignIds     ?? [];
    const ga4Where    = pages.length       > 0 ? { path: { in: pages } }          : undefined;
    const adsWhere    = campaignIds.length > 0 ? { campaignId: { in: campaignIds } } : undefined;

    const [statusRows, leadEmails, ga4Agg, adsAgg] = await Promise.all([
      prisma.lead.groupBy({ by: ['status'], where, _count: { id: true } }),
      prisma.lead.findMany({ where, select: { email: true } }),
      ga4Where
        ? prisma.landingPage.aggregate({
            where: ga4Where,
            _sum: { views: true, totalClicks: true, users: true },
          })
        : Promise.resolve({ _sum: { views: 0, totalClicks: 0, users: 0 } }),
      adsWhere
        ? prisma.campaignMetrics.aggregate({
            where: adsWhere,
            _sum: { spend: true, impressions: true, clicks: true },
          })
        : Promise.resolve({ _sum: { spend: 0, impressions: 0, clicks: 0 } }),
    ]);

    // Status counts
    const counts: Record<string, number> = {
      LEAD: 0, MQL: 0, SQL: 0,
      SCHEDULED: 0, DEMO: 0, PROPOSAL: 0,
      CLIENT: 0, LOST: 0, DISQUALIFIED: 0,
    };
    for (const row of statusRows) counts[row.status] = row._count.id;

    // MRR
    const emails = leadEmails.map(l => l.email);
    const mrrAgg = emails.length > 0
      ? await prisma.revenueEntry.aggregate({
          where: { leadEmail: { in: emails } },
          _sum: { mrrValue: true },
        })
      : { _sum: { mrrValue: 0 } };

    return {
      funnelCounts:   counts,
      totalLeads:     emails.length,
      mrr:            mrrAgg._sum.mrrValue    || 0,
      impressions:    ga4Agg._sum.views       || 0,
      gaClicks:       ga4Agg._sum.totalClicks || 0,
      gaUsers:        ga4Agg._sum.users       || 0,
      adSpend:        adsAgg._sum.spend       || 0,
      adImpressions:  adsAgg._sum.impressions || 0,
      adClicks:       adsAgg._sum.clicks      || 0,
    };
  }
}
