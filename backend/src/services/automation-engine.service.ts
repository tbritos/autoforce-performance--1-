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

// Re-entrancy guard: prevent the same lead from running the same journey twice concurrently
const executingLeads = new Set<string>();

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
      runExecution(execution.id, nodes, edges, leadEmail, context).catch(err => {
        console.error(`[automation] execution ${execution.id} crashed:`, err);
      });
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

  const execution = await prisma.automationExecution.create({
    data: {
      journeyId,
      leadEmail,
      status: 'running',
      currentNodeId: triggerNode?.id ?? null,
      log: [],
    },
  });

  runExecution(execution.id, nodes, edges, leadEmail, { _test: true }).catch(err => {
    console.error(`[automation] test execution ${execution.id} failed:`, err);
  });

  return { executionId: execution.id };
}

export async function resumeWaitingExecutions(): Promise<void> {
  const now = new Date();

  const waiting = await prisma.automationExecution.findMany({
    where: { status: 'waiting', resumeAt: { lte: now } },
    include: { journey: true },
  });

  for (const execution of waiting) {
    const guardKey = `${execution.journeyId}:${execution.leadEmail}`;
    if (executingLeads.has(guardKey)) continue;

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

    await prisma.automationExecution.update({
      where: { id: execution.id },
      data: { status: 'running', resumeAt: null },
    });

    runExecution(execution.id, nodes, edges, execution.leadEmail, {}, outEdges[0].target).catch(err => {
      console.error(`[automation] resume ${execution.id} crashed:`, err);
    });
  }
}

// ─── Execution loop ───────────────────────────────────────────────────────────

