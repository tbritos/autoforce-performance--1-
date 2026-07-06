import { prisma } from '../config/database';
import { loadAIAgentContext, persistAIAgentDecision } from './ai-agent-context.service';
import { runAIPrequalification } from './ai-provider.service';
import type { WhatsAppConversationMessage } from './whatsapp.service';
import { normalizePhoneE164, phoneSearchVariants } from '../utils/phone';

const DEBOUNCE_MS = 5_000;
const LOCK_TTL_MS = 120_000;
const MAX_TRANSCRIPT_MSGS = 40;
const DEFAULT_DISCOVERY_REPLY = 'Oi! Tudo bem? Sou a Lara, da AutoForce.\n\nMe conta rapidinho: hoje o maior desafio da sua concessionaria esta em gerar mais leads qualificados ou em converter melhor os leads que ja chegam?';
const DISCOVERY_QUESTION = 'Hoje, qual e o maior gargalo: gerar mais leads qualificados ou converter melhor os leads que ja chegam?';

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

type AIAction = { type: string; reason: string; payload?: Record<string, unknown> };

const STANDARD_LEAD_UPDATE_FIELDS = ['name', 'jobTitle', 'company', 'city', 'state'] as const;

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
  console.log(`[AI-WPP] scheduled reply for ${key}`);

  const timer = setTimeout(() => {
    pendingTimers.delete(key);
    void processAIReply(key).catch(err => {
      console.error(`[AI-WPP] processAIReply error for ${key}:`, err);
    });
  }, DEBOUNCE_MS);

  pendingTimers.set(key, timer);
}

export async function triggerAIReplyNow(phone: string): Promise<void> {
  const key = normalizePhone(phone);
  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);
  pendingTimers.delete(key);
  await processAIReply(key);
}

function normalizePhone(phone: string): string {
  return normalizePhoneE164(phone) ?? phone.replace(/\D/g, '');
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

type RecoveredIntent =
  | 'meeting_request'
  | 'document_request'
  | 'greeting'
  | 'price_question'
  | 'agent_identity_question'
  | 'company_lookup_question'
  | 'company_answer'
  | 'generic';

function detectLeadIntent(message: string): RecoveredIntent {
  const text = normalizeText(message);
  const trimmed = text.trim();
  const isQuestion = message.includes('?') || /\b(qual|quem|como|voce sabe|sabe|me diz|me fala)\b/.test(trimmed);
  if (/\b(qual (e|eh) (o )?seu nome|quem (e|eh) voce|com quem|voce (e|eh) quem|se apresenta)\b/.test(trimmed)) {
    return 'agent_identity_question';
  }
  if (/\b(minha empresa|meu negocio|empresa que eu trabalho|qual (e|eh) minha empresa|sabe.*empresa)\b/.test(trimmed)) {
    return 'company_lookup_question';
  }
  if (/\b(preco|valor|quanto custa|orcamento|mensalidade|custa)\b/.test(text)) return 'price_question';
  // Checado ANTES de meeting_request: um pedido explicito de material/PDF nao deve
  // ser desviado pra oferta de reuniao so porque a conversa mencionou "demo"/"agenda" antes.
  if (/\b(pdf|ebook|e-book|material|documento|arquivo|apostila)\b/.test(text)) return 'document_request';
  if (/\b(reuniao|agenda|agendar|marcar|horario|demo|demonstracao|apresentacao|call)\b/.test(text)) return 'meeting_request';
  if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai|eai)\b/.test(text.trim())) return 'greeting';
  if (!isQuestion && message.trim().split(/\s+/).length <= 4) return 'company_answer';
  return 'generic';
}

function hasAction(actions: AIAction[], type: string): boolean {
  return actions.some(action => action.type === type);
}

