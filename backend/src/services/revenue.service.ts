import { prisma } from '../config/database';
import { RevenueEntry } from '../../../types';

type RevenueFilters = {
  origin?: string;
  products?: string[];
};

export class RevenueService {
  static async getRevenueHistory(filters?: RevenueFilters): Promise<RevenueEntry[]> {
    const where: {
      origin?: string;
      product?: { hasSome: string[] };
    } = {};

    if (filters?.origin) {
      where.origin = filters.origin;
    }

    if (filters?.products && filters.products.length > 0) {
      where.product = { hasSome: filters.products };
    }

    const revenues = await prisma.revenueEntry.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return revenues.map(rev => ({
      id: rev.id,
      date: rev.date.toISOString().split('T')[0],
      businessName: rev.businessName,
      setupValue: rev.setupValue,
      mrrValue: rev.mrrValue,
      origin: rev.origin,
      product: rev.product,
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
      },
    });

    return {
      id: revenue.id,
      date: revenue.date.toISOString().split('T')[0],
      businessName: revenue.businessName,
      setupValue: revenue.setupValue,
      mrrValue: revenue.mrrValue,
      origin: revenue.origin,
      product: revenue.product,
    };
  }
}
