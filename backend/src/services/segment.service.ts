import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

export type RuleCondition = {
  id: string;
  field: string;
  operator: string;
  value: any;
};

export type SegmentRules = {
  logic: 'AND' | 'OR';
  conditions: RuleCondition[];
};

export class SegmentService {

  static buildWhere(rules: SegmentRules): Prisma.LeadWhereInput {
    const base: Prisma.LeadWhereInput = { deletedAt: null };
    if (!rules.conditions || !rules.conditions.length) return base;

    const clauses = rules.conditions
      .map(c => SegmentService.conditionToWhere(c))
      .filter((c): c is Prisma.LeadWhereInput => c !== null && Object.keys(c).length > 0);

    if (!clauses.length) return base;

    const combined = rules.logic === 'AND' ? { AND: clauses } : { OR: clauses };
    return { ...base, ...combined };
  }

  static conditionToWhere(c: RuleCondition): Prisma.LeadWhereInput | null {
    const { field, operator, value } = c;
    switch (field) {
      case 'status':
        if (operator === 'in')     return { status: { in: value } };
        if (operator === 'not_in') return { NOT: { status: { in: value } } };
        break;
      case 'isHot':
        if (operator === 'is_true')  return { isHot: true };
        if (operator === 'is_false') return { isHot: false };
        break;
      case 'firstSource':  return SegmentService.stringOp('firstSource', operator, value);
      case 'firstMedium':  return SegmentService.stringOp('firstMedium', operator, value);
      case 'company':      return SegmentService.stringOp('company', operator, value);
      case 'assignedTo':   return SegmentService.stringOp('assignedTo', operator, value);
      case 'tags':
        if (operator === 'contains_tag')     return { tags: { has: value } };
        if (operator === 'not_contains_tag') return { NOT: { tags: { has: value } } };
        break;
      case 'score':           return SegmentService.numberOp('score', operator, Number(value));
      case 'firstSeenAt':     return SegmentService.dateOp('firstSeenAt', operator, Number(value));
      case 'lastSeenAt':      return SegmentService.dateOp('lastSeenAt', operator, Number(value));
      case 'conversionCount': return SegmentService.convCountOp(operator, Number(value));
    }
    return null;
  }

  private static stringOp(field: string, operator: string, value: string): Prisma.LeadWhereInput {
    switch (operator) {
      case 'equals':     return { [field]: value };
      case 'not_equals': return { NOT: { [field]: value } };
      case 'contains':   return { [field]: { contains: value, mode: 'insensitive' } };
      case 'is_set':     return { [field]: { not: null } };
      case 'is_not_set': return { [field]: null };
      default:           return {};
    }
  }

  private static numberOp(field: string, operator: string, value: number): Prisma.LeadWhereInput {
    switch (operator) {
      case 'equals': return { [field]: value };
      case 'gte':    return { [field]: { gte: value } };
      case 'lte':    return { [field]: { lte: value } };
      default:       return {};
    }
  }

  private static dateOp(field: string, operator: string, days: number): Prisma.LeadWhereInput {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    switch (operator) {
      case 'in_last_days':    return { [field]: { gte: cutoff } };
      case 'before_days_ago': return { [field]: { lte: cutoff } };
      default:                return {};
    }
  }

  private static convCountOp(operator: string, value: number): Prisma.LeadWhereInput {
    if (operator === 'gte' && value <= 1) return { conversions: { some: {} } };
    if (operator === 'lte' && value === 0) return { conversions: { none: {} } };
    return {};
  }

  static async listSegments() {
    const segments = await prisma.segment.findMany({ orderBy: { createdAt: 'desc' } });
    const withCounts = await Promise.all(segments.map(async seg => {
      const rules = seg.rules as unknown as SegmentRules;
      const count = await prisma.lead.count({ where: SegmentService.buildWhere(rules) });
      return { ...seg, leadCount: count };
    }));
    return withCounts;
  }

  static async getSegment(id: string) {
    return prisma.segment.findUniqueOrThrow({ where: { id } });
  }

  static async createSegment(data: { name: string; description?: string; color?: string; rules: SegmentRules; createdBy?: string }) {
    return prisma.segment.create({
      data: {
        name: data.name,
        description: data.description || null,
        color: data.color || '#6366f1',
        rules: data.rules as unknown as Prisma.JsonObject,
        createdBy: data.createdBy || null,
      },
    });
  }

  static async updateSegment(id: string, data: { name?: string; description?: string; color?: string; rules?: SegmentRules }) {
    return prisma.segment.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.color !== undefined ? { color: data.color } : {}),
        ...(data.rules !== undefined ? { rules: data.rules as unknown as Prisma.JsonObject } : {}),
      },
    });
  }

  static async deleteSegment(id: string) {
    return prisma.segment.delete({ where: { id } });
  }

  static async previewCount(rules: SegmentRules): Promise<number> {
    return prisma.lead.count({ where: SegmentService.buildWhere(rules) });
  }

  static async getSegmentLeads(id: string, page = 1, pageSize = 25) {
    const seg = await prisma.segment.findUniqueOrThrow({ where: { id } });
    const rules = seg.rules as unknown as SegmentRules;
    const where = SegmentService.buildWhere(rules);
    const skip = (page - 1) * pageSize;
    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where, skip, take: pageSize,
        orderBy: { lastSeenAt: 'desc' },
        select: {
          id: true, email: true, name: true, company: true, status: true,
          isHot: true, firstSource: true, firstMedium: true, lastSeenAt: true,
        },
      }),
    ]);
    return { total, page, pageSize, leads };
  }
}
