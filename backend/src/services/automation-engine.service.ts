import { prisma } from '../config/database';
import { LeadStatus, Prisma } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TriggerEvent =
  | 'lead_created'
  | 'tag_added'
  | 'status_changed'
  | 'score_updated'
  | 'conversion_received';

export interface TriggerContext {
  tag?: string;
  toStatus?: string;
  fromStatus?: string;
  score?: number;
  conversionName?: string;
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
}

interface LogEntry {
  nodeId: string;
  nodeType: string;
  status: 'ok' | 'error' | 'skipped';
  message?: string;
  ts: string;
}

type NodeResult = 'ok' | 'wait' | 'stop' | boolean;

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
    const stuck = await prisma.automationExecution.updateMany({
      where: { status: 'running' },
      data: { status: 'failed', error: 'Processo reiniciado — execução interrompida', completedAt: new Date() },
    });
    if (stuck.count > 0) {
      console.log(`[automation] Recovered ${stuck.count} stuck execution(s) from previous process`);
    }
  } catch (err) {
    console.error('[automation] recoverStuckExecutions error:', err);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fireTrigger(
  event: TriggerEvent,
  leadEmail: string,
  context: TriggerContext = {}
): Promise<void> {
  try {
    const journeys = await prisma.automationJourney.findMany({
      where: { isActive: true },
    });

    for (const journey of journeys) {
      const nodes = (journey.nodes as unknown as AutomationNode[]) ?? [];
      const triggerNode = nodes.find(n => n.type === 'trigger');
      if (!triggerNode) continue;

      const c = (triggerNode.config ?? {}) as Record<string, string>;
      if (!matchesTrigger(c.event, event, c, context)) continue;

      const guardKey = `${journey.id}:${leadEmail}`;
      if (executingLeads.has(guardKey)) continue;

      // FIX: set guard IMMEDIATELY before any await to close the TOCTOU window
      executingLeads.add(guardKey);

      try {
        const execution = await prisma.automationExecution.create({
          data: {
            journeyId: journey.id,
            leadEmail,
            status: 'running',
            currentNodeId: triggerNode.id,
            log: [],
          },
        });

        const edges = (journey.edges as unknown as AutomationEdge[]) ?? [];
        // Pass journeyId directly — avoids a DB round-trip inside runExecution
        runExecution(execution.id, journey.id, nodes, edges, leadEmail, context, undefined, guardKey).catch(err => {
          console.error(`[automation] execution ${execution.id} crashed:`, err);
          executingLeads.delete(guardKey);
        });
      } catch (err) {
        // If execution creation fails, always release the guard
        executingLeads.delete(guardKey);
        console.error(`[automation] fireTrigger create execution error:`, err);
      }
    }
  } catch (err) {
    console.error('[automation] fireTrigger error:', err);
  }
}

export async function testJourneyForLead(
  journeyId: string,
  leadEmail: string
): Promise<{ executionId: string }> {
  const journey = await prisma.automationJourney.findUniqueOrThrow({ where: { id: journeyId } });
  const nodes = (journey.nodes as unknown as AutomationNode[]) ?? [];
  const edges = (journey.edges as unknown as AutomationEdge[]) ?? [];
  const triggerNode = nodes.find(n => n.type === 'trigger');

  // FIX: fail fast — do not create a permanently-stuck 'running' execution
  if (!triggerNode) {
    throw new Error('Journey não tem nó de Entrada configurado. Adicione e configure o bloco de Entrada antes de testar.');
  }

  // Test runs use a separate guard namespace so they don't block real executions
  const guardKey = `test:${journeyId}:${leadEmail}`;
  if (executingLeads.has(guardKey)) {
    throw new Error('Já existe um teste em execução para este lead+journey. Aguarde terminar.');
  }
  executingLeads.add(guardKey);

  const execution = await prisma.automationExecution.create({
    data: {
      journeyId,
      leadEmail,
      status: 'running',
      currentNodeId: triggerNode.id,
      log: [],
    },
  });

  runExecution(execution.id, journeyId, nodes, edges, leadEmail, { _test: true }, undefined, guardKey).catch(err => {
    console.error(`[automation] test execution ${execution.id} failed:`, err);
    executingLeads.delete(guardKey);
  });

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
    if (executingLeads.has(guardKey)) continue;

    // Optimistic DB claim — only succeeds if still 'waiting' (prevents multi-process dupe)
    const claimed = await prisma.automationExecution.updateMany({
      where: { id: execution.id, status: 'waiting' },
      data: { status: 'running', resumeAt: null },
    });
    if (claimed.count === 0) continue; // another process already claimed it

    const nodes = (execution.journey.nodes as unknown as AutomationNode[]) ?? [];
    const edges = (execution.journey.edges as unknown as AutomationEdge[]) ?? [];

    if (!execution.currentNodeId) {
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: { status: 'completed', completedAt: now },
      });
      continue;
    }

    // Resume from the node AFTER the wait node
    const outEdges = edges.filter(e => e.source === execution.currentNodeId);
    if (outEdges.length === 0) {
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: { status: 'completed', completedAt: now },
      });
      continue;
    }

    // FIX: set guard before calling runExecution
    executingLeads.add(guardKey);

    runExecution(execution.id, execution.journeyId, nodes, edges, execution.leadEmail, {}, outEdges[0].target, guardKey).catch(err => {
      console.error(`[automation] resume ${execution.id} crashed:`, err);
      executingLeads.delete(guardKey);
    });
  }
}

