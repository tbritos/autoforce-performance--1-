import { prisma } from '../config/database';
import { RevenueEntry } from '../types/shared.types';

type RevenueFilters = {
  origin?: string;
  products?: string[];
  leadEmail?: string;
};

export class RevenueService {
  static async getRevenueHistory(filters?: RevenueFilters): Promise<RevenueEntry[]> {
    const where: {
      origin?: string;
      product?: { hasSome: string[] };
      leadEmail?: string;
    } = {};

    if (filters?.origin) {
      where.origin = filters.origin;
    }

    if (filters?.products && filters.products.length > 0) {
      where.product = { hasSome: filters.products };
    }

    if (filters?.leadEmail) {
      where.leadEmail = filters.leadEmail;
    }

    const revenues = await prisma.revenueEntry.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { lead: { select: { name: true } } },
    });

    return revenues.map(rev => ({
      id: rev.id,
      date: rev.date.toISOString().split('T')[0],
      businessName: rev.businessName,
      setupValue: rev.setupValue,
      mrrValue: rev.mrrValue,
      origin: rev.origin,
      product: rev.product,
      leadEmail: rev.leadEmail ?? null,
      leadName: rev.lead?.name ?? null,
    }));
  }

  static async saveRevenueEntry(data: Omit<RevenueEntry, 'id'>): Promise<RevenueEntry> {
    const normalizedProducts = Array.isArray(data.product) ? data.product : [data.product];
    const revenue = await prisma.revenueEntry.create({
      data: {
        date: data.date ? new Date(`${data.date}T00:00:00`) : new Date(),
        businessName: data.businessName,
        setupValue: data.setupValue,
        mrrValue: data.mrrValue,
        origin: data.origin,
        product: normalizedProducts,
        leadEmail: data.leadEmail || null,
      },
      include: { lead: { select: { name: true } } },
    });

    return {
      id: revenue.id,
      date: revenue.date.toISOString().split('T')[0],
      businessName: revenue.businessName,
      setupValue: revenue.setupValue,
      mrrValue: revenue.mrrValue,
      origin: revenue.origin,
      product: revenue.product,
      leadEmail: revenue.leadEmail ?? null,
      leadName: revenue.lead?.name ?? null,
    };
  }

  static async updateRevenueEntry(
    id: string,
    data: Omit<RevenueEntry, 'id'>
  ): Promise<RevenueEntry> {
    const normalizedProducts = Array.isArray(data.product) ? data.product : [data.product];
    const revenue = await prisma.revenueEntry.update({
      where: { id },
      data: {
        date: data.date ? new Date(`${data.date}T00:00:00`) : undefined,
        businessName: data.businessName,
        setupValue: data.setupValue,
        mrrValue: data.mrrValue,
        origin: data.origin,
        product: normalizedProducts,
        leadEmail: data.leadEmail !== undefined ? (data.leadEmail || null) : undefined,
      },
      include: { lead: { select: { name: true } } },
    });

    return {
      id: revenue.id,
      date: revenue.date.toISOString().split('T')[0],
      businessName: revenue.businessName,
      setupValue: revenue.setupValue,
      mrrValue: revenue.mrrValue,
      origin: revenue.origin,
      product: revenue.product,
      leadEmail: revenue.leadEmail ?? null,
      leadName: revenue.lead?.name ?? null,
    };
  }

  static async deleteRevenueEntry(id: string): Promise<void> {
    await prisma.revenueEntry.delete({
      where: { id },
    });
  }
}
