import { prisma } from '../config/database';
import { LeadStatus, Prisma } from '@prisma/client';
import { AIPrequalificationResult, runAIPrequalification } from './ai-provider.service';
import { loadAIAgentContext, persistAIAgentDecision } from './ai-agent-context.service';
import { normalizePhoneE164 } from '../utils/phone';
import { SegmentService, SegmentRules } from './segment.service';
import {
  decideNurtureEnrollment,
  normalizeAutomationPriority,
  normalizeQueueTtlHours,
} from './automation-priority.utils';
import { normalizeEmailCommunicationType } from './email-preferences.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TriggerEvent =
  | 'lead_created'
  | 'tag_added'
  | 'status_changed'
  | 'score_updated'
  | 'conversion_received'
  | 'email_received'
  | 'segment_entered';

export interface TriggerContext {
  tag?: string;
  toStatus?: string;
  fromStatus?: string;
  score?: number;
  conversionName?: string;
  segmentId?: string;
  [key: string]: unknown;
}

interface AutomationNode {
  id: string;
  type: string;
  label?: string;
  config?: Record<string, string | number | boolean | string[] | null>;
}

interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

interface LogEntry {
  nodeId: string;
  nodeType: string;
  status: 'ok' | 'error' | 'skipped';
  message?: string;
  ts: string;
}

type NodeResult = 'ok' | 'wait' | 'stop' | boolean | ResumeHandle;
type ResumeHandle = 'default' | 'true' | 'false' | 'replied' | 'no_reply' | 'failed' | 'event' | 'timeout';

function pickNextEdge(outEdges: AutomationEdge[], handle: ResumeHandle, fallbackIndex = 0): AutomationEdge | null {
  return outEdges.find(edge => edge.sourceHandle === handle)
    ?? outEdges.find(edge => !edge.sourceHandle || edge.sourceHandle === 'default')
    ?? outEdges[fallbackIndex]
    ?? null;
}

// Re-entrancy guard — process-local; keeps two concurrent events from double-executing
// the same journey for the same lead within a single process lifetime.
// NOTE: This is intentionally simple. In multi-process deployments, rely on
// resumeWaitingExecutions' optimistic DB update to prevent double-resume.
const executingLeads = new Set<string>();

// ─── Startup recovery ────────────────────────────────────────────────────────
// Mark any executions that were stuck in 'running' at process start as failed.
// This handles orphaned rows left by a previous crash/restart.
export async function recoverStuckExecutions(): Promise<void> {
  try {
    const affected = await prisma.automationExecution.findMany({
      where: { status: 'running' },
      select: { leadEmail: true, automationTypeSnapshot: true },
    });
    const stuck = await prisma.automationExecution.updateMany({
      where: { status: 'running' },
      data: { status: 'failed', error: 'Processo reiniciado — execução interrompida', completedAt: new Date() },
    });
    if (stuck.count > 0) {
      console.log(`[automation] Recovered ${stuck.count} stuck execution(s) from previous process`);
    }
    const nurtureEmails = [...new Set(affected.filter(item => item.automationTypeSnapshot === 'NURTURE').map(item => item.leadEmail))];
    for (const email of nurtureEmails) await promoteNextNurture(email);
  } catch (err) {
    console.error('[automation] recoverStuckExecutions error:', err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

type JourneyRecord = {
  id: string;
  nodes: unknown;
  edges: unknown;
  exitConditions?: unknown;
  automationType: string;
  entryMode: string;
  priority: number;
  canInterruptLowerPriority: boolean;
  queueTtlHours: number | null;
  nurtureGroupId: string | null;
  nurtureGroup?: {
    id: string;
    priority: number;
    canInterruptLowerPriority: boolean;
    queueTtlHours: number | null;
  } | null;
};

type NurtureLaunch = {
  executionId: string;
  preemptedGuardKeys: string[];
};

const ACTIVE_EXECUTION_STATUSES = ['running', 'waiting'] as const;

const jsonContext = (context: TriggerContext): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(context)) as Prisma.InputJsonValue;

function nurtureSettings(journey: JourneyRecord) {
  const group = journey.nurtureGroup;
  return {
    groupKey: group ? `group:${group.id}` : `journey:${journey.id}`,
    priority: normalizeAutomationPriority(group?.priority ?? journey.priority),
    canInterruptLowerPriority: group?.canInterruptLowerPriority ?? journey.canInterruptLowerPriority,
    queueTtlHours: normalizeQueueTtlHours(group ? group.queueTtlHours : journey.queueTtlHours),
  };
}

const executionGroupKey = (execution: { nurtureGroupKeySnapshot: string | null; journeyId: string }) =>
  execution.nurtureGroupKeySnapshot || `journey:${execution.journeyId}`;

// Decide e persiste a entrada sob um lock transacional por lead. O lock e o
// advisory lock do PostgreSQL torna a exclusividade segura mesmo com varios
// webhooks/processos chegando ao mesmo tempo.
async function enrollNurtureJourney(
  journey: JourneyRecord,
  triggerNode: AutomationNode,
  leadEmail: string,
  context: TriggerContext,
  triggerEvent: string
): Promise<NurtureLaunch | null> {
  const email = leadEmail.trim().toLowerCase();
  const settings = nurtureSettings(journey);
  const { groupKey, priority, canInterruptLowerPriority } = settings;
  const ttlHours = settings.queueTtlHours;
  const expiresAt = ttlHours === null ? null : new Date(Date.now() + ttlHours * 3_600_000);

  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;

    const duplicate = await tx.automationExecution.findFirst({
      where: {
        journeyId: journey.id,
        leadEmail: email,
        isTest: false,
        status: { in: ['running', 'waiting', 'queued'] },
      },
      select: { id: true },
    });
    if (duplicate) return null;

    const active = await tx.automationExecution.findMany({
      where: {
        leadEmail: email,
        isTest: false,
        automationTypeSnapshot: 'NURTURE',
        status: { in: [...ACTIVE_EXECUTION_STATUSES] },
      },
      orderBy: { startedAt: 'asc' },
      select: { id: true, journeyId: true, prioritySnapshot: true, nurtureGroupKeySnapshot: true },
    });

    const activeGroupKey = active[0] ? executionGroupKey(active[0]) : null;
    const joinsActiveGroup = activeGroupKey === groupKey;
    const decision = joinsActiveGroup
      ? 'start'
      : decideNurtureEnrollment(
        active[0] ? { priority: active[0].prioritySnapshot } : null,
        { priority, canInterruptLowerPriority }
      );

    if (decision === 'preempt' && active.length) {
      await tx.automationExecution.updateMany({
        where: { id: { in: active.map(item => item.id) } },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
          error: `Interrompido por fluxo prioritário: ${journey.id}`,
        },
      });
    }

    const shouldStart = decision === 'start' || decision === 'preempt';
    const execution = await tx.automationExecution.create({
      data: {
        journeyId: journey.id,
        leadEmail: email,
        status: shouldStart ? 'running' : 'queued',
        currentNodeId: triggerNode.id,
        log: [],
        automationTypeSnapshot: 'NURTURE',
        prioritySnapshot: priority,
        nurtureGroupKeySnapshot: groupKey,
        triggerEvent,
        triggerContext: jsonContext(context),
        queuedAt: shouldStart ? null : new Date(),
        expiresAt: shouldStart ? null : expiresAt,
      },
    });

    if (active.length && decision === 'preempt') {
      await tx.automationExecution.updateMany({
        where: { id: { in: active.map(item => item.id) } },
        data: { supersededById: execution.id },
      });
    }

    return shouldStart
      ? {
        executionId: execution.id,
        preemptedGuardKeys: decision === 'preempt'
          ? active.map(item => `${item.journeyId}:${email}`)
          : [],
      }
      : null;
  });
}