// ─── Execution loop ───────────────────────────────────────────────────────────

async function runExecution(
  executionId: string,
  journeyId: string,           // FIX: passed directly — no DB fetch needed
  nodes: AutomationNode[],
  edges: AutomationEdge[],
  leadEmail: string,
  context: TriggerContext,
  startNodeId?: string,
  guardKey?: string             // FIX: passed from caller who already set the guard
): Promise<void> {
  // Derive guardKey if not passed (safety fallback)
  const key = guardKey ?? `${journeyId}:${leadEmail}`;
  let isWaiting = false;

  try {
    const triggerNode = nodes.find(n => n.type === 'trigger');
    let currentNodeId = startNodeId ?? triggerNode?.id;
    if (!currentNodeId) {
      // FIX: mark as failed instead of silently returning with status='running'
      await prisma.automationExecution.update({
        where: { id: executionId },
        data: { status: 'failed', error: 'Journey sem nó de Entrada — execução abortada', completedAt: new Date() },
      }).catch(() => {});
      return;
    }

    const visited = new Set<string>();

    while (currentNodeId) {
      if (visited.has(currentNodeId)) break;
      visited.add(currentNodeId);

      const node = nodes.find(n => n.id === currentNodeId);
      if (!node) break;

      await prisma.automationExecution.update({
        where: { id: executionId },
        data: { currentNodeId },
      });

      let result: NodeResult;
      try {
        result = await executeNode(executionId, node, leadEmail, context);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // FIX: log the failing node before marking as failed
        await appendLog(executionId, node.id, node.type, 'error', message).catch(() => {});
        await prisma.automationExecution.update({
          where: { id: executionId },
          data: { status: 'failed', error: message, completedAt: new Date() },
        });
        return;
      }

      if (result === 'wait') {
        isWaiting = true;  // FIX: guard kept while waiting so new triggers don't start duplicate
        return;
      }
      if (result === 'stop') break;

      const outEdges = edges.filter(e => e.source === currentNodeId);
      if (outEdges.length === 0) break;

      if (typeof result === 'boolean') {
        const nextEdge = result ? outEdges[0] : (outEdges[1] ?? null);
        if (!nextEdge) break;
        currentNodeId = nextEdge.target;
      } else {
        currentNodeId = outEdges[0].target;
      }
    }

    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { status: 'completed', completedAt: new Date() },
    }).catch(() => {});
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

      await prisma.automationExecution.update({
        where: { id: executionId },
        data: { status: 'waiting', resumeAt: new Date(Date.now() + ms) },
      });
      await appendLog(executionId, node.id, 'wait', 'ok', `Aguardando ${amount} ${unit}(s)`);
      return 'wait';
    }

    case 'condition': {
      const lead = await prisma.lead.findUnique({ where: { email: leadEmail } });
      if (!lead) return 'stop';
      const result = evaluateCondition(lead as LeadRecord, c);
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
      await executeWhatsAppMessage(leadEmail, c);
      await appendLog(executionId, node.id, 'whatsapp_message', 'ok', String(c.templateName ?? ''));
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
  config: Record<string, string | number | boolean>
): Promise<void> {
  const { getWhatsAppCredentials } = await import('./whatsapp.service');

  const lead = await prisma.lead.findUnique({
    where: { email: leadEmail },
    select: { phone: true, name: true },
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

  const phone = lead.phone.replace(/\D/g, '');
  const to = phone.startsWith('55') ? phone : `55${phone}`;

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: { name: templateName, language: { code: language } },
  };

  const res = await fetch(
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${text.slice(0, 300)}`);
  }
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
      const titleField   = String(config.titleField ?? 'company');
      const pipeline     = String(config.pipeline ?? 'novo_cliente');
      const noteTemplate = String(config.noteTemplate ?? config.note ?? '');

      const titleValue = titleField === 'company' ? (lead.company ?? lead.name ?? lead.id)
                       : titleField === 'name'    ? (lead.name ?? lead.id)
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
