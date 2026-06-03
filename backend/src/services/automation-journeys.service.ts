import { prisma } from '../config/database';

export interface JourneyNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  config?: Record<string, unknown>;
}

export interface JourneyEdge {
  id: string;
  source: string;
  target: string;
}

export interface AutomationJourneyInput {
  name: string;
  description?: string | null;
  status?: string;
  nodes?: JourneyNode[];
  edges?: JourneyEdge[];
  triggerType?: string | null;
  isActive?: boolean;
}

const validStatus = (status?: string) => {
  if (!status) return 'DRAFT';
  const normalized = status.toUpperCase();
  return ['DRAFT', 'ACTIVE', 'PAUSED'].includes(normalized) ? normalized : 'DRAFT';
};

export class AutomationJourneysService {
  static async list() {
    return (prisma as any).automationJourney.findMany({
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  static async create(input: AutomationJourneyInput) {
    if (!input.name?.trim()) throw new Error('name is required');

    const status = validStatus(input.status);
    return (prisma as any).automationJourney.create({
      data: {
        name: input.name.trim(),
        description: input.description || null,
        status,
        isActive: input.isActive ?? status === 'ACTIVE',
        triggerType: input.triggerType || null,
        nodes: input.nodes ?? [],
        edges: input.edges ?? [],
      },
    });
  }

  static async update(id: string, input: Partial<AutomationJourneyInput>) {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description || null;
    if (input.status !== undefined) {
      const status = validStatus(input.status);
      data.status = status;
      data.isActive = status === 'ACTIVE';
    }
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.triggerType !== undefined) data.triggerType = input.triggerType || null;
    if (input.nodes !== undefined) data.nodes = input.nodes;
    if (input.edges !== undefined) data.edges = input.edges;

    return (prisma as any).automationJourney.update({ where: { id }, data });
  }

  static async remove(id: string) {
    return (prisma as any).automationJourney.delete({ where: { id } });
  }

  static async getExecutions(journeyId: string, limit = 50) {
    const executions = await prisma.automationExecution.findMany({
      where: { journeyId },
      orderBy: { startedAt: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
    });

    // Enrich with lead name
    const emails = [...new Set(executions.map(e => e.leadEmail))];
    const leads = await prisma.lead.findMany({
      where: { email: { in: emails } },
      select: { email: true, name: true, id: true },
    });
    const leadMap = Object.fromEntries(leads.map(l => [l.email, l]));

    return executions.map(e => ({
      ...e,
      leadName: leadMap[e.leadEmail]?.name ?? null,
      leadId:   leadMap[e.leadEmail]?.id   ?? null,
    }));
  }

  static async getExecutionStats(journeyId: string) {
    const counts = await prisma.automationExecution.groupBy({
      by: ['status'],
      where: { journeyId },
      _count: { _all: true },
    });
    const result = { running: 0, waiting: 0, completed: 0, failed: 0, total: 0 };
    for (const row of counts) {
      const s = row.status as keyof typeof result;
      if (s in result) result[s] = row._count._all;
      result.total += row._count._all;
    }
    return result;
  }
}
