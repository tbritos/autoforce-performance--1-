import { prisma } from '../config/database';
import { loadAIAgentContext, persistAIAgentDecision } from './ai-agent-context.service';
import { runAIPrequalification } from './ai-provider.service';
import type { WhatsAppConversationMessage } from './whatsapp.service';
import { normalizePhoneE164, phoneSearchVariants } from '../utils/phone';

const DEBOUNCE_MS = 5_000;
const LOCK_TTL_MS = 120_000;
const MAX_TRANSCRIPT_MSGS = 40;

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function isGeneratedWppEmail(email: string): boolean {
  return email.startsWith('wpp_') && email.endsWith('@autoforce.internal');
}

/**
 * Called for every inbound WhatsApp message.
 * Resets the 5-second debounce window per phone number.
 */
export function scheduleAIReply(phone: string): void {
  const key = normalizePhone(phone);
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

function normalizePhone(phone: string): string {
  return normalizePhoneE164(phone) ?? phone.replace(/\D/g, '');
}

async function processAIReply(phone: string): Promise<void> {
  const lead = await findLeadByPhone(phone);
  if (!lead) return;

  if (lead.aiHandoff) {
    console.log(`[AI-WPP] aiHandoff=true for ${phone} (${lead.email}) — skipping AI reply`);
    return;
  }

  // Acquire DB lock
  const now = new Date();
  if (lead.aiProcessing && lead.aiProcessingAt) {
    if (now.getTime() - lead.aiProcessingAt.getTime() < LOCK_TTL_MS) {
      console.log(`[AI-WPP] aiProcessing lock active for ${phone} — skipping`);
      return;
    }
  }

  await prisma.lead.update({
    where: { email: lead.email },
    data: { aiProcessing: true, aiProcessingAt: now },
  });

  try {
    // If lead is responding to a meeting slot offer, handle it without going through AI
    const messages = await loadMessagesByPhone(phone);
    const lastMsg  = messages.filter(m => m.direction === 'inbound').slice(-1)[0]?.text ?? '';
    if (lead.tags.some(t => t.startsWith('__slots__')) && lastMsg) {
      const handled = await tryHandleMeetingSelection(
        { email: lead.email, name: lead.name, phone: lead.phone, tags: lead.tags },
        phone,
        lastMsg,
      );
      if (handled) return;
    }

    await executeAIAndReply(lead, phone);
  } finally {
    await prisma.lead
      .update({ where: { email: lead.email }, data: { aiProcessing: false, aiProcessingAt: null } })
      .catch(() => {});
  }
}

async function executeAIAndReply(
  lead: {
    id: string; email: string; name: string | null; company: string | null;
    jobTitle: string | null; city: string | null; state: string | null;
    status: string; score: number; isHot: boolean; tags: string[]; notes: string | null;
    phone: string | null; assignedTo: string | null;
    firstSource: string | null; firstMedium: string | null; firstCampaign: string | null; firstLandingPage: string | null;
    customFields: unknown;
    firstSeenAt: Date; lastSeenAt: Date;
  },
  phone: string
): Promise<void> {
  const { recordOutgoingWhatsAppMessage, getWhatsAppCredentials } = await import('./whatsapp.service');

  const isNewContact = isGeneratedWppEmail(lead.email);

  const messages = await loadMessagesByPhone(phone);
  const transcript = buildTranscript(messages);

  // Load custom field definitions to label the values
  const customFieldDefs = await (prisma as any).leadCustomFieldDef.findMany({ select: { name: true, label: true } })
    .catch(() => []) as Array<{ name: string; label: string }>;

  const customFieldsLabeled: Record<string, unknown> = {};
  if (lead.customFields && typeof lead.customFields === 'object') {
    for (const [key, value] of Object.entries(lead.customFields as Record<string, unknown>)) {
      if (value === null || value === undefined || value === '') continue;
      const def = customFieldDefs.find((d: { name: string }) => d.name === key);
      customFieldsLabeled[def?.label ?? key] = value;
    }
  }

  const leadContext = {
    identificacao: {
      email: isNewContact ? null : lead.email,
      nome: lead.name,
      telefone: lead.phone,
      cargo: lead.jobTitle,
      empresa: lead.company,
      cidade: lead.city,
      estado: lead.state,
    },
    qualificacao: {
      status: lead.status,
      score: lead.score,
      lead_quente: lead.isHot,
      tags: lead.tags,
    },
    origem: {
      fonte: lead.firstSource,
      midia: lead.firstMedium,
      campanha: lead.firstCampaign,
      landing_page: lead.firstLandingPage,
    },
    campos_personalizados: Object.keys(customFieldsLabeled).length > 0 ? customFieldsLabeled : null,
    observacoes: lead.notes,
    historico: {
      primeiro_contato: lead.firstSeenAt,
      ultimo_contato: lead.lastSeenAt,
    },
  };

  const agentContext = await loadAIAgentContext({
    leadEmail: isNewContact ? undefined : lead.email,
    channel: 'whatsapp',
    skipMemory: isNewContact,
  });

  const goal = isNewContact
    ? `${agentContext.agent.objective}\n\nIMPORTANTE: Este contato é novo e ainda não tem email cadastrado. Durante a conversa, de forma natural, tente descobrir o nome e o e-mail da pessoa. Quando obtiver o e-mail, inclua a ação register_lead no recommended_actions com os campos email e name.`
    : agentContext.agent.objective;

  const result = await runAIPrequalification({
    lead: leadContext as any,
    transcript,
    goal,
    criteria: '',
    provider: agentContext.agent.defaultProvider ?? undefined,
    model: agentContext.agent.defaultModel ?? undefined,
    agentContext,
  });

  // Send text reply
  if (result.source === 'fallback') {
    console.error('[AI-WPP] AI returned fallback — no reply sent to', phone, '| reason:', (result as { reason?: string }).reason ?? 'unknown');
  }
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

  // If new contact, check if AI discovered the real email
  if (isNewContact) {
    const registerAction = result.recommendedActions?.find(a => a.type === 'register_lead');
    if (registerAction?.payload?.email) {
      const realEmail = String(registerAction.payload.email).trim().toLowerCase();
      const realName = registerAction.payload.name ? String(registerAction.payload.name).trim() : lead.name;
      await upgradeLeadEmail(lead.email, realEmail, realName);
    }
    return;
  }

  // Known lead: apply lead_updates captured by AI (name, jobTitle, company)
  const leadUpdates = result.leadUpdates ?? {};
  const allowedUpdateFields: Record<string, unknown> = {};
  for (const field of ['name', 'jobTitle', 'company'] as const) {
    const val = leadUpdates[field];
    if (val && typeof val === 'string' && val.trim()) {
      allowedUpdateFields[field] = val.trim();
    }
  }
  if (Object.keys(allowedUpdateFields).length > 0) {
    await prisma.lead.update({ where: { email: lead.email }, data: allowedUpdateFields }).catch(() => {});
  }

  // Known lead: apply actions and persist memory
  await applyRecommendedActions(lead.email, phone, result.recommendedActions ?? [], result.tags ?? []);
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

// ─── Upgrade generated email to real email ────────────────────────────────────

async function upgradeLeadEmail(generatedEmail: string, realEmail: string, name: string | null): Promise<void> {
  try {
    const existingReal = await prisma.lead.findUnique({ where: { email: realEmail } });

    if (existingReal) {
      // Real lead already exists — transfer messages and delete the generated one
      const generated = await prisma.lead.findUnique({ where: { email: generatedEmail } });
      if (!generated) return;

      await (prisma as any).whatsAppMessage.updateMany({
        where: { leadId: generated.id },
        data: { leadId: existingReal.id, leadEmail: existingReal.email },
      });

      await prisma.lead.delete({ where: { email: generatedEmail } });
      console.log(`[AI-WPP] Lead ${generatedEmail} merged into existing ${realEmail}`);
    } else {
      // Simply update the email
      await prisma.lead.update({
        where: { email: generatedEmail },
        data: {
          email: realEmail,
          ...(name ? { name } : {}),
        },
      });
      console.log(`[AI-WPP] Lead email upgraded: ${generatedEmail} → ${realEmail}`);
    }
  } catch (err) {
    console.error('[AI-WPP] Erro ao atualizar email do lead:', err);
  }
}

// ─── Phone lookup ─────────────────────────────────────────────────────────────

async function findLeadByPhone(phone: string) {
  const candidates = phoneSearchVariants(phone);
  const selectFields = {
    id: true, email: true, name: true, company: true, jobTitle: true,
    city: true, state: true,
    status: true, score: true, isHot: true, tags: true, notes: true,
    phone: true, assignedTo: true,
    firstSource: true, firstMedium: true, firstCampaign: true, firstLandingPage: true,
    customFields: true,
    firstSeenAt: true, lastSeenAt: true,
    aiHandoff: true, aiProcessing: true, aiProcessingAt: true,
  };

  for (const value of candidates) {
    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: value } },
      select: selectFields,
    });
    if (lead) return lead;
  }

  // Fallback: lookup by generated email
  const digits = phone.replace(/\D/g, '');
  const toE164 = digits.startsWith('55') ? digits : `55${digits}`;
  return prisma.lead.findUnique({
    where: { email: `wpp_${toE164}@autoforce.internal` },
    select: selectFields,
  });
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
  leadEmail: string;
  getCredentials: () => Promise<{ accessToken: string; businessAccountId: string }>;
  recordOutgoing: (input: {
    leadEmail: string | null;
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

  await params.recordOutgoing({
    leadEmail: isGeneratedWppEmail(params.leadEmail) ? null : params.leadEmail,
    phone: toE164,
    messageId,
    text: params.text,
    payload: body,
  });
}

// ─── Meeting scheduler handlers ───────────────────────────────────────────────

async function handleOfferMeetingSlots(leadEmail: string, phone: string): Promise<void> {
  try {
    const { getAvailableSlots } = await import('./meeting-scheduler.service');
    const { recordOutgoingWhatsAppMessage, getWhatsAppCredentials } = await import('./whatsapp.service');

    const slots = await getAvailableSlots();
    if (slots.length === 0) {
      await sendWhatsAppText({
        to: phone,
        text: 'Deixa eu verificar a agenda do nosso time e te passo os horários disponíveis em breve, tudo bem?',
        leadEmail,
        getCredentials: getWhatsAppCredentials,
        recordOutgoing: recordOutgoingWhatsAppMessage,
      });
      return;
    }

    // Store slots in lead tags temporarily as JSON
    const top3 = slots.slice(0, 3);
    await prisma.lead.update({
      where: { email: leadEmail },
      data: { tags: { push: `__slots__${JSON.stringify(top3)}` } },
    });

    const lines = [
      'Ótimo! Tenho esses horários disponíveis para você:\n',
      ...top3.map((s, i) => `*${i + 1}.* ${s.label}`),
      '\nQual funciona melhor pra você? Responda com 1, 2 ou 3.',
    ];

    await sendWhatsAppText({
      to: phone,
      text: lines.join('\n'),
      leadEmail,
      getCredentials: getWhatsAppCredentials,
      recordOutgoing: recordOutgoingWhatsAppMessage,
    });
  } catch (err) {
    console.error('[AI-WPP] Erro ao oferecer slots de reunião:', err);
    // Send fallback so the lead doesn't get silence
    try {
      const { recordOutgoingWhatsAppMessage, getWhatsAppCredentials } = await import('./whatsapp.service');
      await sendWhatsAppText({
        to: phone,
        text: 'Deixa eu verificar a agenda do nosso time e já te passo os próximos horários disponíveis, pode ser?',
        leadEmail,
        getCredentials: getWhatsAppCredentials,
        recordOutgoing: recordOutgoingWhatsAppMessage,
      });
    } catch { /* silencioso */ }
  }
}

async function tryHandleMeetingSelection(
  lead: { email: string; name: string | null; phone: string | null; tags: string[] },
  phone: string,
  lastMessage: string,
): Promise<boolean> {
  const slotTag = lead.tags.find(t => t.startsWith('__slots__'));
  if (!slotTag) return false;

  const choice = lastMessage.trim().replace(/\D/g, '');
  const idx = parseInt(choice, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 2) return false;

  try {
    const slots = JSON.parse(slotTag.replace('__slots__', ''));
    const slot = slots[idx];
    if (!slot) return false;

    const { bookMeeting } = await import('./meeting-scheduler.service');
    const { recordOutgoingWhatsAppMessage, getWhatsAppCredentials } = await import('./whatsapp.service');

    const booked = await bookMeeting(slot, { name: lead.name, email: lead.email, phone: lead.phone });

    // Remove slots tag
    await prisma.lead.update({
      where: { email: lead.email },
      data: { tags: lead.tags.filter(t => !t.startsWith('__slots__')) },
    });

    const confirmMsg = [
      `✅ Reunião confirmada!\n`,
      `📅 ${slot.label}`,
      booked.meetLink ? `🔗 Link: ${booked.meetLink}` : '',
      `\nUm especialista da AutoForce vai estar te esperando. Qualquer dúvida, é só chamar aqui!`,
    ].filter(Boolean).join('\n');

    await sendWhatsAppText({
      to: phone,
      text: confirmMsg,
      leadEmail: lead.email,
      getCredentials: getWhatsAppCredentials,
      recordOutgoing: recordOutgoingWhatsAppMessage,
    });

    return true;
  } catch (err) {
    console.error('[AI-WPP] Erro ao confirmar reunião:', err);
    return false;
  }
}

// ─── Action applier ───────────────────────────────────────────────────────────

async function applyRecommendedActions(
  leadEmail: string,
  phone: string,
  actions: Array<{ type: string; reason: string; payload?: Record<string, unknown> }>,
  _aiTags: string[]
): Promise<void> {
  for (const action of actions) {
    switch (action.type) {
      case 'handoff_to_human':
        await prisma.lead.update({ where: { email: leadEmail }, data: { aiHandoff: true } });
        break;
      case 'offer_meeting_slots':
        await handleOfferMeetingSlots(leadEmail, phone);
        break;
    }
  }
}