function recoverAIReply(input: {
  leadName: string | null;
  company: string | null;
  lastInboundText: string;
  resultActions: AIAction[];
}): { replyText: string; actions: AIAction[]; intent: string } {
  const actions = input.resultActions.map(action => ({ ...action }));
  const intent = detectLeadIntent(input.lastInboundText);
  const name = input.leadName?.trim();
  const company = input.company?.trim();
  const greetingName = name ? `, ${name}` : '';

  if (intent === 'meeting_request') {
    if (!hasAction(actions, 'offer_meeting_slots')) {
      actions.push({
        type: 'offer_meeting_slots',
        reason: 'Lead pediu para marcar uma reuniao pelo WhatsApp.',
      });
    }
    return {
      intent,
      actions,
      replyText: `Perfeito${greetingName}. Vou te mandar a agenda para voce escolher o melhor horario.\n\nPara eu deixar o diagnostico bem direcionado, preencha com seu melhor email quando abrir o link.`,
    };
  }

  if (intent === 'document_request') {
    // Um pedido explicito de material nunca deve virar oferta de reuniao — remove
    // qualquer offer_meeting_slots que a IA (ou este recover) possa ter colocado.
    const withoutMeetingOffer = actions.filter(a => a.type !== 'offer_meeting_slots');
    if (!hasAction(withoutMeetingOffer, 'send_document')) {
      withoutMeetingOffer.push({
        type: 'send_document',
        reason: 'Lead pediu o ebook/material em PDF pelo WhatsApp.',
      });
    }
    return {
      intent,
      actions: withoutMeetingOffer,
      replyText: `Claro${greetingName}! Vou te mandar o material agora mesmo.`,
    };
  }

  if (intent === 'price_question') {
    return {
      intent,
      actions,
      replyText: `Boa pergunta${greetingName}. O valor depende do contexto da operacao, como site atual, volume de leads e ferramentas que voces usam hoje.\n\nPara eu te direcionar melhor: hoje voces querem melhorar mais a geracao de leads ou o atendimento/conversao desses leads?`,
    };
  }

  if (intent === 'agent_identity_question') {
    return {
      intent,
      actions,
      replyText: `Sou a Lara, assistente da AutoForce${greetingName ? `, ${name}` : ''}.\n\nEu te ajudo a entender o melhor caminho para gerar ou converter mais leads na operacao. ${DISCOVERY_QUESTION}`,
    };
  }

  if (intent === 'company_lookup_question') {
    return {
      intent,
      actions,
      replyText: company
        ? `Tenho aqui que a empresa e ${company}. Se estiver errado, me corrige por favor.\n\n${DISCOVERY_QUESTION}`
        : `Ainda nao tenho certeza da sua empresa por aqui.\n\nQual e o nome dela? Assim eu consigo direcionar melhor o diagnostico.`,
    };
  }

  if (intent === 'company_answer') {
    return {
      intent,
      actions,
      replyText: `Perfeito${greetingName}, obrigado.\n\n${company ? `Na ${company},` : 'Hoje,'} qual e o maior gargalo: gerar mais leads qualificados ou converter melhor os leads que ja chegam?`,
    };
  }

  return {
    intent,
    actions,
    replyText: DEFAULT_DISCOVERY_REPLY,
  };
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function toCustomFieldName(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function toCustomFieldLabel(fieldName: string): string {
  return fieldName
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function cleanCustomFieldValue(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const clean = value.map(item => String(item).trim()).filter(Boolean);
    return clean.length > 0 ? clean.join(', ') : undefined;
  }
  return undefined;
}

function buildAINotesBlock(summary: string): string {
  return [`[Resumo IA - WhatsApp]`, summary.trim()].join('\n');
}

function mergeAINotes(existingNotes: string | null, summary?: string): string | undefined {
  if (!summary?.trim()) return undefined;
  const block = buildAINotesBlock(summary);
  if (!existingNotes?.trim()) return block;

  const marker = '[Resumo IA - WhatsApp]';
  const markerIndex = existingNotes.indexOf(marker);
  if (markerIndex >= 0) {
    const before = existingNotes.slice(0, markerIndex).trimEnd();
    return before ? `${before}\n\n${block}` : block;
  }

  return `${existingNotes.trimEnd()}\n\n${block}`;
}

function deriveKnowledgeHints(input: {
  lastInboundText: string;
  transcript: string;
  leadTags: string[];
  firstCampaign: string | null;
  firstLandingPage: string | null;
}): { categories: string[]; tags: string[] } {
  const text = normalizeText([
    input.lastInboundText,
    input.transcript.split('\n').slice(-8).join('\n'),
    input.firstCampaign ?? '',
    input.firstLandingPage ?? '',
    input.leadTags.join(' '),
  ].join(' '));

  const categories = ['regra', 'politica'];
  const tags = ['whatsapp', 'qualificacao'];

  if (/\b(site|seo|pagespeed|landing|pagina|cms|autodromo|dealer|webmotors|wordpress)\b/.test(text)) {
    tags.push('autodromo', 'site', 'seo', 'cms');
    categories.push('produto', 'case', 'objecao');
  }

  if (/\b(crm|atendimento|whatsapp|vendedor|follow|resposta|lead perdido|autopilot|automacao)\b/.test(text)) {
    tags.push('autopilot', 'crm', 'atendimento', 'whatsapp');
    categories.push('produto', 'case', 'objecao');
  }

  if (/\b(midia|trafego|google|meta|anuncio|campanha|ads|roi|nitroads)\b/.test(text)) {
    tags.push('nitroads', 'midia', 'performance', 'ads');
    categories.push('produto', 'case', 'objecao');
  }

  if (/\b(preco|valor|orcamento|mensalidade|contrato|cancelamento|garantia)\b/.test(text)) {
    tags.push('preco', 'comercial', 'contrato');
    categories.push('politica', 'objecao');
  }

  if (/\b(reuniao|agenda|agendar|marcar|horario|demo|demonstracao|apresentacao|call)\b/.test(text)) {
    tags.push('agenda', 'reuniao', 'demo');
    categories.push('regra', 'politica');
  }

  if (/\b(grupo|lojas|unidades|rede|multimarcas)\b/.test(text)) {
    tags.push('grupo_automotivo', 'governanca', 'unidades');
    categories.push('produto', 'case');
  }

  if (/\b(ebook|nao recebi|nao chegou|spam|lixeira|financeiro|boleto|cobranca|nota fiscal|suporte|problema tecnico|contato|falar com alguem|falar com humano)\b/.test(text)) {
    tags.push('suporte', 'contato', 'ebook', 'financeiro');
    categories.push('suporte');
  }

  return {
    categories: uniq(categories),
    tags: uniq(tags),
  };
}

async function processAIReply(phone: string): Promise<void> {
  const lead = await findLeadByPhone(phone);
  if (!lead) {
    console.warn(`[AI-WPP] no lead found for ${phone}; skipping AI reply`);
    return;
  }
  console.log(`[AI-WPP] processing reply for ${phone} lead=${lead.email}`);

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

    try {
      await executeAIAndReply(lead, phone);
      console.log(`[AI-WPP] finished reply flow for ${phone} lead=${lead.email}`);
    } catch (err) {
      console.error(`[AI-WPP] reply flow failed for ${phone} lead=${lead.email}:`, err);
      await sendSystemFallbackReply(phone, lead.email).catch(fallbackErr => {
        console.error(`[AI-WPP] failed to send system fallback to ${phone}:`, fallbackErr);
      });
    }
  } finally {
    await prisma.lead
      .update({ where: { email: lead.email }, data: { aiProcessing: false, aiProcessingAt: null } })
      .catch(() => {});
  }
}

async function sendSystemFallbackReply(phone: string, leadEmail: string): Promise<void> {
  const { recordOutgoingWhatsAppMessage, getWhatsAppCredentials } = await import('./whatsapp.service');
  await sendWhatsAppText({
    to: phone,
    text: DEFAULT_DISCOVERY_REPLY,
    leadEmail,
    getCredentials: getWhatsAppCredentials,
    recordOutgoing: recordOutgoingWhatsAppMessage,
  });
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
  const lastInboundText = messages.filter(m => m.direction === 'inbound').slice(-1)[0]?.text ?? '';
  const knowledgeHints = deriveKnowledgeHints({
    lastInboundText,
    transcript,
    leadTags: lead.tags,
    firstCampaign: lead.firstCampaign,
    firstLandingPage: lead.firstLandingPage,
  });

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
    knowledgeCategories: knowledgeHints.categories,
    knowledgeTags: knowledgeHints.tags,
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
    fallbackModels: agentContext.agent.fallbackModels,
    agentContext,
  });

  const recovered = recoverAIReply({
    leadName: lead.name,
    company: lead.company,
    lastInboundText,
    resultActions: result.recommendedActions ?? [],
  });
  const actionsToApply = recovered.actions;

  // Send text reply
  if (result.source === 'fallback') {
    console.error('[AI-WPP] AI returned fallback; sending safe fallback to', phone, '| reason:', (result as { reason?: string }).reason ?? 'unknown');
  }
  const replyText = result.replyMessage?.trim()
    || recovered.replyText;
  if (!result.replyMessage?.trim()) {
    console.warn(`[AI-WPP] AI returned empty reply for ${phone}; source=${result.source} model=${result.model}; recoveredIntent=${recovered.intent}`);
  }
  const effectiveResult = {
    ...result,
    replyMessage: replyText,
    recommendedActions: actionsToApply,
  };
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
    let actionLeadEmail = lead.email;
    const enrichmentLead = { ...lead, email: actionLeadEmail };
    const registerAction = result.recommendedActions?.find(a => a.type === 'register_lead');
    if (registerAction?.payload?.email) {
      const realEmail = String(registerAction.payload.email).trim().toLowerCase();
      const realName = registerAction.payload.name ? String(registerAction.payload.name).trim() : lead.name;
      await upgradeLeadEmail(lead.email, realEmail, realName);
      actionLeadEmail = realEmail;
      enrichmentLead.email = realEmail;
    }
    await enrichLeadFromAI(enrichmentLead, effectiveResult)
      .catch(err => console.error('[AI-WPP] enrichLeadFromAI for new contact failed:', err));
    const newContactAllowedActions = actionsToApply.filter(action => action.type === 'offer_meeting_slots');
    if (newContactAllowedActions.length > 0) {
      await applyRecommendedActions(actionLeadEmail, phone, newContactAllowedActions, result.tags ?? [])
        .catch(err => console.error('[AI-WPP] applyRecommendedActions for new contact failed:', err));
    }
    return;
  }

  await enrichLeadFromAI(lead, effectiveResult)
    .catch(err => console.error('[AI-WPP] enrichLeadFromAI failed:', err));

  // Known lead: apply actions and persist memory
  await applyRecommendedActions(lead.email, phone, actionsToApply, result.tags ?? [])
    .catch(err => console.error('[AI-WPP] applyRecommendedActions failed:', err));
  await persistAIAgentDecision({
    agentId: agentContext.agent.id,
    leadEmail: lead.email,
    channel: 'whatsapp',
    provider: effectiveResult.source,
    model: effectiveResult.model,
    promptSnapshot: effectiveResult.promptSnapshot ?? {},
    result: effectiveResult,
    lastMessageAt: new Date(),
  }).catch(err => console.error('[AI-WPP] persistAIAgentDecision failed:', err));
}

