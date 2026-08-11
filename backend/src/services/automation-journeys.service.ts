import { prisma } from '../config/database';
import {
  AutomationType,
  deriveEntryMode,
  normalizeAutomationPriority,
  normalizeAutomationType,
  normalizeQueueTtlHours,
  suggestedPriorityForEntry,
} from './automation-priority.utils';

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

export interface ExitConditionRule {
  field: string;
  operator: string;
  value: string;
}

export interface ExitConditions {
  logic: 'AND' | 'OR';
  conditions: ExitConditionRule[];
}

export interface AutomationJourneyInput {
  name: string;
  description?: string | null;
  status?: string;
  nodes?: JourneyNode[];
  edges?: JourneyEdge[];
  triggerType?: string | null;
  isActive?: boolean;
  exitConditions?: ExitConditions | null;
  automationType?: AutomationType;
  priority?: number;
  canInterruptLowerPriority?: boolean;
  queueTtlHours?: number | null;
  nurtureGroupId?: string | null;
}

export interface AutomationNurtureGroupInput {
  name: string;
  priority?: number;
  canInterruptLowerPriority?: boolean;
  queueTtlHours?: number | null;
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
      include: {
        _count: { select: { executions: true } },
        nurtureGroup: true,
      },
    });
  }

  static async create(input: AutomationJourneyInput) {
    if (!input.name?.trim()) throw new Error('name is required');

    const status = validStatus(input.status);
    const automationType = normalizeAutomationType(input.automationType);
    const isActive = input.isActive ?? status === 'ACTIVE';
    if (isActive && automationType === 'UNCLASSIFIED') {
      throw new Error('Classifique a automação como fluxo de nutrição ou automação avulsa antes de publicar.');
    }
    return (prisma as any).automationJourney.create({
      data: {
        name: input.name.trim(),
        description: input.description || null,
        status,
        isActive,
        triggerType: input.triggerType || null,
        nodes: input.nodes ?? [],
        edges: input.edges ?? [],
        exitConditions: input.exitConditions ?? null,
        automationType,
        entryMode: deriveEntryMode(input.nodes),
        priority: normalizeAutomationPriority(input.priority ?? suggestedPriorityForEntry(input.nodes)),
        canInterruptLowerPriority: input.canInterruptLowerPriority ?? true,
        queueTtlHours: normalizeQueueTtlHours(input.queueTtlHours),
        nurtureGroupId: automationType === 'NURTURE' ? input.nurtureGroupId || null : null,
      },
      include: { nurtureGroup: true },
    });
  }

  static async update(id: string, input: Partial<AutomationJourneyInput>) {
    const current = await prisma.automationJourney.findUniqueOrThrow({ where: { id }, select: { automationType: true, nurtureGroupId: true } });
    const data: Record<string, unknown> = {};
    const requestedStatus = input.status !== undefined ? validStatus(input.status) : undefined;
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description || null;
    if (requestedStatus !== undefined) {
      data.status = requestedStatus;
      data.isActive = requestedStatus === 'ACTIVE';
    } else if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }
    if (input.triggerType !== undefined) data.triggerType = input.triggerType || null;
    if (input.nodes !== undefined) {
      data.nodes = input.nodes;
      data.entryMode = deriveEntryMode(input.nodes);
    }
    if (input.edges !== undefined) data.edges = input.edges;
    if (input.exitConditions !== undefined) data.exitConditions = input.exitConditions;
    if (input.automationType !== undefined) data.automationType = normalizeAutomationType(input.automationType);
    if (input.priority !== undefined) data.priority = normalizeAutomationPriority(input.priority);
    if (input.canInterruptLowerPriority !== undefined) data.canInterruptLowerPriority = Boolean(input.canInterruptLowerPriority);
    if (input.queueTtlHours !== undefined) data.queueTtlHours = normalizeQueueTtlHours(input.queueTtlHours);
    if (input.nurtureGroupId !== undefined) data.nurtureGroupId = input.nurtureGroupId || null;

    const willBeActive = requestedStatus === 'ACTIVE' || (requestedStatus === undefined && input.isActive === true);
    const nextType = normalizeAutomationType(input.automationType ?? current.automationType);
    if (willBeActive && nextType === 'UNCLASSIFIED') {
      throw new Error('Classifique a automação como fluxo de nutrição ou automação avulsa antes de ativar.');
    }

    if (nextType !== 'NURTURE') data.nurtureGroupId = null;

    return (prisma as any).automationJourney.update({ where: { id }, data, include: { nurtureGroup: true } });
  }

  static async listNurtureGroups() {
    return prisma.automationNurtureGroup.findMany({
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { journeys: true } } },
    });
  }

  static async createNurtureGroup(input: AutomationNurtureGroupInput) {
    const name = input.name?.trim();
    if (!name) throw new Error('Informe o nome do grupo de nutrição.');
    return prisma.automationNurtureGroup.create({
      data: {
        name,
        priority: normalizeAutomationPriority(input.priority),
        canInterruptLowerPriority: input.canInterruptLowerPriority ?? true,
        queueTtlHours: normalizeQueueTtlHours(input.queueTtlHours),
      },
      include: { _count: { select: { journeys: true } } },
    });
  }

  static async updateNurtureGroup(id: string, input: Partial<AutomationNurtureGroupInput>) {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error('Informe o nome do grupo de nutrição.');
      data.name = name;
    }
    if (input.priority !== undefined) data.priority = normalizeAutomationPriority(input.priority);
    if (input.canInterruptLowerPriority !== undefined) data.canInterruptLowerPriority = Boolean(input.canInterruptLowerPriority);
    if (input.queueTtlHours !== undefined) data.queueTtlHours = normalizeQueueTtlHours(input.queueTtlHours);
    return prisma.automationNurtureGroup.update({
      where: { id },
      data,
      include: { _count: { select: { journeys: true } } },
    });
  }

  static async remove(id: string) {
    return (prisma as any).automationJourney.delete({ where: { id } });
  }

  static async getExecutions(journeyId: string, limit = 50) {
    // FIX: NaN from Number(undefined) or Number('') causes Prisma error or full scan
    const safeLimit = Math.min(100, Math.max(1, Number.isFinite(limit) ? limit : 50));
    const executions = await prisma.automationExecution.findMany({
      where: { journeyId },
      orderBy: { startedAt: 'desc' },
      take: safeLimit,
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

  static async testRun(journeyId: string, leadEmail: string, startNodeId?: string): Promise<{ executionId: string }> {
    const { testJourneyForLead } = await import('./automation-engine.service');
    return testJourneyForLead(journeyId, leadEmail.toLowerCase().trim(), startNodeId);
  }

  static async getExecutionStats(journeyId: string) {
    const counts = await prisma.automationExecution.groupBy({
      by: ['status'],
      where: { journeyId },
      _count: { _all: true },
    });
    const result = { running: 0, waiting: 0, queued: 0, completed: 0, failed: 0, cancelled: 0, total: 0 };
    for (const row of counts) {
      const s = row.status as keyof typeof result;
      if (s in result) result[s] = row._count._all;
      result.total += row._count._all;
    }
    return result;
  }
}