// Inicia uma execucao para UMA journey especifica (ja sabendo que o trigger bate).
// Extraido de fireTrigger para ser reutilizavel por chamadores que ja sabem qual
// journey querem disparar (ex: o avaliador de segmento), sem re-escanear todas as
// journeys ativas e arriscar disparo duplicado quando varias usam o mesmo gatilho.
async function startExecutionForJourney(
  journey: JourneyRecord,
  triggerNode: AutomationNode,
  leadEmail: string,
  context: TriggerContext,
  triggerEvent: string
): Promise<void> {
  const normalizedLeadEmail = leadEmail.trim().toLowerCase();
  const guardKey = `${journey.id}:${normalizedLeadEmail}`;

  if (journey.automationType === 'NURTURE') {
    const launch = await enrollNurtureJourney(journey, triggerNode, normalizedLeadEmail, context, triggerEvent);
    if (!launch) return;
    for (const preemptedGuardKey of launch.preemptedGuardKeys) executingLeads.delete(preemptedGuardKey);
    executingLeads.add(guardKey);
    const nodes = (journey.nodes as unknown as AutomationNode[]) ?? [];
    const edges = (journey.edges as unknown as AutomationEdge[]) ?? [];
    runExecution(launch.executionId, journey.id, nodes, edges, normalizedLeadEmail, context, undefined, guardKey, journey.exitConditions)
      .catch(err => handleExecutionCrash(launch.executionId, guardKey, err));
    return;
  }

  if (executingLeads.has(guardKey)) return;

  // FIX: set guard IMMEDIATELY before any await to close the TOCTOU window
  executingLeads.add(guardKey);

  try {
    const nodes = (journey.nodes as unknown as AutomationNode[]) ?? [];
    const execution = await prisma.automationExecution.create({
      data: {
        journeyId: journey.id,
        leadEmail: normalizedLeadEmail,
        status: 'running',
        currentNodeId: triggerNode.id,
        log: [],
        automationTypeSnapshot: 'STANDALONE',
        triggerEvent,
        triggerContext: jsonContext(context),
      },
    });

    const edges = (journey.edges as unknown as AutomationEdge[]) ?? [];
    runExecution(execution.id, journey.id, nodes, edges, normalizedLeadEmail, context, undefined, guardKey, journey.exitConditions).catch(err => {
      return handleExecutionCrash(execution.id, guardKey, err);
    });
  } catch (err) {
    // If execution creation fails, always release the guard
    executingLeads.delete(guardKey);
    console.error(`[automation] fireTrigger create execution error:`, err);
  }
}

export async function fireTrigger(
  event: TriggerEvent,
  leadEmail: string,
  context: TriggerContext = {}
): Promise<void> {
  try {
    // Leads desqualificados (bot ou desqualificados manualmente) sao inoperantes:
    // nunca entram em nenhuma automacao ativa.
    const lead = await prisma.lead.findUnique({ where: { email: leadEmail }, select: { status: true } });
    if (lead?.status === 'DISQUALIFIED') return;

    const journeys = await prisma.automationJourney.findMany({
      where: { isActive: true },
      include: { nurtureGroup: true },
    });
    const leadForPersona = await prisma.lead.findUnique({
      where: { email: leadEmail },
      select: LEAD_RECORD_SELECT,
    });

    const directlyMatching = journeys.filter(journey => {
      const nodes = (journey.nodes as unknown as AutomationNode[]) ?? [];
      const triggerNode = nodes.find(n => n.type === 'trigger');
      if (!triggerNode) return false;

      const c = (triggerNode.config ?? {}) as Record<string, string>;
      return matchesTrigger(c.event, event, c, context) && matchesJourneyPersona(journey, leadForPersona);
    });
    const triggeredGroupIds = new Set(
      directlyMatching
        .filter(journey => journey.automationType === 'NURTURE' && journey.nurtureGroupId)
        .map(journey => journey.nurtureGroupId as string)
    );
    const directlyMatchingIds = new Set(directlyMatching.map(journey => journey.id));
    const matching = journeys.filter(journey =>
      (directlyMatchingIds.has(journey.id)
        || (journey.automationType === 'NURTURE' && Boolean(journey.nurtureGroupId) && triggeredGroupIds.has(journey.nurtureGroupId!)))
      && matchesJourneyPersona(journey, leadForPersona)
    ).sort((a, b) => {
      if (a.automationType === 'NURTURE' && b.automationType === 'NURTURE') {
        return nurtureSettings(b).priority - nurtureSettings(a).priority;
      }
      if (a.automationType === 'NURTURE') return -1;
      if (b.automationType === 'NURTURE') return 1;
      return 0;
    });

    for (const journey of matching) {
      const nodes = (journey.nodes as unknown as AutomationNode[]) ?? [];
      const triggerNode = nodes.find(n => n.type === 'trigger');
      if (!triggerNode) continue;
      await startExecutionForJourney(journey, triggerNode, leadEmail, context, event);
    }
  } catch (err) {
    console.error('[automation] fireTrigger error:', err);
  }
}

// Jornadas do mesmo grupo (e-mail, WhatsApp etc.) compartilham o gatilho. A
// condição de persona, porém, precisa ser aplicada antes de iniciar a jornada;
// caso contrário todos os ramos do grupo criam uma execução e podem disparar
// mensagens duplicadas antes que o bloco visual de condição seja processado.
function matchesJourneyPersona(journey: { nodes: unknown }, lead: LeadRecord | null): boolean {
  const nodes = (journey.nodes as unknown as AutomationNode[]) ?? [];
  const personaCondition = nodes.find(node => {
    if (node.type !== 'condition') return false;
    const config = (node.config ?? {}) as Record<string, string>;
    return config.field === 'jobTitle' && config.operator === 'contains' && Boolean(config.value?.trim());
  });
  if (!personaCondition) return true;
  if (!lead) return false;
  return evaluateCondition(lead, (personaCondition.config ?? {}) as Record<string, string>);
}

// Dispara o gatilho para UMA journey especifica, sem escanear as demais — usado pelo
// avaliador de segmento, que ja sabe exatamente qual journey/segmento esta processando
// e precisa evitar que um lead ja conhecido por outra journey dispare esta de novo.
export async function fireTriggerForJourney(
  journeyId: string,
  leadEmail: string,
  context: TriggerContext = {}
): Promise<void> {
  try {
    const lead = await prisma.lead.findUnique({ where: { email: leadEmail }, select: { status: true } });
    if (lead?.status === 'DISQUALIFIED') return;

    const journey = await prisma.automationJourney.findUnique({ where: { id: journeyId }, include: { nurtureGroup: true } });
    if (!journey || !journey.isActive) return;

    const groupJourneys = journey.automationType === 'NURTURE' && journey.nurtureGroupId
      ? await prisma.automationJourney.findMany({
        where: { nurtureGroupId: journey.nurtureGroupId, automationType: 'NURTURE', isActive: true },
        include: { nurtureGroup: true },
      })
      : [journey];

    const sourceNodes = (journey.nodes as unknown as AutomationNode[]) ?? [];
    const sourceTrigger = sourceNodes.find(n => n.type === 'trigger');
    if (!sourceTrigger) return;
    const triggerEvent = String((sourceTrigger.config ?? {}).event ?? 'segment_entered');

    for (const member of groupJourneys) {
      const nodes = (member.nodes as unknown as AutomationNode[]) ?? [];
      const triggerNode = nodes.find(n => n.type === 'trigger');
      if (!triggerNode) continue;
      await startExecutionForJourney(member, triggerNode, leadEmail, context, triggerEvent);
    }
  } catch (err) {
    console.error('[automation] fireTriggerForJourney error:', err);
  }
}

async function queuedAudienceStillMatches(
  tx: Prisma.TransactionClient,
  journey: { nodes: unknown; entryMode: string },
  leadEmail: string
): Promise<boolean> {
  if (journey.entryMode !== 'AUDIENCE') return true;
  const nodes = (journey.nodes as unknown as AutomationNode[]) ?? [];
  const triggerNode = nodes.find(node => node.type === 'trigger');
  const config = (triggerNode?.config ?? {}) as Record<string, string>;
  if (config.event !== 'segment_entered' || !config.eventValue) return false;

  const segment = await tx.segment.findUnique({ where: { id: config.eventValue } });
  if (!segment) return false;
  const rules = segment.rules as unknown as SegmentRules;
  const where = await SegmentService.buildWhere(rules, [segment.id]);
  const lead = await tx.lead.findFirst({
    where: { ...where, email: leadEmail, deletedAt: null, status: { not: 'DISQUALIFIED' } },
    select: { id: true },
  });
  return Boolean(lead);
}

