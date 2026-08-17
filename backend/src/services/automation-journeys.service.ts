import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import {
  AutomationType,
  deriveEntryMode,
  normalizeAutomationPriority,
  normalizeAutomationType,
  normalizeQueueTtlHours,
  suggestedPriorityForEntry,
} from './automation-priority.utils';
import { SegmentRules, SegmentService } from './segment.service';
import {
  buildStageMetrics,
  ExitConditions as MonitoringExitConditions,
  matchesExitConditions,
  percentage,
  StageReachedRow,
  StageStatusRow,
} from './automation-monitoring.utils';

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

type EmailMetricRow = {
  nodeId: string | null;
  sentMessages: number;
  sentPeople: number;
  deliveredPeople: number;
  openedPeople: number;
  clickedPeople: number;
  bouncedPeople: number;
  complainedPeople: number;
};

type WhatsAppMetricRow = {
  templateName: string | null;
  attemptedMessages: number;
  sentPeople: number;
  deliveredPeople: number;
  readPeople: number;
  failedPeople: number;
};

const emptyEmailMetric = (): EmailMetricRow => ({
  nodeId: null,
  sentMessages: 0,
  sentPeople: 0,
  deliveredPeople: 0,
  openedPeople: 0,
  clickedPeople: 0,
  bouncedPeople: 0,
  complainedPeople: 0,
});

const emptyWhatsAppMetric = (): WhatsAppMetricRow => ({
  templateName: null,
  attemptedMessages: 0,
  sentPeople: 0,
  deliveredPeople: 0,
  readPeople: 0,
  failedPeople: 0,
});

