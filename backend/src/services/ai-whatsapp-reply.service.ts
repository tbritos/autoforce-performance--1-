import { prisma } from '../config/database';
import { loadAIAgentContext, persistAIAgentDecision } from './ai-agent-context.service';
import { runAIPrequalification } from './ai-provider.service';
import type { WhatsAppConversationMessage } from './whatsapp.service';

const DEBOUNCE_MS = 5_000;
const LOCK_TTL_MS = 120_000; // treat lock as stale after 2 minutes
const MAX_TRANSCRIPT_MSGS = 40;

// In-memory debounce timers — process-local, works for single-process deployments
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Called on every inbound WhatsApp message for a known lead.
 * Resets the 5-second debounce window so rapid messages are batched.
 */
export function scheduleAIReply(leadEmail: string, phone: string): void {
  const existing = pendingTimers.get(leadEmail);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingTimers.delete(leadEmail);
    void processAIReply(leadEmail, phone).catch(err => {
      console.error(`[AI-WPP] processAIReply error for ${leadEmail}:`, err);
    });
  }, DEBOUNCE_MS);

  pendingTimers.set(leadEmail, timer);
}

async function processAIReply(leadEmail: string, phone: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { email: leadEmail },
    select: {
      id: true,
      email: true,
      name: true,
      company: true,
      jobTitle: true,
      status: true,
      score: true,
      tags: true,
      phone: true,
      aiHandoff: true,
      aiProcessing: true,
      aiProcessingAt: true,
    },
  });

  if (!lead) return;

  // Human handoff active — AI stays silent
  if (lead.aiHandoff) return;

  // Acquire lock: skip if a fresh lock is already held
  const now = new Date();
  if (lead.aiProcessing && lead.aiProcessingAt) {
    const ageMs = now.getTime() - lead.aiProcessingAt.getTime();
    if (ageMs < LOCK_TTL_MS) return;
  }

  await prisma.lead.update({
    where: { email: leadEmail },
    data: { aiProcessing: true, aiProcessingAt: now },
  });

  try {
    await executeAIAndReply(lead, phone);
  } finally {
    await prisma.lead
      .update({ where: { email: leadEmail }, data: { aiProcessing: false, aiProcessingAt: null } })
      .catch(() => {/* lock release must not throw */});
  }
}

async function executeAIAndReply(
  lead: {
    id: string;
    email: string;
    name: string | null;
    company: string | null;
    jobTitle: string | null;
    status: string;
    score: number;
    tags: string[];
    phone: string | null;
  },
  phone: string
): Promise<void> {
  const {
    listWhatsAppConversationByLead,
    recordOutgoingWhatsAppMessage,
    getWhatsAppCredentials,
  } = await import('./whatsapp.service');

  // Load conversation history and build transcript
  const messages = await listWhatsAppConversationByLead(lead.id);
  const transcript = buildTranscript(messages);

  // Load AI agent config + persistent memory + knowledge base
  const agentContext = await loadAIAgentContext({ leadEmail: lead.email, channel: 'whatsapp' });

  // Run AI prequalification
  const result = await runAIPrequalification({
    lead: {
      email: lead.email,
      name: lead.name,
      company: lead.company,
      jobTitle: lead.jobTitle,
      status: lead.status as any,
      score: lead.score,
      tags: lead.tags,
    },
    transcript,
    goal: agentContext.agent.objective || 'Responder receptivamente ao lead, entender sua dor e qualificá-lo.',
    criteria: '',
    provider: agentContext.agent.defaultProvider ?? undefined,
    model: agentContext.agent.defaultModel ?? undefined,
    agentContext,
  });

  // Send text reply if the AI produced one
  const replyText = result.replyMessage?.trim();
  if (replyText) {
    await sendWhatsAppText({
      to: phone,
      text: replyText,
      leadEmail: lead.email,
      getCredentials: getWhatsAppCredentials,
      recordOutgoing: recordOutgoingWhatsAppMessage,
    });
  }

  // Apply AI-recommended actions (tags, handoff)
  await applyRecommendedActions(lead.email, result.recommendedActions ?? [], result.tags ?? []);

  // Persist AI decision to memory + interaction log
  await persistAIAgentDecision({
    agentId: agentContext.agent.id,
    leadEmail: lead.email,
    channel: 'whatsapp',
    provider: result.source,
    model: result.model,
    promptSnapshot: result.promptSnapshot ?? {},
    result,
    lastMessageAt: new Date(),
  });
}

