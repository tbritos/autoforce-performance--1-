import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import { blockingSuppressionScopes, NEWSLETTER_AUDIENCE_ID } from './email-preferences.service';

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

export class SegmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SegmentValidationError';
  }
}

type SegmentBuildDependencies = {
  loadRules?: (segmentId: string) => Promise<SegmentRules | null>;
  newsletterWhere?: () => Promise<Prisma.LeadWhereInput>;
};

export class SegmentService {

  private static newsletterSegment(leadCount?: number) {
    return {
      id: NEWSLETTER_AUDIENCE_ID,
      name: 'Newsletter — Inscritos',
      description: 'Base ativa menos quem se descadastrou da newsletter ou denunciou spam.',
      color: '#4057df',
      rules: { logic: 'AND' as const, conditions: [] },
      createdBy: 'system',
      createdAt: new Date(0),
      updatedAt: new Date(),
      system: true,
      ...(leadCount !== undefined ? { leadCount } : {}),
    };
  }

  private static async newsletterEligibleWhere(): Promise<Prisma.LeadWhereInput> {
    const blocked = await prisma.emailSuppression.findMany({
      where: { scope: { in: blockingSuppressionScopes('NEWSLETTER') } },
      select: { email: true },
    });
    return {
      deletedAt: null,
      status: { not: 'DISQUALIFIED' },
      ...(blocked.length ? { email: { notIn: blocked.map(item => item.email) } } : {}),
    };
  }

  private static csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const text = Array.isArray(value)
      ? value.join(', ')
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
    return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  static async buildWhere(
    rules: SegmentRules,
    lineage: string[] = [],
    dependencies: SegmentBuildDependencies = {},
  ): Promise<Prisma.LeadWhereInput> {
    const base: Prisma.LeadWhereInput = { deletedAt: null };
    if (!rules.conditions || !rules.conditions.length) return base;

    const clauses = (await Promise.all(rules.conditions.map(async condition => {
      if (condition.field !== 'segment') return SegmentService.conditionToWhere(condition);

      const segmentId = typeof condition.value === 'string' ? condition.value.trim() : '';
      if (!segmentId) throw new SegmentValidationError('Selecione uma segmentação para esta condição.');
      if (!['in_segment', 'not_in_segment'].includes(condition.operator)) {
        throw new SegmentValidationError('Operador de segmentação inválido.');
      }
      if (lineage.includes(segmentId)) {
        throw new SegmentValidationError('Esta regra cria uma referência circular entre segmentações.');
      }

      let referencedWhere: Prisma.LeadWhereInput;
      if (segmentId === NEWSLETTER_AUDIENCE_ID) {
        referencedWhere = await (dependencies.newsletterWhere ?? SegmentService.newsletterEligibleWhere)();
      } else {
        const referencedRules = dependencies.loadRules
          ? await dependencies.loadRules(segmentId)
          : await prisma.segment.findUnique({ where: { id: segmentId } })
              .then(referenced => referenced?.rules as unknown as SegmentRules | undefined);
        if (!referencedRules) throw new SegmentValidationError('A segmentação selecionada não existe mais.');
        referencedWhere = await SegmentService.buildWhere(
          referencedRules,
          [...lineage, segmentId],
          dependencies,
        );
      }

      return condition.operator === 'in_segment'
        ? referencedWhere
        : { NOT: referencedWhere };
    }))).filter((clause): clause is Prisma.LeadWhereInput => clause !== null && Object.keys(clause).length > 0);

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
    const rulesById = new Map(segments.map(segment => [segment.id, segment.rules as unknown as SegmentRules]));
    const newsletterWherePromise = SegmentService.newsletterEligibleWhere();
    const dependencies: SegmentBuildDependencies = {
      loadRules: async id => rulesById.get(id) ?? null,
      newsletterWhere: () => newsletterWherePromise,
    };
    const [newsletterWhere, withCounts] = await Promise.all([
      newsletterWherePromise,
      Promise.all(segments.map(async seg => {
      const rules = seg.rules as unknown as SegmentRules;
      const count = await prisma.lead.count({ where: await SegmentService.buildWhere(rules, [seg.id], dependencies) });
      return { ...seg, leadCount: count };
      })),
    ]);
    const newsletterCount = await prisma.lead.count({ where: newsletterWhere });
    return [SegmentService.newsletterSegment(newsletterCount), ...withCounts];
  }