async function promoteNextNurture(leadEmail: string): Promise<void> {
  const email = leadEmail.trim().toLowerCase();
  const launches = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;

    const active = await tx.automationExecution.findFirst({
      where: {
        leadEmail: email,
        isTest: false,
        automationTypeSnapshot: 'NURTURE',
        status: { in: [...ACTIVE_EXECUTION_STATUSES] },
      },
      select: { id: true },
    });
    if (active) return [];

    const lead = await tx.lead.findUnique({ where: { email }, select: LEAD_RECORD_SELECT });
    const candidates = await tx.automationExecution.findMany({
      where: {
        leadEmail: email,
        isTest: false,
        automationTypeSnapshot: 'NURTURE',
        status: 'queued',
      },
      orderBy: [{ prioritySnapshot: 'desc' }, { queuedAt: 'asc' }],
      include: { journey: { include: { nurtureGroup: true } } },
    });

    const isEligible = async (candidate: typeof candidates[number]) => {
      const expired = Boolean(candidate.expiresAt && candidate.expiresAt <= new Date());
      const exited = lead ? evaluateExitConditions(lead, candidate.journey.exitConditions as ExitConditions | null) : true;
      const audienceMatches = !expired && candidate.journey.isActive
        ? await queuedAudienceStillMatches(tx, candidate.journey, email)
        : false;
      return {
        ok: !expired && candidate.journey.isActive && Boolean(lead) && lead?.status !== 'DISQUALIFIED' && !exited && audienceMatches,
        expired,
      };
    };

    const cancelCandidate = async (candidate: typeof candidates[number], expired: boolean) => {
      await tx.automationExecution.updateMany({
        where: { id: candidate.id, status: 'queued' },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
          error: expired ? 'Expirou na fila de nutrição' : 'Não estava mais elegível ao liberar a fila',
        },
      });
    };

    for (const candidate of candidates) {
      const eligibility = await isEligible(candidate);
      if (!eligibility.ok) {
        await cancelCandidate(candidate, eligibility.expired);
        continue;
      }

      const selectedGroupKey = executionGroupKey(candidate);
      const groupCandidates = candidates.filter(item => executionGroupKey(item) === selectedGroupKey);
      const selectedLaunches: Array<{
        executionId: string;
        journey: typeof candidate.journey;
        context: TriggerContext;
      }> = [];

      for (const member of groupCandidates) {
        const memberEligibility = member.id === candidate.id ? eligibility : await isEligible(member);
        if (!memberEligibility.ok) {
          await cancelCandidate(member, memberEligibility.expired);
          continue;
        }
        const claimed = await tx.automationExecution.updateMany({
          where: { id: member.id, status: 'queued' },
          data: { status: 'running', startedAt: new Date(), queuedAt: null, expiresAt: null },
        });
        if (claimed.count === 0) continue;
        selectedLaunches.push({
          executionId: member.id,
          journey: member.journey,
          context: (member.triggerContext ?? {}) as TriggerContext,
        });
      }

      if (selectedLaunches.length) return selectedLaunches;
    }

    return [];
  });

  for (const launch of launches) {
    const nodes = (launch.journey.nodes as unknown as AutomationNode[]) ?? [];
    const edges = (launch.journey.edges as unknown as AutomationEdge[]) ?? [];
    const guardKey = `${launch.journey.id}:${email}`;
    executingLeads.add(guardKey);
    runExecution(
      launch.executionId,
      launch.journey.id,
      nodes,
      edges,
      email,
      launch.context,
      undefined,
      guardKey,
      launch.journey.exitConditions
    ).catch(err => handleExecutionCrash(launch.executionId, guardKey, err));
  }
}

async function finishExecution(
  executionId: string,
  status: 'completed' | 'failed',
  error?: string
): Promise<boolean> {
  const current = await prisma.automationExecution.findUnique({
    where: { id: executionId },
    select: { leadEmail: true, automationTypeSnapshot: true, status: true, isTest: true },
  });
  if (!current || !ACTIVE_EXECUTION_STATUSES.includes(current.status as typeof ACTIVE_EXECUTION_STATUSES[number])) return false;

  const updated = await prisma.automationExecution.updateMany({
    where: { id: executionId, status: { in: [...ACTIVE_EXECUTION_STATUSES] } },
    data: { status, error: error ?? null, completedAt: new Date(), resumeAt: null },
  });
  if (updated.count === 0) return false;

  if (current.automationTypeSnapshot === 'NURTURE' && !current.isTest) {
    await promoteNextNurture(current.leadEmail);
  }
  return true;
}

async function handleExecutionCrash(executionId: string, guardKey: string, err: unknown): Promise<void> {
  console.error(`[automation] execution ${executionId} crashed:`, err);
  await finishExecution(
    executionId,
    'failed',
    err instanceof Error ? err.message : String(err)
  ).catch(finishErr => console.error(`[automation] failed to close crashed execution ${executionId}:`, finishErr));
  executingLeads.delete(guardKey);
}

// Varredura de seguranca: se o processo reiniciar entre o fim de uma jornada e
// a promocao da fila, o scheduler libera esses leads no proximo ciclo.
export async function resumeQueuedNurtures(): Promise<void> {
  const queued = await prisma.automationExecution.findMany({
    where: { status: 'queued', automationTypeSnapshot: 'NURTURE', isTest: false },
    distinct: ['leadEmail'],
    select: { leadEmail: true },
  });
  for (const { leadEmail } of queued) {
    await promoteNextNurture(leadEmail).catch(err =>
      console.error(`[automation] queue promotion failed for ${leadEmail}:`, err)
    );
  }
}

export async function testJourneyForLead(
  journeyId: string,
  leadEmail: string,
  startNodeId?: string
): Promise<{ executionId: string }> {
  const journey = await prisma.automationJourney.findUniqueOrThrow({ where: { id: journeyId }, include: { nurtureGroup: true } });
  const nodes = (journey.nodes as unknown as AutomationNode[]) ?? [];
  const edges = (journey.edges as unknown as AutomationEdge[]) ?? [];
  const triggerNode = nodes.find(n => n.type === 'trigger');

  // FIX: fail fast — do not create a permanently-stuck 'running' execution
  if (!triggerNode) {
    throw new Error('Journey não tem nó de Entrada configurado. Adicione e configure o bloco de Entrada antes de testar.');
  }

  if (startNodeId && !nodes.find(n => n.id === startNodeId)) {
    throw new Error('Nó de início não encontrado na automação.');
  }

  // Test runs use a separate guard namespace so they don't block real executions
  const guardKey = `test:${journeyId}:${leadEmail}`;
  if (executingLeads.has(guardKey)) {
    throw new Error('Já existe um teste em execução para este lead+journey. Aguarde terminar.');
  }
  executingLeads.add(guardKey);

  const initialNodeId = startNodeId ?? triggerNode.id;

  const settings = nurtureSettings(journey);
  const execution = await prisma.automationExecution.create({
    data: {
      journeyId,
      leadEmail,
      status: 'running',
      currentNodeId: initialNodeId,
      log: [],
      automationTypeSnapshot: journey.automationType === 'NURTURE' ? 'NURTURE' : 'STANDALONE',
      prioritySnapshot: journey.automationType === 'NURTURE' ? settings.priority : 0,
      nurtureGroupKeySnapshot: journey.automationType === 'NURTURE' ? settings.groupKey : null,
      triggerEvent: String((triggerNode.config ?? {}).event ?? 'test'),
      triggerContext: { _test: true },
      isTest: true,
    },
  });

  runExecution(execution.id, journeyId, nodes, edges, leadEmail, { _test: true }, startNodeId, guardKey, journey.exitConditions)
    .catch(err => handleExecutionCrash(execution.id, guardKey, err));

  return { executionId: execution.id };
}

export async function resumeWaitingExecutions(): Promise<void> {
  const now = new Date();

  // Optimistic claim: update from 'waiting' → 'running' atomically.
  // This prevents double-resume even across multiple process instances.
  const waiting = await prisma.automationExecution.findMany({
    where: { status: 'waiting', resumeAt: { lte: now } },
    include: { journey: true },
  });

  for (const execution of waiting) {
    const guardKey = `${execution.journeyId}:${execution.leadEmail}`;
    // NOTE: intentionally NOT checking executingLeads here — the guard is kept in memory
    // while an execution is in 'waiting' state (to block duplicate triggers), so checking
    // it would prevent the resume from ever running. The DB atomic claim below is sufficient.

    // Optimistic DB claim — only succeeds if still 'waiting' (prevents multi-process dupe)
    const claimed = await prisma.automationExecution.updateMany({
      where: { id: execution.id, status: 'waiting' },
      data: { status: 'running', resumeAt: null },
    });
    if (claimed.count === 0) continue; // another process already claimed it

    if (await shouldExitJourney(execution.journey.exitConditions, execution.leadEmail)) {
      await exitExecution(execution.id, execution.currentNodeId ?? undefined);
      executingLeads.delete(guardKey); // libera o guard — execucao encerrada, nao fica "presa"
      continue;
    }

    const nodes = (execution.journey.nodes as unknown as AutomationNode[]) ?? [];
    const edges = (execution.journey.edges as unknown as AutomationEdge[]) ?? [];

    if (!execution.currentNodeId) {
      await finishExecution(execution.id, 'completed');
      continue;
    }

    // Resume from the node AFTER the wait node
    const outEdges = edges.filter(e => e.source === execution.currentNodeId);
    const currentNode = nodes.find(n => n.id === execution.currentNodeId);
    const resumeHandle: ResumeHandle =
      currentNode?.type === 'whatsapp_wait_reply' ? 'no_reply' :
      currentNode?.type === 'email_wait_event'    ? 'timeout'  : 'default';
    const nextEdge = pickNextEdge(outEdges, resumeHandle);

    if (!nextEdge) {
      await finishExecution(execution.id, 'completed');
      continue;
    }

    // Reset guard so runExecution's finally block can manage it correctly
    executingLeads.delete(guardKey);
    executingLeads.add(guardKey);

    if (currentNode?.type === 'whatsapp_wait_reply') {
      await appendLog(execution.id, currentNode.id, 'whatsapp_wait_reply', 'ok', 'Tempo esgotado sem resposta');
    } else if (currentNode?.type === 'email_wait_event') {
      await appendLog(execution.id, currentNode.id, 'email_wait_event', 'ok', 'Tempo esgotado sem evento de email');
    }

    runExecution(execution.id, execution.journeyId, nodes, edges, execution.leadEmail, {}, nextEdge.target, guardKey, execution.journey.exitConditions)
      .catch(err => handleExecutionCrash(execution.id, guardKey, err));
  }
}