async function runExecution(
  executionId: string,
  nodes: AutomationNode[],
  edges: AutomationEdge[],
  leadEmail: string,
  context: TriggerContext,
  startNodeId?: string
): Promise<void> {
  const journeyId = (await prisma.automationExecution.findUnique({
    where: { id: executionId },
    select: { journeyId: true },
  }))?.journeyId;

  const guardKey = `${journeyId}:${leadEmail}`;
  executingLeads.add(guardKey);

  try {
    const triggerNode = nodes.find(n => n.type === 'trigger');
    let currentNodeId = startNodeId ?? triggerNode?.id;
    if (!currentNodeId) return;

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
        await prisma.automationExecution.update({
          where: { id: executionId },
          data: { status: 'failed', error: message, completedAt: new Date() },
        });
        return;
      }

      if (result === 'wait') return;
      if (result === 'stop') break;

      const outEdges = edges.filter(e => e.source === currentNodeId);
      if (outEdges.length === 0) break;

      if (typeof result === 'boolean') {
        // condition node: true → first edge, false → second edge (or stop)
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
    executingLeads.delete(guardKey);
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
      const unit = String(c.unit || 'hour');
      const ms =
        unit === 'minute' ? amount * 60_000 :
        unit === 'hour'   ? amount * 3_600_000 :
        /* day */           amount * 86_400_000;

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

    case 'rd_conversion':
      await executeRDConversion(leadEmail, c);
      await appendLog(executionId, node.id, 'rd_conversion', 'ok', String(c.conversionName ?? ''));
      return 'ok';

    case 'whatsapp_message':
      await executeWhatsAppMessage(leadEmail, c);
      await appendLog(executionId, node.id, 'whatsapp_message', 'ok', String(c.templateName ?? ''));
      return 'ok';

    case 'pipedrive_action':
      await executePipedriveAction(leadEmail, c);
      await appendLog(executionId, node.id, 'pipedrive_action', 'ok', String(c.actionType ?? ''));
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
  if (!configuredEvent || configuredEvent !== firedEvent) return false;

  switch (firedEvent) {
    case 'tag_added':
      if (config.eventValue && config.eventValue !== context.tag) return false;
      break;
    case 'status_changed':
      if (config.eventValue && config.eventValue !== context.toStatus) return false;
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
    case 'contains':     return String(leadValue).toLowerCase().includes(value.toLowerCase());
    case 'not_contains': return !String(leadValue).toLowerCase().includes(value.toLowerCase());
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

async function executeInternalAction(
  leadEmail: string,
  config: Record<string, string | number | boolean>
): Promise<void> {
  const { LeadHubService } = await import('./lead-hub.service');
  const action = String(config.action ?? '');

  switch (action) {
    case 'add_tag': {
      const tag = String(config.tagValue ?? '');
      if (tag) await LeadHubService.addTag(leadEmail, tag);
      break;
    }
    case 'remove_tag': {
      const tag = String(config.tagValue ?? '');
      if (tag) await LeadHubService.removeTag(leadEmail, tag);
      break;
    }
    case 'add_score': {
      const amount = Number(config.scoreAmount ?? 0);
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
    case 'change_status': {
      const status = String(config.statusValue ?? '') as LeadStatus;
      if (status) await LeadHubService.updateLeadStatus(leadEmail, status, 'automation');
      break;
    }
    case 'set_hot':
      await prisma.lead.update({ where: { email: leadEmail }, data: { isHot: true } });
      break;
    case 'unset_hot':
      await prisma.lead.update({ where: { email: leadEmail }, data: { isHot: false } });
      break;
    case 'assign_to': {
      const assignedTo = String(config.assignedTo ?? '');
      if (assignedTo) await prisma.lead.update({ where: { email: leadEmail }, data: { assignedTo } });
      break;
    }
  }
}

async function executeRDConversion(
  leadEmail: string,
  config: Record<string, string | number | boolean>
): Promise<void> {
  const { sendRdConversionEvent } = await import('./rdstation.service');
  const lead = await prisma.lead.findUnique({
    where: { email: leadEmail },
    select: { email: true, name: true, phone: true, company: true },
  });
  if (!lead) return;

  // conversionIdentifier é o campo principal (ex: "interesse_decisor")
  // conversionName é o nome de exibição opcional — fallback para compatibilidade
  const identifier = String(config.conversionIdentifier ?? config.conversionName ?? '');
  if (!identifier) return;

  await sendRdConversionEvent({
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
  // Use number from block config, fallback to env var
  const phoneNumberId = String(config.phoneNumberId ?? '') || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) throw new Error('Número WhatsApp não configurado no bloco nem em WHATSAPP_PHONE_NUMBER_ID');

  // Normalize phone: keep only digits, ensure country code
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
  leadEmail: string,
  config: Record<string, string | number | boolean>
): Promise<void> {
  const { createPipedriveDeal, updatePipedriveDealStage, markPipedriveDeal } = await import('./pipedrive.service') as {
    createPipedriveDeal: (email: string, title: string, pipeline: string, note?: string) => Promise<{ dealId: string; personId: string }>;
    updatePipedriveDealStage: (dealId: string, stageId: number) => Promise<void>;
    markPipedriveDeal: (dealId: string, status: 'won' | 'lost', lostReason?: string) => Promise<void>;
  };
  const actionType = String(config.actionType ?? '');

  const lead = await prisma.lead.findUnique({
    where: { email: leadEmail },
    select: { id: true, name: true, company: true, pipedriveDealId: true, firstSource: true, firstCampaign: true },
  });
  if (!lead) return;

  switch (actionType) {
    case 'create_deal': {
      const titleField   = String(config.titleField ?? 'company');
      const pipeline     = String(config.pipeline ?? 'novo_cliente');
      const noteTemplate = String(config.note ?? '');

      const titleValue = titleField === 'company' ? (lead.company ?? lead.name ?? lead.id)
                       : titleField === 'name'    ? (lead.name ?? lead.id)
                       : null;

      const fullLead = noteTemplate
        ? await prisma.lead.findUnique({ where: { email: leadEmail } })
        : null;

      const note = fullLead ? resolveTemplate(noteTemplate, { ...fullLead as unknown as Record<string, unknown> }) : undefined;

      await createPipedriveDeal(leadEmail, String(titleValue ?? lead.id), pipeline, note);
      break;
    }
    case 'update_stage': {
      const stageId = Number(config.stageId);
      if (!stageId || !lead.pipedriveDealId) break;
      await updatePipedriveDealStage(lead.pipedriveDealId, stageId);
      break;
    }
    case 'mark_won': {
      if (!lead.pipedriveDealId) break;
      await markPipedriveDeal(lead.pipedriveDealId, 'won');
      break;
    }
    case 'mark_lost': {
      if (!lead.pipedriveDealId) break;
      const reason = String(config.lostReason ?? '');
      await markPipedriveDeal(lead.pipedriveDealId, 'lost', reason);
      break;
    }
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