// ─── Upgrade generated email to real email ────────────────────────────────────

async function enrichLeadFromAI(
  lead: {
    email: string;
    notes: string | null;
    customFields: unknown;
    isHot: boolean;
  },
  result: {
    score: number;
    fit: string;
    pain: string;
    urgency: string;
    summary: string;
    leadUpdates: Record<string, unknown>;
    customFields?: Record<string, unknown>;
    notesSummary?: string;
    isHot?: boolean;
  },
): Promise<void> {
  const currentLead = await prisma.lead.findUnique({
    where: { email: lead.email },
    select: { notes: true, customFields: true, isHot: true },
  });
  if (!currentLead) return;

  const standardUpdates: Record<string, string> = {};
  for (const field of STANDARD_LEAD_UPDATE_FIELDS) {
    const value = result.leadUpdates?.[field];
    if (typeof value === 'string' && value.trim()) {
      standardUpdates[field] = value.trim();
    }
  }

  const customUpdates: Record<string, unknown> = {};
  const customDefs: Array<{ name: string; label: string; fieldType?: string; sourceHint?: string }> = [];
  for (const [rawKey, rawValue] of Object.entries(result.customFields ?? {})) {
    const name = toCustomFieldName(rawKey);
    const value = cleanCustomFieldValue(rawValue);
    if (!name || value === undefined) continue;
    customUpdates[name] = value;
    customDefs.push({
      name,
      label: toCustomFieldLabel(name),
      fieldType: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'text',
      sourceHint: 'ai_whatsapp',
    });
  }

  for (const field of customDefs) {
    await (prisma as any).leadCustomFieldDef.upsert({
      where: { name: field.name },
      update: {},
      create: {
        name: field.name,
        label: field.label,
        fieldType: field.fieldType ?? 'text',
        sourceHint: field.sourceHint ?? 'ai_whatsapp',
      },
    });
  }

  const currentCustomFields = currentLead.customFields && typeof currentLead.customFields === 'object' && !Array.isArray(currentLead.customFields)
    ? currentLead.customFields as Record<string, unknown>
    : {};

  const notesSummary = result.notesSummary?.trim()
    || result.summary?.trim()
    || [
      result.pain ? `Dor: ${result.pain}` : '',
      result.urgency ? `Urgencia: ${result.urgency}` : '',
      result.fit ? `Fit: ${result.fit}` : '',
    ].filter(Boolean).join(' | ');

  const nextNotes = mergeAINotes(currentLead.notes, notesSummary);
  const shouldMarkHot = result.isHot === true
    || result.score >= 70
    || result.fit === 'qualified'
    || Boolean(result.pain && ['alta', 'urgente'].includes(String(result.urgency).toLowerCase()));

  const updateData: Record<string, unknown> = {
    ...standardUpdates,
    ...(Object.keys(customUpdates).length > 0
      ? { customFields: { ...currentCustomFields, ...customUpdates } }
      : {}),
    ...(nextNotes ? { notes: nextNotes } : {}),
    ...(shouldMarkHot && !currentLead.isHot ? { isHot: true } : {}),
  };

  if (Object.keys(updateData).length === 0) return;

  await prisma.lead.update({
    where: { email: lead.email },
    data: updateData as any,
  });
}

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
      console.log(`[AI-WPP] WhatsApp reply sent to ${toE164} messageId=${messageId ?? 'none'}`);
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