  static async getSegment(id: string) {
    if (id === NEWSLETTER_AUDIENCE_ID) {
      const count = await prisma.lead.count({ where: await SegmentService.newsletterEligibleWhere() });
      return SegmentService.newsletterSegment(count);
    }
    return prisma.segment.findUniqueOrThrow({ where: { id } });
  }

  static async createSegment(data: { name: string; description?: string; color?: string; rules: SegmentRules; createdBy?: string }) {
    await SegmentService.buildWhere(data.rules);
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
    if (id === NEWSLETTER_AUDIENCE_ID) throw new Error('Este segmento é gerenciado automaticamente pelo sistema.');
    if (data.rules !== undefined) await SegmentService.buildWhere(data.rules, [id]);
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
    if (id === NEWSLETTER_AUDIENCE_ID) throw new Error('Este segmento é gerenciado automaticamente pelo sistema.');
    const segments = await prisma.segment.findMany({ select: { id: true, name: true, rules: true } });
    const dependents = segments.filter(segment => {
      if (segment.id === id) return false;
      const rules = segment.rules as unknown as SegmentRules;
      return (rules.conditions ?? []).some(condition => condition.field === 'segment' && condition.value === id);
    });
    if (dependents.length) {
      const names = dependents.slice(0, 3).map(segment => segment.name).join(', ');
      throw new SegmentValidationError(`Este segmento é usado por: ${names}. Remova essa regra antes de excluí-lo.`);
    }
    return prisma.segment.delete({ where: { id } });
  }

  static async previewCount(rules: SegmentRules, segmentId?: string): Promise<number> {
    return prisma.lead.count({ where: await SegmentService.buildWhere(rules, segmentId ? [segmentId] : []) });
  }

  static async getSegmentLeads(id: string, page = 1, pageSize = 25) {
    if (id === NEWSLETTER_AUDIENCE_ID) {
      const where = await SegmentService.newsletterEligibleWhere();
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
    const seg = await prisma.segment.findUniqueOrThrow({ where: { id } });
    const rules = seg.rules as unknown as SegmentRules;
    const where = await SegmentService.buildWhere(rules, [id]);
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

  static async exportSegment(id: string) {
    const seg = await SegmentService.getSegment(id);
    const where = id === NEWSLETTER_AUDIENCE_ID
      ? await SegmentService.newsletterEligibleWhere()
      : await SegmentService.buildWhere(seg.rules as unknown as SegmentRules, [id]);
    const leads = await prisma.lead.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      select: {
        name: true, email: true, phone: true, company: true, jobTitle: true,
        city: true, state: true, status: true, score: true, aiScore: true,
        isHot: true, firstSource: true, firstMedium: true, firstCampaign: true,
        assignedTo: true, tags: true, firstSeenAt: true, lastSeenAt: true,
        siteUrl: true, customFields: true,
      },
    });

    const headers = [
      'Nome', 'E-mail', 'Telefone', 'Empresa', 'Cargo', 'Cidade', 'Estado',
      'Status', 'Score', 'Score Lara', 'Lead quente', 'Fonte', 'UTM Medium',
      'Campanha', 'Responsável', 'Tags', 'Site', 'Criado em', 'Última atividade',
      'Campos personalizados',
    ];
    const rows = leads.map(lead => [
      lead.name, lead.email, lead.phone, lead.company, lead.jobTitle, lead.city,
      lead.state, lead.status, lead.score, lead.aiScore, lead.isHot ? 'Sim' : 'Não',
      lead.firstSource, lead.firstMedium, lead.firstCampaign, lead.assignedTo,
      lead.tags, lead.siteUrl, lead.firstSeenAt.toISOString(), lead.lastSeenAt.toISOString(),
      lead.customFields,
    ].map(SegmentService.csvCell));

    return {
      filename: `segmento-${seg.name.trim().toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || id}.csv`,
      count: leads.length,
      csv: '\uFEFF' + [headers, ...rows].map(row => row.join(';')).join('\r\n'),
    };
  }
}