// ─── Transcript builder ───────────────────────────────────────────────────────

function buildTranscript(messages: WhatsAppConversationMessage[]): string {
  if (messages.length === 0) return '(sem histórico de conversa)';

  // Keep only the most recent N messages to avoid huge prompts
  const recent = messages.slice(-MAX_TRANSCRIPT_MSGS);

  return recent
    .map(msg => {
      const ts = (msg.receivedAt ?? msg.sentAt ?? msg.createdAt).toLocaleString('pt-BR');
      if (msg.direction === 'inbound') {
        return `[${ts}] LEAD: ${msg.text ?? '(mensagem sem texto)'}`;
      }
      if (msg.templateName) {
        return `[${ts}] BOT (template: ${msg.templateName}): ${msg.text ?? '(template enviado)'}`;
      }
      return `[${ts}] BOT: ${msg.text ?? '(sem texto)'}`;
    })
    .join('\n');
}

// ─── WhatsApp text sender ─────────────────────────────────────────────────────

type SendTextParams = {
  to: string;
  text: string;
  leadEmail: string;
  getCredentials: () => Promise<{ accessToken: string; businessAccountId: string }>;
  recordOutgoing: (input: {
    leadEmail: string;
    phone: string;
    messageId?: string | null;
    text?: string | null;
    payload?: unknown;
  }) => Promise<void>;
};

async function sendWhatsAppText(params: SendTextParams): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!phoneNumberId) {
    console.warn('[AI-WPP] WHATSAPP_PHONE_NUMBER_ID não configurado — resposta da IA não enviada');
    return;
  }

  const { accessToken } = await params.getCredentials();
  const digits = params.to.replace(/\D/g, '');
  const toE164 = digits.startsWith('55') ? digits : `55${digits}`;

  const body = {
    messaging_product: 'whatsapp',
    to: toE164,
    type: 'text',
    text: { body: params.text.slice(0, 1024) },
  };

  let messageId: string | null = null;

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json() as { messages?: Array<{ id?: string }> };
      messageId = data.messages?.[0]?.id ?? null;
    } else {
      const text = await res.text();
      console.error(`[AI-WPP] WhatsApp API error ${res.status}: ${text.slice(0, 300)}`);
    }
  } catch (err) {
    console.error('[AI-WPP] fetch error sending reply:', err);
  }

  // Always record the outgoing message, even if API call failed
  await params.recordOutgoing({
    leadEmail: params.leadEmail,
    phone: toE164,
    messageId,
    text: params.text,
    payload: body,
  });
}

// ─── Action applier ───────────────────────────────────────────────────────────

async function applyRecommendedActions(
  leadEmail: string,
  actions: Array<{ type: string; reason: string; payload?: Record<string, unknown> }>,
  aiTags: string[]
): Promise<void> {
  // Merge AI-generated tags onto the lead
  if (aiTags.length > 0) {
    const lead = await prisma.lead.findUnique({ where: { email: leadEmail }, select: { tags: true } });
    if (lead) {
      const merged = Array.from(new Set([...lead.tags, ...aiTags]));
      if (merged.length > lead.tags.length) {
        await prisma.lead.update({ where: { email: leadEmail }, data: { tags: merged } });
      }
    }
  }

  for (const action of actions) {
    switch (action.type) {
      case 'handoff_to_human':
        await prisma.lead.update({ where: { email: leadEmail }, data: { aiHandoff: true } });
        break;

      case 'apply_tag': {
        const tag = String(action.payload?.tag ?? '').trim();
        if (tag) {
          const lead = await prisma.lead.findUnique({ where: { email: leadEmail }, select: { tags: true } });
          if (lead && !lead.tags.includes(tag)) {
            await prisma.lead.update({ where: { email: leadEmail }, data: { tags: { push: tag } } });
          }
        }
        break;
      }

      default:
        break;
    }
  }
}
