import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

function generateShortCode(): string {
  return crypto.randomBytes(4).toString('hex'); // ex: "a3f9c1b2"
}

// ============================================================
// UTMLinksService
// Creates, lists, and manages UTM-tagged links.
//
// utm_source / utm_medium accept only whitelisted values so
// that reports stay clean (no free-text variation).
// ============================================================

export const UTM_SOURCES = [
  'instagram', 'facebook', 'linkedin', 'google', 'youtube',
  'tiktok', 'whatsapp', 'email', 'direto',
] as const;

export const UTM_MEDIUMS = [
  'organico', 'pago', 'stories', 'reels', 'feed', 'carrossel',
  'display', 'email', 'cpc', 'video', 'blog',
] as const;

export type UTMSource = typeof UTM_SOURCES[number];
export type UTMMedium = typeof UTM_MEDIUMS[number];

export interface CreateUTMLinkInput {
  createdBy: string;
  title?: string;
  destinationUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent?: string;
  utmTerm?: string;
  campaignId?: string;
  isTemplate?: boolean;
  templateName?: string;
}

export interface UTMLinkFilter {
  search?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  createdBy?: string;
  isTemplate?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

function buildFullUrl(base: string, params: Record<string, string | undefined>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

export const UTMLinksService = {

  async create(input: CreateUTMLinkInput) {
    // Validate destination URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(input.destinationUrl);
    } catch {
      throw new Error('URL de destino inválida');
    }

    const fullUrl = buildFullUrl(parsedUrl.toString(), {
      utm_source:   input.utmSource,
      utm_medium:   input.utmMedium,
      utm_campaign: input.utmCampaign,
      utm_content:  input.utmContent,
      utm_term:     input.utmTerm,
    });

    return prisma.uTMLink.create({
      data: {
        createdBy:      input.createdBy,
        title:          input.title?.trim()   || null,
        destinationUrl: input.destinationUrl,
        fullUrl,
        shortCode:      generateShortCode(),
        utmSource:      input.utmSource,
        utmMedium:      input.utmMedium,
        utmCampaign:    input.utmCampaign,
        utmContent:     input.utmContent      || null,
        utmTerm:        input.utmTerm         || null,
        campaignId:     input.campaignId      || null,
        isTemplate:     input.isTemplate      ?? false,
        templateName:   input.templateName?.trim() || null,
      },
    });
  },

  async list(filters: UTMLinkFilter = {}) {
    const page     = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));
    const skip     = (page - 1) * pageSize;

    const where: Prisma.UTMLinkWhereInput = { deletedAt: null };

    if (filters.isTemplate !== undefined) where.isTemplate = filters.isTemplate;
    if (filters.utmSource)   where.utmSource   = filters.utmSource;
    if (filters.utmMedium)   where.utmMedium   = filters.utmMedium;
    if (filters.utmCampaign) where.utmCampaign = { contains: filters.utmCampaign, mode: 'insensitive' };
    if (filters.createdBy)   where.createdBy   = filters.createdBy;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(`${filters.startDate}T00:00:00`);
      if (filters.endDate)   where.createdAt.lte = new Date(`${filters.endDate}T23:59:59`);
    }

    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { title:          { contains: q, mode: 'insensitive' } },
        { utmCampaign:    { contains: q, mode: 'insensitive' } },
        { destinationUrl: { contains: q, mode: 'insensitive' } },
        { fullUrl:        { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, links] = await Promise.all([
      prisma.uTMLink.count({ where }),
      prisma.uTMLink.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true, title: true, destinationUrl: true, fullUrl: true,
          shortCode: true,
          utmSource: true, utmMedium: true, utmCampaign: true,
          utmContent: true, utmTerm: true, clicks: true,
          isTemplate: true, templateName: true, isFavorite: true,
          createdBy: true, campaignId: true, createdAt: true,
        },
      }),
    ]);

    return { links, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  },

  async listTemplates() {
    return prisma.uTMLink.findMany({
      where: { isTemplate: true, deletedAt: null },
      orderBy: { templateName: 'asc' },
      select: {
        id: true, templateName: true, utmSource: true,
        utmMedium: true, utmCampaign: true, utmContent: true, utmTerm: true,
      },
    });
  },

  async toggleFavorite(id: string) {
    const link = await prisma.uTMLink.findUniqueOrThrow({ where: { id } });
    return prisma.uTMLink.update({
      where: { id },
      data: { isFavorite: !link.isFavorite },
    });
  },

  async softDelete(id: string) {
    return prisma.uTMLink.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },

  async incrementClicks(shortCode: string): Promise<string | null> {
    const link = await prisma.uTMLink.findUnique({
      where: { shortCode, deletedAt: null },
      select: { fullUrl: true },
    });
    if (!link) return null;
    await prisma.uTMLink.update({
      where: { shortCode },
      data: { clicks: { increment: 1 } },
    });
    return link.fullUrl;
  },

  // Returns campaigns for the UTM builder campaign dropdown
  async listCampaignsForPicker() {
    return prisma.campaign.findMany({
      where: { deletedAt: null },
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true, platform: true },
      take: 200,
    });
  },
};
