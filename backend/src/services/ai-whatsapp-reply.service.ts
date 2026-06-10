import { prisma } from '../config/database';
import { loadAIAgentContext, persistAIAgentDecision } from './ai-agent-context.service';
import { runAIPrequalification } from './ai-provider.service';
import type { WhatsAppConversationMessage } from './whatsapp.service';

const DEBOUNCE_MS = 5_000;
const LOCK_TTL_MS = 120_000;
const MAX_TRANSCRIPT_MSGS = 40;

// Debounce timers keyed by phone number
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
// In-memory lock for anonymous phones (no lead record yet)
const anonymousLocks = new Set<string>();

/**
 * Called for every inbound WhatsApp message, known lead or not.
 * Resets the 5-second debounce window per phone number.
 */
export function scheduleAIReply(phone: string): void {
  const key = normalizePhoneKey(phone);
  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingTimers.delete(key);
    void processAIReply(key).catch(err => {
      console.error(`[AI-WPP] processAIReply error for ${key}:`, err);
    });
  }, DEBOUNCE_MS);

  pendingTimers.set(key, timer);
}

function normalizePhoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

async function processAIReply(phone: string): Promise<void> {
  const lead = await findLeadByPhone(phone);

  if (lead) {
    await processKnownLeadReply(lead, phone);
  } else {
    await processAnonymousReply(phone);
  }
}

// ─── Known lead flow ──────────────────────────────────────────────────────────

async function processKnownLeadReply(
  lead: {
    id: string; email: string; name: string | null; company: string | null;
    jobTitle: string | null; status: string; score: number; tags: string[];
    phone: string | null; aiHandoff: boolean; aiProcessing: boolean; aiProcessingAt: Date | null;
  },
  phone: string
): Promise<void> {
  if (lead.aiHandoff) return;

  const now = new Date();
  if (lead.aiProcessing && lead.aiProcessingAt) {
    if (now.getTime() - lead.aiProcessingAt.getTime() < LOCK_TTL_MS) return;
  }

  await prisma.lead.update({
    where: { email: lead.email },
    data: { aiProcessing: true, aiProcessingAt: now },
  });

  try {
    await executeAIAndReply({ lead, phone, isAnonymous: false });
  } finally {
    await prisma.lead
      .update({ where: { email: lead.email }, data: { aiProcessing: false, aiProcessingAt: null } })
      .catch(() => {});
  }
}

// ─── Anonymous flow (unknown phone) ──────────────────────────────────────────

async function processAnonymousReply(phone: string): Promise<void> {
  if (anonymousLocks.has(phone)) return;
  anonymousLocks.add(phone);

  try {
    await executeAIAndReply({ lead: null, phone, isAnonymous: true });
  } finally {
    anonymousLocks.delete(phone);
  }
}

// ─── Core AI execution ────────────────────────────────────────────────────────

type ExecuteParams = {
  lead: {
    id: string; email: string; name: string | null; company: string | null;
    jobTitle: string | null; status: string; score: number; tags: string[];
    phone: string | null;
  } | null;
  phone: string;
  isAnonymous: boolean;
};