// ─── Execution loop ───────────────────────────────────────────────────────────

export async function resumeWaitingWhatsAppReply(
  leadEmail: string,
  replyText = '',
  handle: Extract<ResumeHandle, 'replied' | 'failed'> = 'replied'
): Promise<number> {
  const waiting = await prisma.automationExecution.findMany({
    where: { status: 'waiting', leadEmail },
    include: { journey: true },
  });

  let resumed = 0;

  for (const execution of waiting) {
    const guardKey = `${execution.journeyId}:${execution.leadEmail}`;

    const nodes = (execution.journey.nodes as unknown as AutomationNode[]) ?? [];
    const edges = (execution.journey.edges as unknown as AutomationEdge[]) ?? [];
    const currentNode = nodes.find(n => n.id === execution.currentNodeId);
    if (currentNode?.type !== 'whatsapp_wait_reply') continue;

    if (await shouldExitJourney(execution.journey.exitConditions, execution.leadEmail)) {
      await exitExecution(execution.id, currentNode.id);
      continue;
    }

    if (handle === 'replied') {
      const keywords = String(currentNode.config?.keywords ?? '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
      const normalizedReply = replyText.toLowerCase();
      if (keywords.length > 0 && !keywords.some(keyword => normalizedReply.includes(keyword))) {
        await appendLog(execution.id, currentNode.id, 'whatsapp_wait_reply', 'skipped', `Resposta fora das palavras esperadas: ${replyText.slice(0, 120)}`);
        continue;
      }
    }

    const outEdges = edges.filter(edge => edge.source === currentNode.id);
    const nextEdge = pickNextEdge(outEdges, handle);
    if (!nextEdge) {
      await finishExecution(execution.id, 'completed');
      continue;
    }

    const claimed = await prisma.automationExecution.updateMany({
      where: { id: execution.id, status: 'waiting' },
      data: { status: 'running', resumeAt: null },
    });
    if (claimed.count === 0) continue;

    executingLeads.delete(guardKey);
    executingLeads.add(guardKey);
    await appendLog(
      execution.id,
      currentNode.id,
      'whatsapp_wait_reply',
      'ok',
      handle === 'failed' ? 'Envio WhatsApp falhou' : `Resposta recebida: ${replyText.slice(0, 160)}`
    );

    runExecution(execution.id, execution.journeyId, nodes, edges, execution.leadEmail, {}, nextEdge.target, guardKey, execution.journey.exitConditions)
      .catch(err => handleExecutionCrash(execution.id, guardKey, err));

    resumed += 1;
  }

  return resumed;
}

export async function resumeWaitingEmailEvent(
  resendId: string,
  eventType: 'opened' | 'clicked'
): Promise<number> {
  const emailSent = await prisma.emailSent.findFirst({
    where: { resendId, automationExecutionId: { not: null } },
  });
  if (!emailSent?.automationExecutionId) return 0;

  const execution = await prisma.automationExecution.findUnique({
    where: { id: emailSent.automationExecutionId },
    include: { journey: true },
  });
  if (!execution || execution.status !== 'waiting') return 0;

  const nodes = (execution.journey.nodes as unknown as AutomationNode[]) ?? [];
  const edges = (execution.journey.edges as unknown as AutomationEdge[]) ?? [];
  const currentNode = nodes.find(n => n.id === execution.currentNodeId);
  if (currentNode?.type !== 'email_wait_event') return 0;

  if (await shouldExitJourney(execution.journey.exitConditions, execution.leadEmail)) {
    await exitExecution(execution.id, currentNode.id);
    return 0;
  }

  const waitFor = String(currentNode.config?.waitForEvent || 'opened');
  // If node waits for 'clicked', only 'clicked' event qualifies; 'opened' qualifies for either
  if (waitFor === 'clicked' && eventType !== 'clicked') return 0;

  const outEdges = edges.filter(e => e.source === currentNode.id);
  const nextEdge = pickNextEdge(outEdges, 'event');
  if (!nextEdge) {
    await finishExecution(execution.id, 'completed');
    return 0;
  }

  const guardKey = `${execution.journeyId}:${execution.leadEmail}`;

  const claimed = await prisma.automationExecution.updateMany({
    where: { id: execution.id, status: 'waiting' },
    data: { status: 'running', resumeAt: null },
  });
  if (claimed.count === 0) return 0;

  executingLeads.delete(guardKey);
  executingLeads.add(guardKey);
  await appendLog(execution.id, currentNode.id, 'email_wait_event', 'ok', `Evento recebido: ${eventType}`);

  runExecution(execution.id, execution.journeyId, nodes, edges, execution.leadEmail, {}, nextEdge.target, guardKey, execution.journey.exitConditions)
    .catch(err => handleExecutionCrash(execution.id, guardKey, err));

  return 1;
}

export async function resumeWaitingEmailReceived(
  leadEmail: string,
  replyText = '',
  subject = ''
): Promise<number> {
  const executions = await prisma.automationExecution.findMany({
    where: { leadEmail, status: 'waiting' },
    include: { journey: true },
    orderBy: { startedAt: 'desc' },
    take: 20,
  });

  let resumed = 0;
  for (const execution of executions) {
    const nodes = (execution.journey.nodes as unknown as AutomationNode[]) ?? [];
    const edges = (execution.journey.edges as unknown as AutomationEdge[]) ?? [];
    const currentNode = nodes.find(n => n.id === execution.currentNodeId);
    if (currentNode?.type !== 'email_wait_event') continue;

    if (await shouldExitJourney(execution.journey.exitConditions, execution.leadEmail)) {
      await exitExecution(execution.id, currentNode.id);
      continue;
    }

    const waitFor = String(currentNode.config?.waitForEvent || 'opened');
    if (waitFor !== 'received' && waitFor !== 'reply') continue;

    const expected = String(currentNode.config?.replyContains ?? currentNode.config?.keywords ?? '').trim().toLowerCase();
    const haystack = `${subject}\n${replyText}`.toLowerCase();
    if (expected) {
      const terms = expected.split(',').map(item => item.trim()).filter(Boolean);
      if (terms.length > 0 && !terms.some(term => haystack.includes(term))) continue;
    }

    const outEdges = edges.filter(e => e.source === currentNode.id);
    const nextEdge = pickNextEdge(outEdges, 'event');
    if (!nextEdge) {
      await finishExecution(execution.id, 'completed');
      continue;
    }

    const guardKey = `${execution.journeyId}:${execution.leadEmail}`;

    const claimed = await prisma.automationExecution.updateMany({
      where: { id: execution.id, status: 'waiting' },
      data: { status: 'running', resumeAt: null },
    });
    if (claimed.count === 0) continue;

    executingLeads.delete(guardKey);
    executingLeads.add(guardKey);
    await appendLog(execution.id, currentNode.id, 'email_wait_event', 'ok', `Email recebido: ${replyText.slice(0, 160)}`);

    runExecution(execution.id, execution.journeyId, nodes, edges, execution.leadEmail, {}, nextEdge.target, guardKey, execution.journey.exitConditions)
      .catch(err => handleExecutionCrash(execution.id, guardKey, err));

    resumed += 1;
  }

  return resumed;
}

async function runExecution(
  executionId: string,
  journeyId: string,           // FIX: passed directly — no DB fetch needed
  nodes: AutomationNode[],
  edges: AutomationEdge[],
  leadEmail: string,
  context: TriggerContext,
  startNodeId?: string,
  guardKey?: string,            // FIX: passed from caller who already set the guard
  exitConditions?: unknown
): Promise<void> {
  // Derive guardKey if not passed (safety fallback)
  const key = guardKey ?? `${journeyId}:${leadEmail}`;
  let isWaiting = false;

  try {
    const triggerNode = nodes.find(n => n.type === 'trigger');
    let currentNodeId = startNodeId ?? triggerNode?.id;
    if (!currentNodeId) {
      // FIX: mark as failed instead of silently returning with status='running'
      await finishExecution(executionId, 'failed', 'Journey sem nó de Entrada — execução abortada').catch(() => {});
      return;
    }

    const visited = new Set<string>();

    while (currentNodeId) {
      if (visited.has(currentNodeId)) break;
      visited.add(currentNodeId);

      const state = await prisma.automationExecution.findUnique({ where: { id: executionId }, select: { status: true } });
      if (!state || state.status !== 'running') return;

      if (await shouldExitJourney(exitConditions, leadEmail)) {
        await exitExecution(executionId, currentNodeId);
        return;
      }

      const node = nodes.find(n => n.id === currentNodeId);
      if (!node) break;

      await prisma.automationExecution.update({
        where: { id: executionId },
        data: { currentNodeId },
      });

      let result: NodeResult;
      try {
        result = await executeNode(executionId, journeyId, node, leadEmail, context);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // FIX: log the failing node before marking as failed
        await appendLog(executionId, node.id, node.type, 'error', message).catch(() => {});
        await finishExecution(executionId, 'failed', message);
        return;
      }

      const stateAfterNode = await prisma.automationExecution.findUnique({ where: { id: executionId }, select: { status: true } });
      if (!stateAfterNode || (stateAfterNode.status !== 'running' && stateAfterNode.status !== 'waiting')) return;

      if (result === 'wait') {
        isWaiting = true;  // FIX: guard kept while waiting so new triggers don't start duplicate
        return;
      }
      if (result === 'stop') break;

      const outEdges = edges.filter(e => e.source === currentNodeId);
      if (outEdges.length === 0) break;

      if (typeof result === 'boolean') {
        const desiredHandle = result ? 'true' : 'false';
        const fallbackIndex = result ? 0 : 1;
        const nextEdge = pickNextEdge(outEdges, desiredHandle, fallbackIndex);
        if (!nextEdge) break;
        currentNodeId = nextEdge.target;
      } else {
        // String results other than 'ok' are used as the sourceHandle directly (e.g. 'event')
        const handle: ResumeHandle = (typeof result === 'string' && result !== 'ok') ? result as ResumeHandle : 'default';
        const nextEdge = pickNextEdge(outEdges, handle);
        if (!nextEdge) break;
        currentNodeId = nextEdge.target;
      }
    }

    await finishExecution(executionId, 'completed').catch(() => {});
  } finally {
    // FIX: keep guard active while execution is in 'waiting' state
    // so new triggers don't create a second parallel execution
    if (!isWaiting) {
      executingLeads.delete(key);
    }
  }
}

// ─── Node executor ────────────────────────────────────────────────────────────

async function executeNode(
  executionId: string,
  journeyId: string,
  node: AutomationNode,
  leadEmail: string,
  context: TriggerContext
): Promise<NodeResult> {
  const c = (node.config ?? {}) as Record<string, string | number | boolean>;

  switch (node.type) {
    case 'trigger':
      return 'ok';

    case 'wait': {
      const amount = Number(c.amount) || 1;
      const unit = String(c.unit || 'hours');
      const ms =
        unit === 'minute'  || unit === 'minutes' ? amount * 60_000 :
        unit === 'hour'    || unit === 'hours'   ? amount * 3_600_000 :
        unit === 'week'    || unit === 'weeks'   ? amount * 7 * 86_400_000 :
        /* day / days */                           amount * 86_400_000;

      const waiting = await prisma.automationExecution.updateMany({
        where: { id: executionId, status: 'running' },
        data: { status: 'waiting', resumeAt: new Date(Date.now() + ms) },
      });
      if (waiting.count === 0) return 'stop';
      await appendLog(executionId, node.id, 'wait', 'ok', `Aguardando ${amount} ${unit}(s)`);
      return 'wait';
    }

    case 'whatsapp_wait_reply': {
      const amount = Number(c.amount) || 1;
      const unit = String(c.unit || 'days');
      const ms =
        unit === 'minute'  || unit === 'minutes' ? amount * 60_000 :
        unit === 'hour'    || unit === 'hours'   ? amount * 3_600_000 :
        /* day / days */                           amount * 86_400_000;

      const waiting = await prisma.automationExecution.updateMany({
        where: { id: executionId, status: 'running' },
        data: { status: 'waiting', resumeAt: new Date(Date.now() + ms) },
      });
      if (waiting.count === 0) return 'stop';

      const keywords = String(c.keywords ?? '').trim();
      await appendLog(
        executionId,
        node.id,
        'whatsapp_wait_reply',
        'ok',
        keywords
          ? `Aguardando resposta WhatsApp por ${amount} ${unit}(s). Palavras: ${keywords}`
          : `Aguardando qualquer resposta WhatsApp por ${amount} ${unit}(s)`
      );
      return 'wait';
    }

    case 'email_wait_event': {
      const amount = Number(c.timeoutAmount) || 24;
      const unit = String(c.timeoutUnit || 'hours');
      const ms =
        unit === 'minute' || unit === 'minutes' ? amount * 60_000 :
        unit === 'hour'   || unit === 'hours'   ? amount * 3_600_000 :
        /* day / days */                          amount * 86_400_000;

      // Eager check: email may have already been opened/clicked before this node ran
      const emailSent = await prisma.emailSent.findFirst({
        where: { automationExecutionId: executionId },
        orderBy: { sentAt: 'desc' },
      });

      const waitFor = String(c.waitForEvent || 'opened');
      const executionRow = waitFor === 'received' || waitFor === 'reply'
        ? await prisma.automationExecution.findUnique({
            where: { id: executionId },
            select: { startedAt: true },
          })
        : null;
      const alreadyHappened = waitFor === 'received' || waitFor === 'reply'
        ? await prisma.emailReceived.findFirst({
            where: { leadEmail, receivedAt: { gte: executionRow?.startedAt ?? new Date() } },
            orderBy: { receivedAt: 'desc' },
          })
        : emailSent && (
            waitFor === 'clicked' ? !!emailSent.clickedAt : !!(emailSent.openedAt || emailSent.clickedAt)
          );

      if (alreadyHappened) {
        await appendLog(executionId, node.id, 'email_wait_event', 'ok', `Evento já ocorreu: ${waitFor}`);
        return 'event';
      }

      const waiting = await prisma.automationExecution.updateMany({
        where: { id: executionId, status: 'running' },
        data: { status: 'waiting', resumeAt: new Date(Date.now() + ms) },
      });
      if (waiting.count === 0) return 'stop';
      await appendLog(executionId, node.id, 'email_wait_event', 'ok', `Aguardando ${waitFor} por ${amount} ${unit}(s)`);
      return 'wait';
    }

    case 'condition': {
      const lead = await prisma.lead.findUnique({ where: { email: leadEmail } });
      if (!lead) return 'stop';
      let result: boolean;
      if (String(c.field ?? '') === 'segment') {
        const segmentId = String(c.value ?? '').trim();
        if (!segmentId || !['in_segment', 'not_in_segment'].includes(String(c.operator ?? ''))) {
          result = false;
        } else {
          const { SegmentService } = await import('./segment.service');
          const segment = await prisma.segment.findUnique({ where: { id: segmentId }, select: { rules: true } });
          const segmentWhere = segment
            ? await SegmentService.buildWhere(segment.rules as any, [segmentId])
            : { id: { in: [] as string[] } };
          const member = await prisma.lead.findFirst({ where: { AND: [{ id: lead.id }, segmentWhere] }, select: { id: true } });
          result = String(c.operator) === 'in_segment' ? Boolean(member) : !member;
        }
      } else {
        result = evaluateCondition(lead as LeadRecord, c);
      }
      await appendLog(executionId, node.id, 'condition', 'ok', `Condição: ${result}`);
      return result;
    }

    case 'internal_action':
      await executeInternalAction(leadEmail, c);
      await appendLog(executionId, node.id, 'internal_action', 'ok', String(c.action ?? ''));
      return 'ok';

    case 'rd_conversion': {
      const result = await executeRDConversion(leadEmail, c);
      await appendLog(executionId, node.id, 'rd_conversion', 'ok',
        `identifier=${String(c.conversionIdentifier ?? c.conversionName ?? '')} event_uuid=${result?.event_uuid ?? 'n/a'}`);
      return 'ok';
    }

    case 'whatsapp_message':
      await executeWhatsAppMessage(leadEmail, c, executionId, journeyId);
      await appendLog(executionId, node.id, 'whatsapp_message', 'ok', String(c.templateName ?? ''));
      return 'ok';

    case 'ai_prequalify': {
      const result = await executeAIPrequalification(executionId, journeyId, node.id, leadEmail, c);
      await appendLog(
        executionId,
        node.id,
        'ai_prequalify',
        'ok',
        `fit=${result.fit} score=${result.score} source=${result.source} model=${result.model}`
      );
      return 'ok';
    }

    case 'send_email':
      await executeSendEmail(executionId, node.id, leadEmail, c);
      await appendLog(executionId, node.id, 'send_email', 'ok', String(c.subject ?? ''));
      return 'ok';

    case 'pipedrive_action':
      await executePipedriveAction(executionId, node.id, leadEmail, c);
      return 'ok';

    default:
      return 'ok';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchesTrigger(
  configuredEvent: string | undefined,
  firedEvent: TriggerEvent,
  config: Record<string, string>,
  context: TriggerContext
): boolean {
  const normalizedConfiguredEvent = configuredEvent === 'conversion' ? 'conversion_received' : configuredEvent;
  if (!normalizedConfiguredEvent || normalizedConfiguredEvent !== firedEvent) return false;

  switch (firedEvent) {
    case 'tag_added':
      if (config.eventValue && config.eventValue !== context.tag) return false;
      break;
    case 'status_changed':
      if (config.eventValue && config.eventValue !== context.toStatus) return false;
      break;
    case 'conversion_received':
      if (
        config.eventValue &&
        config.eventValue !== context.webhookSourceId &&
        config.eventValue !== context.conversionName
      ) return false;
      break;
    case 'email_received': {
      const expected = String(config.eventValue ?? config.replyContains ?? '').trim().toLowerCase();
      if (expected) {
        const haystack = `${String(context.subject ?? '')}\n${String(context.text ?? '')}`.toLowerCase();
        const terms = expected.split(',').map(item => item.trim()).filter(Boolean);
        if (terms.length > 0 && !terms.some(term => haystack.includes(term))) return false;
      }
      break;
    }
    case 'segment_entered':
      if (config.eventValue && config.eventValue !== context.segmentId) return false;
      break;
  }

  return true;
}

type LeadRecord = {
  status: string;
  score: number;
  tags: string[];
  isHot: boolean;
  firstSource: string | null;
  company: string | null;
  jobTitle: string | null;
  phone: string | null;
  name: string | null;
  assignedTo: string | null;
};

function evaluateCondition(
  lead: LeadRecord,
  config: Record<string, string | number | boolean>
): boolean {
  const field = String(config.field ?? '');
  const operator = String(config.operator ?? '=');
  const value = String(config.value ?? '');

  if (field === 'tag') {
    return operator === 'has_tag' ? lead.tags.includes(value)
         : operator === 'not_has_tag' ? !lead.tags.includes(value)
         : false;
  }

  let leadValue: string | number | null = null;
  switch (field) {
    case 'status':     leadValue = lead.status; break;
    case 'score':      leadValue = lead.score; break;
    case 'source':     leadValue = lead.firstSource; break;
    case 'company':    leadValue = lead.company; break;
    case 'jobTitle':   leadValue = lead.jobTitle; break;
    case 'phone':      leadValue = lead.phone ? '1' : null; break;
    case 'is_hot':     return lead.isHot === (value === 'true');
    case 'assigned_to': leadValue = lead.assignedTo; break;
    default: return false;
  }

  if (leadValue === null) return false;

  switch (operator) {
    case '=':            return String(leadValue) === value;
    case '!=':           return String(leadValue) !== value;
    case '>':            return Number(leadValue) > Number(value);
    case '<':            return Number(leadValue) < Number(value);
    case '>=':           return Number(leadValue) >= Number(value);
    case '<=':           return Number(leadValue) <= Number(value);
    case 'contains': {
      const expectedValues = value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
      const normalizedLeadValue = String(leadValue).toLowerCase();
      return expectedValues.length > 0
        ? expectedValues.some(expected => normalizedLeadValue.includes(expected))
        : normalizedLeadValue.includes(value.toLowerCase());
    }
    case 'not_contains': {
      const expectedValues = value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
      const normalizedLeadValue = String(leadValue).toLowerCase();
      return expectedValues.length > 0
        ? expectedValues.every(expected => !normalizedLeadValue.includes(expected))
        : !normalizedLeadValue.includes(value.toLowerCase());
    }
    default:             return false;
  }
}

// ─── Exit conditions (saida global do fluxo) ─────────────────────────────────

type ExitConditionRule = { field?: string; operator?: string; value?: string };
type ExitConditions = { logic?: string; conditions?: ExitConditionRule[] };

const LEAD_RECORD_SELECT = {
  status: true, score: true, tags: true, isHot: true, firstSource: true,
  company: true, jobTitle: true, phone: true, name: true, assignedTo: true,
} as const;

function evaluateExitConditions(lead: LeadRecord, exit: ExitConditions | null | undefined): boolean {
  if (!exit?.conditions?.length) return false;
  const results = exit.conditions.map(c => evaluateCondition(lead, c as Record<string, string>));
  return exit.logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

async function shouldExitJourney(exit: unknown, leadEmail: string): Promise<boolean> {
  const parsed = exit as ExitConditions | null;
  if (!parsed?.conditions?.length) return false;
  const lead = await prisma.lead.findUnique({ where: { email: leadEmail }, select: LEAD_RECORD_SELECT });
  if (!lead) return false;
  return evaluateExitConditions(lead, parsed);
}

async function exitExecution(executionId: string, nodeId: string | undefined): Promise<void> {
  if (nodeId) {
    await appendLog(executionId, nodeId, 'exit_condition', 'ok', 'Saiu do fluxo: condição de saída atingida').catch(() => {});
  }
  await finishExecution(executionId, 'completed').catch(() => {});
}

async function appendLog(
  executionId: string,
  nodeId: string,
  nodeType: string,
  status: 'ok' | 'error' | 'skipped',
  message?: string
): Promise<void> {
  const entry: LogEntry = { nodeId, nodeType, status, message, ts: new Date().toISOString() };
  await prisma.$executeRaw`
    UPDATE "AutomationExecution"
    SET log = log || ${JSON.stringify(entry)}::jsonb
    WHERE id = ${executionId}
  `;
}

// ─── Block handlers ───────────────────────────────────────────────────────────

const VALID_LEAD_STATUSES: ReadonlySet<string> = new Set([
  'LEAD', 'MQL', 'SQL', 'SCHEDULED', 'DEMO', 'PROPOSAL', 'OPPORTUNITY', 'CLIENT', 'LOST', 'DISQUALIFIED',
]);

async function executeInternalAction(
  leadEmail: string,
  config: Record<string, string | number | boolean>
): Promise<void> {
  const { LeadHubService } = await import('./lead-hub.service');
  const action = String(config.action ?? '');

  // Panel saves all value fields as config.value
  const value = String(config.value ?? config.tagValue ?? config.scoreAmount ?? config.statusValue ?? '');

  switch (action) {
    case 'add_tag': {
      if (!value) throw new Error('Tag não configurada no bloco Ação Interna');
      await LeadHubService.addTag(leadEmail, value);
      break;
    }
    case 'remove_tag': {
      if (!value) throw new Error('Tag não configurada no bloco Ação Interna');
      await LeadHubService.removeTag(leadEmail, value);
      break;
    }
    case 'add_score': {
      const amount = Number(value) || 0;
      if (amount !== 0) {
        const lead = await prisma.lead.findUnique({ where: { email: leadEmail }, select: { score: true } });
        if (lead) {
          await prisma.lead.update({
            where: { email: leadEmail },
            data: { score: Math.max(0, lead.score + amount) },
          });
        }
      }
      break;
    }
    case 'set_score': {
      const score = Number(value) || 0;
      await prisma.lead.update({ where: { email: leadEmail }, data: { score: Math.max(0, score) } });
      break;
    }
    case 'set_status':
    case 'change_status': {
      const status = String(config.value ?? config.statusValue ?? '');
      // FIX: validate against enum before calling DB to avoid P2003 Prisma error
      if (!status || !VALID_LEAD_STATUSES.has(status)) {
        throw new Error(`Status inválido no bloco Ação Interna: '${status}'. Use: ${[...VALID_LEAD_STATUSES].join(', ')}`);
      }
      await LeadHubService.updateLeadStatus(leadEmail, status as LeadStatus, 'automation');
      break;
    }
    case 'set_hot':
      await prisma.lead.update({ where: { email: leadEmail }, data: { isHot: true } });
      break;
    case 'unset_hot':
      await prisma.lead.update({ where: { email: leadEmail }, data: { isHot: false } });
      break;
    case 'assign_to': {
      const assignedTo = String(config.value ?? config.assignedTo ?? '');
      if (assignedTo) await prisma.lead.update({ where: { email: leadEmail }, data: { assignedTo } });
      break;
    }
  }
}

async function executeRDConversion(
  leadEmail: string,
  config: Record<string, string | number | boolean>
): Promise<{ event_uuid?: string } | null> {
  const { sendRdConversionEvent } = await import('./rdstation.service');
  const lead = await prisma.lead.findUnique({
    where: { email: leadEmail },
    select: { email: true, name: true, phone: true, company: true },
  });
  if (!lead) return null;

  const identifier = String(config.conversionIdentifier ?? config.conversionName ?? '');
  if (!identifier) throw new Error('conversionIdentifier não configurado no bloco RD Station');

  return sendRdConversionEvent({
    conversion_identifier: identifier,
    name:         lead.name ?? undefined,
    email:        lead.email,
    mobile_phone: lead.phone ?? undefined,
    company_name: lead.company ?? undefined,
  });
}

async function executeWhatsAppMessage(
  leadEmail: string,
  config: Record<string, string | number | boolean>,
  executionId: string,
  journeyId: string
): Promise<void> {
  const { getWhatsAppCredentials, recordOutgoingWhatsAppMessage, buildComponentParams, resolveTemplateBodyText } = await import('./whatsapp.service');

  const lead = await prisma.lead.findUnique({
    where: { email: leadEmail },
    select: { phone: true, name: true, email: true, jobTitle: true, company: true, status: true, score: true },
  });
  if (!lead?.phone) {
    throw new Error(`Lead ${leadEmail} não tem telefone para envio de WhatsApp`);
  }

  const templateName = String(config.templateName ?? '');
  const language     = String(config.templateLanguage ?? 'pt_BR');
  if (!templateName) throw new Error('Template não configurado no bloco WhatsApp');

  const { accessToken } = await getWhatsAppCredentials();
  const phoneNumberId = String(config.phoneNumberId ?? '') || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) throw new Error('Número WhatsApp não configurado no bloco nem em WHATSAPP_PHONE_NUMBER_ID');

  const to = normalizePhoneE164(lead.phone);
  if (!to) throw new Error(`Lead ${leadEmail} tem telefone inválido ou sem DDD`);

  // Map lead fields by the same keys used in OUR_LEAD_FIELDS on the frontend
  const leadFieldValues: Record<string, string> = {
    name:        lead.name     ?? '',
    email:       lead.email    ?? '',
    phone:       lead.phone    ?? '',
    jobTitle:    lead.jobTitle ?? '',
    companyName: lead.company  ?? '',
    status:      lead.status   ?? '',
    score:       String(lead.score ?? ''),
  };

  // varMappings: { "{{1}}": "name", "{{2}}": "email", ... } (posicional) OU
  // { "{{nome}}": "name", ... } (parametro nomeado — a Meta so permite um
  // formato por template, nunca misturado, mas tratamos cada chave por si).
  let varMappings: Record<string, string> = {};
  try { varMappings = JSON.parse(String(config.varMappings ?? '{}')); } catch { /* ignore */ }

  // HEADER e BODY sao componentes separados pra Meta, cada um com seu proprio
  // array de parameters — por isso extraimos o texto de cada um antes de
  // montar os parametros (ver comentario em buildComponentParams).
  let templateComponentsParsed: Array<{ type: string; text?: string }> = [];
  try { templateComponentsParsed = JSON.parse(String(config.templateComponents ?? '[]')); } catch { /* ignore */ }
  const headerComp = templateComponentsParsed.find(c => c.type === 'HEADER' || c.type === 'header');
  const bodyComp   = templateComponentsParsed.find(c => c.type === 'BODY'   || c.type === 'body');

  const headerParams = buildComponentParams(headerComp?.text, varMappings, leadFieldValues);
  const bodyParams   = buildComponentParams(bodyComp?.text, varMappings, leadFieldValues);
  const headerFormat = String((headerComp as { format?: string } | undefined)?.format ?? '').toUpperCase();
  const headerMediaUrl = String(config.headerMediaUrl ?? '').trim();
  const headerMediaId = String(config.headerMediaId ?? '').trim();
  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && !headerMediaUrl && !headerMediaId) {
    throw new Error(`Template ${templateName} exige uma mídia no cabeçalho (${headerFormat.toLowerCase()})`);
  }
  if (headerFormat && headerFormat !== 'TEXT' && (headerMediaUrl || headerMediaId)) {
    const key = headerFormat.toLowerCase();
    headerParams.splice(0, headerParams.length, { type: key, [key]: headerMediaId ? { id: headerMediaId } : { link: headerMediaUrl } } as any);
  }

  const templatePayload: Record<string, unknown> = {
    name: templateName,
    language: { code: language },
  };
  const templateComponents: Array<Record<string, unknown>> = [];
  if (headerParams.length > 0) templateComponents.push({ type: 'header', parameters: headerParams });
  if (bodyParams.length > 0) templateComponents.push({ type: 'body', parameters: bodyParams });
  if (templateComponents.length > 0) templatePayload.components = templateComponents;

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: templatePayload,
  };

  let res: Response;
  try {
    res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );
  } catch (err) {
    await recordOutgoingWhatsAppMessage({
      leadEmail,
      phone: to,
      templateName,
      payload: { request: body, error: err instanceof Error ? err.message : String(err) },
      automationJourneyId: journeyId,
      automationExecutionId: executionId,
      phoneNumberId,
      status: 'failed',
    });
    throw err;
  }

  const responseText = await res.text();
  let data: { messages?: Array<{ id?: string }>; error?: { code?: number; message?: string; title?: string; error_data?: { details?: string } } } = {};
  try { data = responseText ? JSON.parse(responseText) : {}; } catch { /* resposta não JSON da Meta */ }

  if (!res.ok || data.error) {
    await recordOutgoingWhatsAppMessage({
      leadEmail,
      phone: to,
      templateName,
      payload: { request: body, error: data.error ?? responseText.slice(0, 500) },
      automationJourneyId: journeyId,
      automationExecutionId: executionId,
      phoneNumberId,
      status: 'failed',
    });
    throw new Error(data.error?.message ?? `WhatsApp API error ${res.status}: ${responseText.slice(0, 300)}`);
  }

  // Build resolved text preview from template components + varMappings.
  const resolvedText: string | null = bodyComp?.text
    ? resolveTemplateBodyText(bodyComp.text, varMappings, leadFieldValues)
    : null;

  await recordOutgoingWhatsAppMessage({
    leadEmail,
    phone: to,
    messageId: data.messages?.[0]?.id ?? null,
    templateName,
    text: resolvedText,
    payload: body,
    automationJourneyId: journeyId,
    automationExecutionId: executionId,
    phoneNumberId,
  });
}