const validStatus = (status?: string) => {
  if (!status) return 'DRAFT';
  const normalized = status.toUpperCase();
  return ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'].includes(normalized) ? normalized : 'DRAFT';
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
    const isActive = status === 'ACTIVE';
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
      include: { nurtureGroup: true, _count: { select: { executions: true } } },
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

    return (prisma as any).automationJourney.update({
      where: { id },
      data,
      include: { nurtureGroup: true, _count: { select: { executions: true } } },
    });
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
    const journey = await prisma.automationJourney.findUniqueOrThrow({
      where: { id },
      select: {
        name: true,
        nurtureGroupId: true,
        _count: { select: { executions: true } },
      },
    });
    if (journey._count.executions > 0) {
      const error = new Error(`O fluxo "${journey.name}" possui histórico de execuções e deve ser arquivado.`) as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }

    return prisma.$transaction(async transaction => {
      const deleted = await transaction.automationJourney.delete({ where: { id } });
      if (journey.nurtureGroupId) {
        const remaining = await transaction.automationJourney.count({ where: { nurtureGroupId: journey.nurtureGroupId } });
        if (remaining === 0) {
          await transaction.automationNurtureGroup.deleteMany({ where: { id: journey.nurtureGroupId } });
        }
      }
      return deleted;
    });
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
    const journey = await prisma.automationJourney.findUniqueOrThrow({
      where: { id: journeyId },
      select: { nodes: true, edges: true, exitConditions: true },
    });
    const nodes = (journey.nodes as unknown as JourneyNode[]) ?? [];
    const edges = (journey.edges as unknown as JourneyEdge[]) ?? [];

    const [counts, stageGroups, reachedRows, emailTotals, emailByNode, whatsappTotals, whatsappByTemplate, whatsappResponses] = await Promise.all([
      prisma.automationExecution.groupBy({
        by: ['status'],
        where: { journeyId, isTest: false },
        _count: { _all: true },
      }),
      prisma.automationExecution.groupBy({
        by: ['currentNodeId', 'status'],
        where: { journeyId, isTest: false },
        _count: { _all: true },
      }),
      prisma.$queryRaw<Array<{ nodeId: string | null; count: number }>>(Prisma.sql`
        WITH reached AS (
          SELECT execution."id", execution."currentNodeId" AS "nodeId"
          FROM "AutomationExecution" execution
          WHERE execution."journeyId" = ${journeyId}
            AND execution."isTest" = false
            AND execution."currentNodeId" IS NOT NULL
          UNION
          SELECT execution."id", item->>'nodeId' AS "nodeId"
          FROM "AutomationExecution" execution
          CROSS JOIN LATERAL jsonb_array_elements(execution."log") item
          WHERE execution."journeyId" = ${journeyId}
            AND execution."isTest" = false
            AND item->>'nodeId' IS NOT NULL
        )
        SELECT "nodeId", COUNT(DISTINCT "id")::int AS "count"
        FROM reached
        GROUP BY "nodeId"
      `),
      prisma.$queryRaw<EmailMetricRow[]>(Prisma.sql`
        SELECT
          NULL::text AS "nodeId",
          COUNT(*)::int AS "sentMessages",
          COUNT(DISTINCT email."leadEmail")::int AS "sentPeople",
          COUNT(DISTINCT email."leadEmail") FILTER (
            WHERE email."deliveredAt" IS NOT NULL OR email."openedAt" IS NOT NULL OR email."clickedAt" IS NOT NULL
          )::int AS "deliveredPeople",
          COUNT(DISTINCT email."leadEmail") FILTER (
            WHERE email."openedAt" IS NOT NULL OR email."clickedAt" IS NOT NULL
          )::int AS "openedPeople",
          COUNT(DISTINCT email."leadEmail") FILTER (WHERE email."clickedAt" IS NOT NULL)::int AS "clickedPeople",
          COUNT(DISTINCT email."leadEmail") FILTER (WHERE email."bouncedAt" IS NOT NULL)::int AS "bouncedPeople",
          COUNT(DISTINCT email."leadEmail") FILTER (WHERE email."complainedAt" IS NOT NULL)::int AS "complainedPeople"
        FROM "EmailSent" email
        INNER JOIN "AutomationExecution" execution ON execution."id" = email."automationExecutionId"
        WHERE execution."journeyId" = ${journeyId} AND execution."isTest" = false
      `),
      prisma.$queryRaw<EmailMetricRow[]>(Prisma.sql`
        SELECT
          email."automationNodeId" AS "nodeId",
          COUNT(*)::int AS "sentMessages",
          COUNT(DISTINCT email."leadEmail")::int AS "sentPeople",
          COUNT(DISTINCT email."leadEmail") FILTER (
            WHERE email."deliveredAt" IS NOT NULL OR email."openedAt" IS NOT NULL OR email."clickedAt" IS NOT NULL
          )::int AS "deliveredPeople",
          COUNT(DISTINCT email."leadEmail") FILTER (
            WHERE email."openedAt" IS NOT NULL OR email."clickedAt" IS NOT NULL
          )::int AS "openedPeople",
          COUNT(DISTINCT email."leadEmail") FILTER (WHERE email."clickedAt" IS NOT NULL)::int AS "clickedPeople",
          COUNT(DISTINCT email."leadEmail") FILTER (WHERE email."bouncedAt" IS NOT NULL)::int AS "bouncedPeople",
          COUNT(DISTINCT email."leadEmail") FILTER (WHERE email."complainedAt" IS NOT NULL)::int AS "complainedPeople"
        FROM "EmailSent" email
        INNER JOIN "AutomationExecution" execution ON execution."id" = email."automationExecutionId"
        WHERE execution."journeyId" = ${journeyId} AND execution."isTest" = false
        GROUP BY email."automationNodeId"
      `),
      prisma.$queryRaw<WhatsAppMetricRow[]>(Prisma.sql`
        SELECT
          NULL::text AS "templateName",
          COUNT(*)::int AS "attemptedMessages",
          COUNT(DISTINCT message."leadEmail") FILTER (WHERE message."status" <> 'failed')::int AS "sentPeople",
          COUNT(DISTINCT message."leadEmail") FILTER (
            WHERE message."deliveredAt" IS NOT NULL OR message."readAt" IS NOT NULL OR message."status" IN ('delivered', 'read')
          )::int AS "deliveredPeople",
          COUNT(DISTINCT message."leadEmail") FILTER (
            WHERE message."readAt" IS NOT NULL OR message."status" = 'read'
          )::int AS "readPeople",
          COUNT(DISTINCT message."leadEmail") FILTER (
            WHERE message."failedAt" IS NOT NULL OR message."status" = 'failed'
          )::int AS "failedPeople"
        FROM "WhatsAppMessage" message
        INNER JOIN "AutomationExecution" execution ON execution."id" = message."automationExecutionId"
        WHERE execution."journeyId" = ${journeyId}
          AND execution."isTest" = false
          AND message."direction" = 'outbound'
      `),
      prisma.$queryRaw<WhatsAppMetricRow[]>(Prisma.sql`
        SELECT
          message."templateName" AS "templateName",
          COUNT(*)::int AS "attemptedMessages",
          COUNT(DISTINCT message."leadEmail") FILTER (WHERE message."status" <> 'failed')::int AS "sentPeople",
          COUNT(DISTINCT message."leadEmail") FILTER (
            WHERE message."deliveredAt" IS NOT NULL OR message."readAt" IS NOT NULL OR message."status" IN ('delivered', 'read')
          )::int AS "deliveredPeople",
          COUNT(DISTINCT message."leadEmail") FILTER (
            WHERE message."readAt" IS NOT NULL OR message."status" = 'read'
          )::int AS "readPeople",
          COUNT(DISTINCT message."leadEmail") FILTER (
            WHERE message."failedAt" IS NOT NULL OR message."status" = 'failed'
          )::int AS "failedPeople"
        FROM "WhatsAppMessage" message
        INNER JOIN "AutomationExecution" execution ON execution."id" = message."automationExecutionId"
        WHERE execution."journeyId" = ${journeyId}
          AND execution."isTest" = false
          AND message."direction" = 'outbound'
        GROUP BY message."templateName"
      `),
      prisma.$queryRaw<Array<{ respondedPeople: number }>>(Prisma.sql`
        WITH outbound AS (
          SELECT message."leadEmail", MIN(COALESCE(message."sentAt", message."createdAt")) AS "firstSentAt"
          FROM "WhatsAppMessage" message
          INNER JOIN "AutomationExecution" execution ON execution."id" = message."automationExecutionId"
          WHERE execution."journeyId" = ${journeyId}
            AND execution."isTest" = false
            AND message."direction" = 'outbound'
            AND message."leadEmail" IS NOT NULL
          GROUP BY message."leadEmail"
        )
        SELECT COUNT(DISTINCT inbound."leadEmail")::int AS "respondedPeople"
        FROM outbound
        INNER JOIN "WhatsAppMessage" inbound
          ON inbound."leadEmail" = outbound."leadEmail"
          AND inbound."direction" = 'inbound'
          AND inbound."createdAt" >= outbound."firstSentAt"
      `),
    ]);

    const result = { running: 0, waiting: 0, queued: 0, completed: 0, failed: 0, cancelled: 0, total: 0 };
    for (const row of counts) {
      const s = row.status as keyof typeof result;
      if (s in result) result[s] = row._count._all;
      result.total += row._count._all;
    }

    const trigger = nodes.find(node => node.type === 'trigger');
    const reached = reachedRows as StageReachedRow[];
    if (trigger && !reached.some(row => row.nodeId === trigger.id)) {
      reached.push({ nodeId: trigger.id, count: result.total });
    }
    const stages = buildStageMetrics(
      nodes,
      edges,
      stageGroups.map(row => ({ currentNodeId: row.currentNodeId, status: row.status, count: row._count._all })) as StageStatusRow[],
      reached,
    );

    const emailTotal = emailTotals[0] ?? emptyEmailMetric();
    const emailNodes = new Map(nodes.filter(node => node.type === 'send_email').map(node => [node.id, node]));
    const emailSteps = emailByNode
      .filter(row => row.nodeId)
      .map(row => ({
        ...row,
        nodeId: row.nodeId as string,
        name: String(emailNodes.get(row.nodeId as string)?.config?.templateName ?? emailNodes.get(row.nodeId as string)?.config?.subject ?? 'E-mail do fluxo'),
        deliveryRate: percentage(row.deliveredPeople, row.sentPeople),
        openRate: percentage(row.openedPeople, row.deliveredPeople || row.sentPeople),
        clickRate: percentage(row.clickedPeople, row.deliveredPeople || row.sentPeople),
      }));

    const whatsappTotal = whatsappTotals[0] ?? emptyWhatsAppMetric();
    const respondedPeople = whatsappResponses[0]?.respondedPeople ?? 0;
    const whatsappSteps = whatsappByTemplate.map(row => ({
      ...row,
      templateName: row.templateName || 'Mensagem sem template',
      deliveryRate: percentage(row.deliveredPeople, row.sentPeople),
      readRate: percentage(row.readPeople, row.deliveredPeople || row.sentPeople),
      failureRate: percentage(row.failedPeople, row.attemptedMessages),
    }));

    let audience: null | {
      segmentTotal: number;
      eligible: number;
      excluded: number;
      freeNow: number;
      inOtherFlows: number;
      inThisFlow: number;
      queuedForThisFlow: number;
    } = null;
    if (trigger?.config?.event === 'segment_entered' && trigger.config.eventValue) {
      const segmentId = String(trigger.config.eventValue);
      const segment = await prisma.segment.findUnique({ where: { id: segmentId }, select: { rules: true } });
      if (segment) {
        const segmentWhere = await SegmentService.buildWhere(segment.rules as unknown as SegmentRules, [segmentId]);
        const [segmentTotal, candidates] = await Promise.all([
          prisma.lead.count({ where: segmentWhere }),
          prisma.lead.findMany({
            where: { AND: [segmentWhere, { status: { not: 'DISQUALIFIED' } }] },
            select: {
              email: true, status: true, score: true, tags: true, isHot: true,
              firstSource: true, company: true, jobTitle: true, phone: true, assignedTo: true,
            },
          }),
        ]);
        const exitConditions = journey.exitConditions as unknown as MonitoringExitConditions | null;
        const eligibleLeads = candidates.filter(lead => !matchesExitConditions(lead, exitConditions));
        const emails = eligibleLeads.map(lead => lead.email);
        const activeExecutions = emails.length
          ? await prisma.automationExecution.findMany({
            where: {
              leadEmail: { in: emails },
              isTest: false,
              automationTypeSnapshot: 'NURTURE',
              status: { in: ['running', 'waiting', 'queued'] },
            },
            select: { leadEmail: true, journeyId: true, status: true },
          })
          : [];
        const activeAny = new Set(activeExecutions.filter(item => item.status === 'running' || item.status === 'waiting').map(item => item.leadEmail));
        const activeOther = new Set(activeExecutions.filter(item => item.journeyId !== journeyId && (item.status === 'running' || item.status === 'waiting')).map(item => item.leadEmail));
        const inThis = new Set(activeExecutions.filter(item => item.journeyId === journeyId).map(item => item.leadEmail));
        const queuedThis = new Set(activeExecutions.filter(item => item.journeyId === journeyId && item.status === 'queued').map(item => item.leadEmail));
        audience = {
          segmentTotal,
          eligible: eligibleLeads.length,
          excluded: segmentTotal - eligibleLeads.length,
          freeNow: eligibleLeads.filter(lead => !activeAny.has(lead.email) && !inThis.has(lead.email)).length,
          inOtherFlows: activeOther.size,
          inThisFlow: inThis.size,
          queuedForThisFlow: queuedThis.size,
        };
      }
    }

    return {
      ...result,
      audience,
      stages,
      email: {
        ...emailTotal,
        deliveryRate: percentage(emailTotal.deliveredPeople, emailTotal.sentPeople),
        openRate: percentage(emailTotal.openedPeople, emailTotal.deliveredPeople || emailTotal.sentPeople),
        clickRate: percentage(emailTotal.clickedPeople, emailTotal.deliveredPeople || emailTotal.sentPeople),
        steps: emailSteps,
      },
      whatsapp: {
        ...whatsappTotal,
        respondedPeople,
        deliveryRate: percentage(whatsappTotal.deliveredPeople, whatsappTotal.sentPeople),
        readRate: percentage(whatsappTotal.readPeople, whatsappTotal.deliveredPeople || whatsappTotal.sentPeople),
        responseRate: percentage(respondedPeople, whatsappTotal.sentPeople),
        failureRate: percentage(whatsappTotal.failedPeople, whatsappTotal.attemptedMessages),
        steps: whatsappSteps,
      },
    };
  }
}