async function executeAIAndReply({ lead, phone, isAnonymous }: ExecuteParams): Promise<void> {
  const {
    recordOutgoingWhatsAppMessage,
    getWhatsAppCredentials,
  } = await import('./whatsapp.service');

  // Load conversation history by phone
  const messages = await loadMessagesByPhone(phone);
  const transcript = buildTranscript(messages);

  // Load agent config (memory only loaded for known leads)
  const agentContext = await loadAIAgentContext({
    leadEmail: lead?.email,
    channel: 'whatsapp',
    skipMemory: isAnonymous,
  });

  const goal = isAnonymous
    ? `${agentContext.agent.objective}\n\nIMPORTANTE: Este contato ainda não está cadastrado. Durante a conversa, de forma natural, tente descobrir o nome e o e-mail da pessoa para poder cadastrá-la. Quando obtiver o e-mail, inclua a ação register_lead no recommended_actions.`
    : agentContext.agent.objective;

  const result = await runAIPrequalification({
    lead: lead
      ? { email: lead.email, name: lead.name, company: lead.company, jobTitle: lead.jobTitle, status: lead.status as any, score: lead.score, tags: lead.tags }
      : { email: '', name: null, company: null, jobTitle: null, status: 'LEAD' as any, score: 0, tags: [] },
    transcript,
    goal,
    criteria: '',
    provider: agentContext.agent.defaultProvider ?? undefined,
    model: agentContext.agent.defaultModel ?? undefined,
    agentContext,
  });

  // Send text reply
  const replyText = result.replyMessage?.trim();
  if (replyText) {
    await sendWhatsAppText({
      to: phone,
      text: replyText,
      leadEmail: lead?.email ?? null,
      getCredentials: getWhatsAppCredentials,
      recordOutgoing: recordOutgoingWhatsAppMessage,
    });
  }

  // If anonymous, check for register_lead action
  if (isAnonymous) {
    const registerAction = result.recommendedActions?.find(a => a.type === 'register_lead');
    if (registerAction?.payload?.email) {
      const email = String(registerAction.payload.email).trim().toLowerCase();
      const name = registerAction.payload.name ? String(registerAction.payload.name).trim() : null;
      await registerNewLead({ email, name, phone });
      return;
    }
    return; // No persistent memory for anonymous contacts
  }

  // Known lead: apply actions and persist memory
  if (lead) {
    await applyRecommendedActions(lead.email, result.recommendedActions ?? [], result.tags ?? []);
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
}

// ─── Register new lead from anonymous conversation ────────────────────────────

async function registerNewLead(params: { email: string; name: string | null; phone: string }): Promise<void> {
  try {
    const lead = await prisma.lead.upsert({
      where: { email: params.email },
      create: {
        email: params.email,
        name: params.name,
        phone: params.phone,
        tags: ['whatsapp_inbound'],
      },
      update: {
        phone: params.phone,
        ...(params.name ? { name: params.name } : {}),
      },
    });

    // Link all messages from this phone to the new lead
    const phoneSuffix = params.phone.slice(-9);
    await (prisma as any).whatsAppMessage.updateMany({
      where: {
        phone: { endsWith: phoneSuffix },
        leadId: null,
      },
      data: { leadId: lead.id, leadEmail: lead.email },
    });

    console.log(`[AI-WPP] Novo lead registrado via WhatsApp: ${params.email}`);
  } catch (err) {
    console.error('[AI-WPP] Erro ao registrar novo lead:', err);
  }
}

// ─── Phone lookup ─────────────────────────────────────────────────────────────

async function findLeadByPhone(phone: string) {
  const normalized = phone.replace(/\D/g, '');
  const candidates = [normalized, normalized.replace(/^55/, ''), normalized.slice(-11), normalized.slice(-9)]
    .filter((v, i, arr) => v.length >= 8 && arr.indexOf(v) === i);

  for (const value of candidates) {
    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: value } },
      select: {
        id: true, email: true, name: true, company: true, jobTitle: true,
        status: true, score: true, tags: true, phone: true,
        aiHandoff: true, aiProcessing: true, aiProcessingAt: true,
      },
    });
    if (lead) return lead;
  }
  return null;
}

// ─── Load messages by phone ───────────────────────────────────────────────────

async function loadMessagesByPhone(phone: string): Promise<WhatsAppConversationMessage[]> {
  const suffix = phone.replace(/\D/g, '').slice(-9);
  return (prisma as any).whatsAppMessage.findMany({
    where: { phone: { endsWith: suffix } },
    orderBy: { createdAt: 'asc' },
    take: MAX_TRANSCRIPT_MSGS,
  });
}

// ─── Transcript builder ───────────────────────────────────────────────────────

function buildTranscript(messages: WhatsAppConversationMessage[]): string {
  if (messages.length === 0) return '(sem histórico de conversa)';

  return messages
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
  leadEmail: string | null;
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
    console.warn('[AI-WPP] WHATSAPP_PHONE_NUMBER_ID não configurado — resposta não enviada');
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

  if (params.leadEmail) {
    await params.recordOutgoing({
      leadEmail: params.leadEmail,
      phone: toE164,
      messageId,
      text: params.text,
      payload: body,
    });
  }
}

// ─── Action applier ───────────────────────────────────────────────────────────

async function applyRecommendedActions(
  leadEmail: string,
  actions: Array<{ type: string; reason: string; payload?: Record<string, unknown> }>,
  aiTags: string[]
): Promise<void> {
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
    }
  }
}