async function executeAIPrequalification(
  executionId: string,
  journeyId: string,
  nodeId: string,
  leadEmail: string,
  config: Record<string, string | number | boolean>
): Promise<AIPrequalificationResult> {
  const lead = await prisma.lead.findUnique({
    where: { email: leadEmail },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      company: true,
      jobTitle: true,
      status: true,
      score: true,
      tags: true,
      notes: true,
      customFields: true,
    },
  });
  if (!lead) throw new Error(`Lead ${leadEmail} nao encontrado para pre-qualificacao por IA`);

  // orderBy 'asc' + take pegaria as 80 mensagens MAIS ANTIGAS da conversa (mesmo
  // bug corrigido em ai-whatsapp-reply.service.ts): em qualquer conversa com mais
  // de 80 mensagens, a pre-qualificacao analisaria so o inicio, nunca o estado
  // atual real da conversa. Busca as mais recentes e reverte a ordem depois.
  const recentMessages = await (prisma as any).whatsAppMessage.findMany({
    where: {
      OR: [
        { leadId: lead.id },
        { leadEmail: lead.email },
        ...(lead.phone ? [{ phone: lead.phone.replace(/\D/g, '') }, { phone: lead.phone }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 80,
  }) as Array<{
    direction: string;
    type: string;
    text: string | null;
    templateName: string | null;
    createdAt: Date;
  }>;
  const messages = recentMessages.reverse();

  const transcript = messages
    .filter(message => message.text || message.templateName)
    .map(message => {
      const who = message.direction === 'inbound' ? 'Lead' : 'AutoForce';
      const text = message.text || `[template:${message.templateName}]`;
      return `${who}: ${text}`;
    })
    .join('\n')
    .slice(-12_000);

  const lastMessageAt = messages.length > 0 ? messages[messages.length - 1]?.createdAt ?? null : null;
  const agentContext = await loadAIAgentContext({
    agentId: String(config.agentId ?? ''),
    leadEmail: lead.email,
    channel: 'whatsapp',
    knowledgeCategories: splitConfigList(config.knowledgeCategories),
    knowledgeTags: splitConfigList(config.knowledgeTags),
  });

  const result = await runAIPrequalification({
    lead,
    transcript,
    goal: String(config.goal ?? 'Identificar fit, dor, urgencia e proximo passo comercial.'),
    criteria: String(config.criteria ?? ''),
    provider: String(config.provider ?? agentContext.agent.defaultProvider ?? ''),
    model: String(config.model ?? agentContext.agent.defaultModel ?? ''),
    agentContext,
  });

  const qualifiedTag = String(config.qualifiedTag ?? 'ia_qualificado').trim();
  const disqualifiedTag = String(config.disqualifiedTag ?? 'ia_desqualificado').trim();
  const mqlScore = Number(config.mqlScore ?? 70) || 70;
  const setMqlStatus = String(config.setMqlStatus ?? 'yes') !== 'no';

  const tagsToAdd = new Set(result.tags.map(tag => tag.trim()).filter(Boolean));
  if (result.fit === 'qualified' && qualifiedTag) tagsToAdd.add(qualifiedTag);
  if (result.fit === 'disqualified' && disqualifiedTag) tagsToAdd.add(disqualifiedTag);

  const currentCustomFields = isRecord(lead.customFields) ? lead.customFields : {};
  const nextCustomFields: Prisma.JsonObject = {
    ...currentCustomFields,
    ia_prequalificacao_fit: result.fit,
    ia_prequalificacao_score: result.score,
    ia_prequalificacao_confianca: result.confidence,
    ia_prequalificacao_dor: result.pain,
    ia_prequalificacao_persona: result.persona,
    ia_prequalificacao_urgencia: result.urgency,
    ia_prequalificacao_resumo: result.summary,
    ia_prequalificacao_motivo: result.decisionReason,
    ia_prequalificacao_proximo_passo: result.recommendedNextStep,
    ia_prequalificacao_acoes_recomendadas: result.recommendedActions as Prisma.JsonArray,
    ia_prequalificacao_estado_conversa: result.conversationState,
    ia_prequalificacao_perguntas_abertas: result.openQuestions as unknown as Prisma.JsonArray,
    ia_prequalificacao_atualizacoes_lead: result.leadUpdates as Prisma.JsonObject,
    ia_prequalificacao_agent_id: agentContext.agent.id,
    ia_prequalificacao_agent_name: agentContext.agent.name,
    ia_prequalificacao_origem: result.source,
    ia_prequalificacao_modelo: result.model,
    ia_prequalificacao_erro: result.reason ?? '',
    ia_prequalificacao_at: new Date().toISOString(),
  };

  const noteBlock = [
    `[IA Pre-qualificacao - ${new Date().toLocaleString('pt-BR')}]`,
    `Fit: ${result.fit}`,
    `Score: ${result.score}`,
    `Confianca: ${result.confidence}`,
    `Modelo: ${result.source}/${result.model}`,
    result.decisionReason ? `Motivo: ${result.decisionReason}` : null,
    result.summary ? `Resumo: ${result.summary}` : null,
    result.recommendedNextStep ? `Proximo passo: ${result.recommendedNextStep}` : null,
  ].filter(Boolean).join('\n');

  const data: Prisma.LeadUpdateInput = {
    customFields: nextCustomFields,
    tags: Array.from(new Set([...lead.tags, ...tagsToAdd])),
    score: Math.max(lead.score, result.score),
    notes: lead.notes ? `${lead.notes}\n\n${noteBlock}` : noteBlock,
  };

  await prisma.lead.update({ where: { email: lead.email }, data });

  await persistAIAgentDecision({
    agentId: agentContext.agent.id,
    leadEmail: lead.email,
    channel: 'whatsapp',
    journeyId,
    executionId,
    nodeId,
    provider: result.source,
    model: result.model,
    promptSnapshot: result.promptSnapshot ?? {},
    result,
    lastMessageAt,
  });

  if (setMqlStatus && result.fit === 'qualified' && result.score >= mqlScore && lead.status !== LeadStatus.MQL) {
    const { LeadHubService } = await import('./lead-hub.service');
    await LeadHubService.updateLeadStatus(lead.email, LeadStatus.MQL, 'automation', 'IA pre-qualificacao');
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, Prisma.JsonValue> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function splitConfigList(value: string | number | boolean | undefined): string[] {
  if (typeof value !== 'string') return [];
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

async function executePipedriveAction(
  executionId: string,
  nodeId: string,
  leadEmail: string,
  config: Record<string, string | number | boolean>
): Promise<void> {
  const { createPipedriveDeal, updatePipedriveDealStage, markPipedriveDeal } = await import('./pipedrive.service') as {
    createPipedriveDeal: (email: string, title: string, pipeline: string, note?: string) => Promise<{ dealId: string; personId: string }>;
    updatePipedriveDealStage: (dealId: string, stageId: number) => Promise<void>;
    markPipedriveDeal: (dealId: string, status: 'won' | 'lost', lostReason?: string) => Promise<void>;
  };
  const actionType = String(config.action ?? config.actionType ?? '');

  const lead = await prisma.lead.findUnique({
    where: { email: leadEmail },
    select: { id: true, name: true, company: true, pipedriveDealId: true, firstSource: true, firstCampaign: true },
  });
  if (!lead) return;

  if (!actionType) throw new Error('Ação não configurada no bloco Pipedrive');

  switch (actionType) {
    case 'create_deal': {
      const titleField   = String(config.titleField ?? 'companyName');
      const pipeline     = String(config.pipeline ?? 'novo_cliente');
      const noteTemplate = String(config.noteTemplate ?? config.note ?? '');

      // Mesmas chaves usadas em OUR_LEAD_FIELDS no frontend (ex: 'companyName' -> lead.company)
      const titleValue = titleField === 'companyName' ? (lead.company ?? lead.name ?? lead.id)
                       : titleField === 'name'         ? (lead.name ?? lead.id)
                       : null;

      const fullLead = noteTemplate
        ? await prisma.lead.findUnique({ where: { email: leadEmail } })
        : null;

      const note = fullLead ? resolveTemplate(noteTemplate, { ...fullLead as unknown as Record<string, unknown> }) : undefined;

      await createPipedriveDeal(leadEmail, String(titleValue ?? lead.id), pipeline, note);
      await appendLog(executionId, nodeId, 'pipedrive_action', 'ok', `create_deal pipeline=${pipeline}`);
      break;
    }
    case 'update_stage': {
      const stageId = Number(config.stageId);
      // FIX: log 'skipped' instead of 'ok' when pipedriveDealId is missing
      if (!stageId || !lead.pipedriveDealId) {
        await appendLog(executionId, nodeId, 'pipedrive_action', 'skipped',
          !lead.pipedriveDealId ? 'Lead sem deal Pipedrive vinculado' : 'stageId não configurado');
        break;
      }
      await updatePipedriveDealStage(lead.pipedriveDealId, stageId);
      await appendLog(executionId, nodeId, 'pipedrive_action', 'ok', `update_stage stageId=${stageId}`);
      break;
    }
    case 'mark_won': {
      if (!lead.pipedriveDealId) {
        await appendLog(executionId, nodeId, 'pipedrive_action', 'skipped', 'Lead sem deal Pipedrive vinculado');
        break;
      }
      await markPipedriveDeal(lead.pipedriveDealId, 'won');
      await appendLog(executionId, nodeId, 'pipedrive_action', 'ok', 'mark_won');
      break;
    }
    case 'mark_lost': {
      if (!lead.pipedriveDealId) {
        await appendLog(executionId, nodeId, 'pipedrive_action', 'skipped', 'Lead sem deal Pipedrive vinculado');
        break;
      }
      const reason = String(config.lostReason ?? '');
      await markPipedriveDeal(lead.pipedriveDealId, 'lost', reason);
      await appendLog(executionId, nodeId, 'pipedrive_action', 'ok', `mark_lost reason=${reason || '(none)'}`);
      break;
    }
    default:
      await appendLog(executionId, nodeId, 'pipedrive_action', 'skipped', `ação desconhecida: ${actionType}`);
  }
}

async function executeSendEmail(
  executionId: string,
  nodeId: string,
  leadEmail: string,
  config: Record<string, string | number | boolean>
): Promise<void> {
  const { sendEmail, renderTemplate } = await import('./resend.service');

  const lead = await prisma.lead.findUnique({
    where: { email: leadEmail },
    select: { email: true, name: true, company: true, phone: true, jobTitle: true },
  });
  if (!lead) throw new Error(`Lead ${leadEmail} não encontrado para envio de email`);

  const templateId = config.templateId ? String(config.templateId) : null;

  let subjectRaw: string;
  let bodyRaw: string;
  let fromName: string | undefined;
  let fromEmail: string | undefined;

  if (templateId) {
    const tpl = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
    if (!tpl) throw new Error(`Template de email ${templateId} não encontrado`);
    subjectRaw = config.subject ? String(config.subject).trim() || tpl.subject : tpl.subject;
    bodyRaw    = tpl.body;
    fromName   = tpl.fromName  ?? undefined;
    fromEmail  = tpl.fromEmail ?? undefined;
  } else {
    subjectRaw = String(config.subject ?? '').trim();
    bodyRaw    = String(config.body    ?? '').trim();
    fromName   = config.fromName  ? String(config.fromName)  : undefined;
    fromEmail  = config.fromEmail ? String(config.fromEmail) : undefined;
    if (!subjectRaw) throw new Error('Bloco Email: campo "Assunto" é obrigatório');
    if (!bodyRaw)    throw new Error('Bloco Email: campo "Corpo" é obrigatório');
  }

  const subject = renderTemplate(subjectRaw, lead);
  const html    = renderTemplate(bodyRaw,    lead);

  await sendEmail({
    leadEmail:             lead.email,
    toEmail:               lead.email,
    subject,
    html,
    fromName,
    fromEmail,
    templateId:            templateId ?? undefined,
    automationExecutionId: executionId,
    automationNodeId:      nodeId,
    // Fluxos antigos não tinham classificação. Tratá-los como newsletter é
    // o fallback conservador: mantém respeitados os descadastros históricos
    // até que o responsável revise e classifique cada bloco explicitamente.
    communicationType:     normalizeEmailCommunicationType(config.communicationType, 'NEWSLETTER'),
  });
}

function resolveTemplate(template: string, lead: Record<string, unknown>): string {
  return template
    .replace(/\{nome\}/g,        String(lead.name    ?? ''))
    .replace(/\{empresa\}/g,     String(lead.company ?? ''))
    .replace(/\{cargo\}/g,       String(lead.jobTitle ?? ''))
    .replace(/\{email\}/g,       String(lead.email   ?? ''))
    .replace(/\{telefone\}/g,    String(lead.phone   ?? ''))
    .replace(/\{campanha\}/g,    String(lead.firstCampaign ?? ''))
    .replace(/\{origem\}/g,      String(lead.firstSource  ?? ''))
    .replace(/\{score\}/g,       String(lead.score  ?? ''))
    .replace(/\{landing_page\}/g, String(lead.firstLandingPage ?? ''));
}