const BOOKING_LINK_RESEND_COOLDOWN_HOURS = 6;

async function handleOfferMeetingSlots(leadEmail: string, phone: string): Promise<void> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { email: leadEmail },
      select: { tags: true, email: true },
    });

    const sentTag = lead?.tags.find(t => t.startsWith('__booking_link_sent:'));
    if (sentTag) {
      const sentAt = new Date(sentTag.slice('__booking_link_sent:'.length));
      const hoursSinceSent = (Date.now() - sentAt.getTime()) / (1000 * 60 * 60);
      if (Number.isFinite(hoursSinceSent) && hoursSinceSent < BOOKING_LINK_RESEND_COOLDOWN_HOURS) {
        console.log(`[AI-WPP] Link de agenda ja enviado ha ${hoursSinceSent.toFixed(1)}h para ${leadEmail} — evitando reenvio.`);
        return;
      }
    }

    const { getAppointmentBookingUrl, getAvailableSlots } = await import('./meeting-scheduler.service');
    const { recordOutgoingWhatsAppMessage, getWhatsAppCredentials } = await import('./whatsapp.service');

    const bookingUrl = getAppointmentBookingUrl();
    if (bookingUrl) {
      await prisma.lead.update({
        where: { email: leadEmail },
        data: {
          tags: [
            ...(lead?.tags ?? []).filter(t => !t.startsWith('__booking_link_sent')),
            'link_agendamento_enviado',
            `__booking_link_sent:${new Date().toISOString()}`,
          ],
        },
      });

      await sendWhatsAppText({
        to: phone,
        text: [
          'Perfeito. Para escolher o melhor horario, use este link da agenda:',
          bookingUrl,
          '',
          'Quando abrir, preencha com seu melhor email para eu conseguir localizar e confirmar seu agendamento por aqui.',
        ].join('\n'),
        leadEmail,
        getCredentials: getWhatsAppCredentials,
        recordOutgoing: recordOutgoingWhatsAppMessage,
      });
      return;
    }

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

    // Store slots in lead tags temporarily as JSON (reuses the `lead` fetched above)
    const top3 = slots.slice(0, 3);
    await prisma.lead.update({
      where: { email: leadEmail },
      data: {
        tags: [
          ...(lead?.tags ?? []).filter(t => !t.startsWith('__slots__')),
          `__slots__${JSON.stringify(top3)}`,
        ],
      },
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
    try {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('Horario indisponivel')) {
        const { recordOutgoingWhatsAppMessage, getWhatsAppCredentials } = await import('./whatsapp.service');
        await sendWhatsAppText({
          to: phone,
          text: 'Esse horario acabou de ficar indisponivel. Vou te mandar novas opcoes agora.',
          leadEmail: lead.email,
          getCredentials: getWhatsAppCredentials,
          recordOutgoing: recordOutgoingWhatsAppMessage,
        });
        await handleOfferMeetingSlots(lead.email, phone);
        return true;
      }
    } catch { /* silencioso */ }
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
      case 'send_document':
        await handleSendDocument(leadEmail, phone);
        break;
    }
  }
}

async function handleSendDocument(leadEmail: string, phone: string): Promise<void> {
  try {
    const { sendWhatsAppDocument, getEbookMaquinaDeVendasUrl, EBOOK_MAQUINA_DE_VENDAS } = await import('./whatsapp.service');
    await sendWhatsAppDocument({
      to: phone,
      leadEmail: isGeneratedWppEmail(leadEmail) ? null : leadEmail,
      documentUrl: getEbookMaquinaDeVendasUrl(),
      filename: EBOOK_MAQUINA_DE_VENDAS.filename,
      caption: 'Aqui está o ebook! 📘',
    });
  } catch (err) {
    console.error('[AI-WPP] Erro ao enviar documento:', err);
  }
}
