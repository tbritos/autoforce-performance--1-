import { PlatformConnectionService } from './platform-connection.service';
import { Platform } from '@prisma/client';
import { prisma } from '../config/database';
import { normalizePhoneE164, phoneSearchVariants } from '../utils/phone';

export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: string;
  text?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: WhatsAppTemplateComponent[];
}

async function getWhatsAppCredentials(): Promise<{ accessToken: string; businessAccountId: string }> {
  const envToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const envAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  if (envToken && envAccountId) {
    return { accessToken: envToken, businessAccountId: envAccountId };
  }

  const conn = await PlatformConnectionService.getInternalConnection('WHATSAPP' as Platform);
  const accessToken = conn?.accessToken?.trim();
  const meta = (conn?.metadata ?? {}) as Record<string, unknown>;
  const businessAccountId = (meta.businessAccountId as string | undefined)?.trim();

  if (!accessToken || !businessAccountId) {
    throw new Error('WhatsApp não configurado. Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID no Railway.');
  }

  return { accessToken, businessAccountId };
}

// FIX: Meta Graph API IDs are always numeric — validate to prevent path injection
function validateGraphId(id: string, fieldName: string): void {
  if (!/^\d+$/.test(id)) {
    throw new Error(`${fieldName} inválido: deve ser numérico (ex: 123456789012345)`);
  }
}

async function metaGet<T>(url: string, accessToken: string): Promise<T> {
  // FIX: token in Authorization header, NOT in URL query string
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as T & { error?: { message: string } };
  if ((data as { error?: { message: string } }).error) {
    throw new Error((data as { error: { message: string } }).error.message);
  }
  return data;
}

export interface WhatsAppPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
}

export interface WhatsAppConversationMessage {
  id: string;
  leadId: string | null;
  leadEmail: string | null;
  phone: string;
  direction: string;
  type: string;
  status: string;
  messageId: string | null;
  repliedToMessageId: string | null;
  automationJourneyId: string | null;
  automationExecutionId: string | null;
  templateName: string | null;
  text: string | null;
  payload: unknown;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  receivedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
}

function normalizePhone(phone: string | null | undefined): string {
  return normalizePhoneE164(String(phone ?? '')) ?? String(phone ?? '').replace(/\D/g, '');
}

function metaTimestamp(seconds: string | number | undefined): Date {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date();
}

async function findLeadByPhone(phone: string) {
  const candidates = phoneSearchVariants(phone);

  for (const value of candidates) {
    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: value } },
      select: { id: true, email: true, phone: true, name: true },
    });
    if (lead) return lead;
  }

  return null;
}

export async function fetchWhatsAppPhoneNumbers(): Promise<WhatsAppPhoneNumber[]> {
  const { accessToken, businessAccountId } = await getWhatsAppCredentials();

  const url = `https://graph.facebook.com/v19.0/${businessAccountId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`;
  const data = await metaGet<{ data?: WhatsAppPhoneNumber[] }>(url, accessToken);
  return data.data ?? [];
}

// Fetch templates — if phoneNumberId is provided, find its WABA first so we get
// templates scoped to that specific number's Business Account.
export async function fetchWhatsAppTemplates(phoneNumberId?: string): Promise<WhatsAppTemplate[]> {
  const { accessToken, businessAccountId } = await getWhatsAppCredentials();

  let wabaId = businessAccountId;

  if (phoneNumberId) {
    // FIX: validate before using in URL path
    validateGraphId(phoneNumberId, 'phoneNumberId');

    try {
      const infoUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=whatsapp_business_account`;
      const info = await metaGet<{ whatsapp_business_account?: { id: string } }>(infoUrl, accessToken);
      if (info.whatsapp_business_account?.id) {
        wabaId = info.whatsapp_business_account.id;
      }
    } catch {
      // Fall back to default WABA
    }
  }

  const url = `https://graph.facebook.com/v19.0/${wabaId}/message_templates?limit=100&fields=id,name,status,category,language,components`;
  const data = await metaGet<{ data?: WhatsAppTemplate[] }>(url, accessToken);
  return data.data ?? [];
}

export async function listWhatsAppConversationByLead(leadId: string): Promise<WhatsAppConversationMessage[]> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, email: true, phone: true },
  });
  if (!lead) throw new Error('Lead não encontrado');

  const where: Record<string, unknown>[] = [{ leadId: lead.id }, { leadEmail: lead.email }];

  if (lead.phone) {
    const variants = phoneSearchVariants(lead.phone);
    variants.forEach(v => where.push({ phone: { endsWith: v } }));
  }

  return (prisma as any).whatsAppMessage.findMany({
    where: { OR: where },
    orderBy: [{ createdAt: 'asc' }],
    take: 300,
  });
}

export async function recordOutgoingWhatsAppMessage(input: {
  leadEmail: string | null;
  phone: string;
  messageId?: string | null;
  templateName?: string | null;
  text?: string | null;
  payload?: unknown;
  automationJourneyId?: string | null;
  automationExecutionId?: string | null;
}): Promise<void> {
  const lead = input.leadEmail
    ? await prisma.lead.findUnique({ where: { email: input.leadEmail }, select: { id: true, email: true } })
    : null;

  const data = {
    leadId: lead?.id ?? null,
    leadEmail: lead?.email ?? input.leadEmail ?? null,
    phone: normalizePhone(input.phone),
    direction: 'outbound',
    type: input.templateName ? 'template' : 'text',
    status: 'sent',
    messageId: input.messageId ?? null,
    templateName: input.templateName ?? null,
    text: input.text ?? null,
    payload: input.payload ?? {},
    automationJourneyId: input.automationJourneyId ?? null,
    automationExecutionId: input.automationExecutionId ?? null,
    sentAt: new Date(),
  };

  if (data.messageId) {
    await (prisma as any).whatsAppMessage.upsert({
      where: { messageId: data.messageId },
      create: data,
      update: data,
    });
    return;
  }

  await (prisma as any).whatsAppMessage.create({ data });
}

function extractInboundText(message: any): { type: string; text: string | null } {
  if (message.type === 'text') return { type: 'text', text: message.text?.body ?? null };
  if (message.type === 'button') return { type: 'button', text: message.button?.text ?? message.button?.payload ?? null };
  if (message.type === 'interactive') {
    return {
      type: 'interactive',
      text: message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? null,
    };
  }
  return { type: String(message.type ?? 'unknown'), text: null };
}

async function recordInboundMessage(message: any, senderName?: string | null): Promise<void> {
  const from = normalizePhone(message.from);
  if (!from) return;

  let lead = await findLeadByPhone(from);

  // Auto-create a placeholder lead for unknown numbers
  if (!lead) {
    const toE164 = from.startsWith('55') ? from : `55${from}`;
    const generatedEmail = `wpp_${toE164}@autoforce.internal`;
    lead = await prisma.lead.upsert({
      where: { email: generatedEmail },
      create: {
        email: generatedEmail,
        phone: toE164,
        name: senderName ?? null,
        tags: ['whatsapp_inbound'],
      },
      update: {
        // Fill in name if it was missing and now we have it
        ...(senderName ? { name: senderName } : {}),
      },
      select: { id: true, email: true, phone: true, name: true },
    });
  } else if (senderName && !lead.name) {
    // Update name on existing lead if it was blank
    await prisma.lead.update({
      where: { id: lead.id },
      data: { name: senderName },
    });
  }

  if (!lead) return;

  const { type, text } = extractInboundText(message);
  const receivedAt = metaTimestamp(message.timestamp);

  await (prisma as any).whatsAppMessage.upsert({
    where: { messageId: String(message.id) },
    create: {
      leadId: lead.id,
      leadEmail: lead.email,
      phone: from,
      direction: 'inbound',
      type,
      status: 'received',
      messageId: String(message.id),
      repliedToMessageId: message.context?.id ?? null,
      text,
      payload: message,
      receivedAt,
      createdAt: receivedAt,
    },
    update: {
      leadId: lead.id,
      leadEmail: lead.email,
      phone: from,
      direction: 'inbound',
      type,
      status: 'received',
      repliedToMessageId: message.context?.id ?? null,
      text,
      payload: message,
      receivedAt,
    },
  });

  const { scheduleAIReply } = await import('./ai-whatsapp-reply.service');
  scheduleAIReply(from);
  console.log(`[WPP] inbound message recorded; AI reply scheduled phone=${from} lead=${lead.email} type=${type}`);

  try {
    const { resumeWaitingWhatsAppReply } = await import('./automation-engine.service');
    await resumeWaitingWhatsAppReply(lead.email, text ?? '', 'replied');
  } catch (err) {
    console.error('[WPP] waiting automation resume failed after inbound message:', err);
  }
}

async function recordStatus(status: any): Promise<void> {
  const messageId = String(status.id ?? '');
  if (!messageId) return;

  const state = String(status.status ?? 'sent');
  const at = metaTimestamp(status.timestamp);
  const data: Record<string, unknown> = {
    status: state,
    payload: status,
  };
  if (state === 'sent') data.sentAt = at;
  if (state === 'delivered') data.deliveredAt = at;
  if (state === 'read') data.readAt = at;
  if (state === 'failed') data.failedAt = at;

  const updated = await (prisma as any).whatsAppMessage.updateMany({
    where: { messageId },
    data,
  });

  if (updated.count === 0) {
    await (prisma as any).whatsAppMessage.create({
      data: {
        phone: normalizePhone(status.recipient_id),
        direction: 'outbound',
        type: 'status',
        status: state,
        messageId,
        payload: status,
        ...data,
      },
    });
  }

  if (state === 'failed') {
    const lead = await findLeadByPhone(String(status.recipient_id ?? ''));
    if (lead?.email) {
      const { resumeWaitingWhatsAppReply } = await import('./automation-engine.service');
      await resumeWaitingWhatsAppReply(lead.email, 'failed', 'failed');
    }
  }
}

export async function handleWhatsAppWebhook(payload: any): Promise<{ messages: number; statuses: number }> {
  let messages = 0;
  let statuses = 0;

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};

      // Build wa_id → display name map from contacts array
      const nameByPhone: Record<string, string> = {};
      for (const contact of value.contacts ?? []) {
        const waId = contact?.wa_id as string | undefined;
        const name = contact?.profile?.name as string | undefined;
        if (waId && name) nameByPhone[waId] = name;
      }

      for (const message of value.messages ?? []) {
        const senderName = nameByPhone[message.from] ?? null;
        await recordInboundMessage(message, senderName);
        messages += 1;
      }
      for (const status of value.statuses ?? []) {
        await recordStatus(status);
        statuses += 1;
      }
    }
  }

  return { messages, statuses };
}

export async function sendWhatsAppTextFromUI(leadId: string, text: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, email: true, phone: true },
  });
  if (!lead) throw new Error('Lead não encontrado');
  if (!lead.phone) throw new Error('Lead sem telefone cadastrado');

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID não configurado');

  const { accessToken } = await getWhatsAppCredentials();
  const phone = normalizePhone(lead.phone);

  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: text.trim().slice(0, 4096) },
  };

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { messages?: Array<{ id?: string }>; error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `WhatsApp API error ${res.status}`);
  }

  const isGenerated = lead.email.startsWith('wpp_') && lead.email.endsWith('@autoforce.internal');
  await recordOutgoingWhatsAppMessage({
    leadEmail: isGenerated ? null : lead.email,
    phone,
    messageId: data.messages?.[0]?.id ?? null,
    text,
    payload: body,
  });
}

export async function sendWhatsAppTemplateFromUI(
  leadId: string,
  templateName: string,
  bodyParams: string[] = []
): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, email: true, phone: true },
  });
  if (!lead) throw new Error('Lead não encontrado');
  if (!lead.phone) throw new Error('Lead sem telefone cadastrado');

  const templates = await fetchWhatsAppTemplates();
  const template = templates.find(t => t.name === templateName);
  if (!template) throw new Error(`Template "${templateName}" não encontrado`);

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID não configurado');

  const { accessToken } = await getWhatsAppCredentials();
  const phone = normalizePhone(lead.phone);

  const params = bodyParams.map(value => ({ type: 'text', text: value }));
  const templatePayload: Record<string, unknown> = {
    name: template.name,
    language: { code: template.language },
  };
  if (params.length > 0) {
    templatePayload.components = [{ type: 'body', parameters: params }];
  }

  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: templatePayload,
  };

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { messages?: Array<{ id?: string }>; error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `WhatsApp API error ${res.status}`);
  }

  const bodyComponent = template.components.find(c => c.type === 'BODY');
  const resolvedText = bodyComponent?.text
    ? bodyComponent.text.replace(/\{\{(\d+)\}\}/g, (_match, idx) => bodyParams[Number(idx) - 1] ?? `{{${idx}}}`)
    : null;

  const isGenerated = lead.email.startsWith('wpp_') && lead.email.endsWith('@autoforce.internal');
  await recordOutgoingWhatsAppMessage({
    leadEmail: isGenerated ? null : lead.email,
    phone,
    messageId: data.messages?.[0]?.id ?? null,
    templateName: template.name,
    text: resolvedText,
    payload: body,
  });
}

export const EBOOK_MAQUINA_DE_VENDAS = {
  filename: 'Como Construir uma Maquina de Vendas Automotiva.pdf',
  path: '/ebook-maquina-de-vendas-automotiva.pdf',
};

export function getEbookMaquinaDeVendasUrl(): string {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
  return `${frontendUrl}${EBOOK_MAQUINA_DE_VENDAS.path}`;
}

export async function sendWhatsAppDocument(input: {
  to: string;
  leadEmail: string | null;
  documentUrl: string;
  filename: string;
  caption?: string;
}): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!phoneNumberId) throw new Error('WHATSAPP_PHONE_NUMBER_ID não configurado');

  const { accessToken } = await getWhatsAppCredentials();
  const phone = normalizePhone(input.to);

  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'document',
    document: {
      link: input.documentUrl,
      filename: input.filename,
      ...(input.caption ? { caption: input.caption } : {}),
    },
  };

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { messages?: Array<{ id?: string }>; error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `WhatsApp API error ${res.status}`);
  }

  await recordOutgoingWhatsAppMessage({
    leadEmail: input.leadEmail,
    phone,
    messageId: data.messages?.[0]?.id ?? null,
    text: input.caption ?? `📄 ${input.filename}`,
    payload: body,
  });
}

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'PHONE_NUMBER' | 'URL';
  text: string;
  phone_number?: string;
  url?: string;
}

export interface CreateTemplateInput {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons?: TemplateButton[];
}

function extractVarCount(text: string): number {
  const matches = text.match(/\{\{\d+\}\}/g) ?? [];
  return new Set(matches.map(m => m.replace(/\D/g, ''))).size;
}

export async function createWhatsAppTemplate(input: CreateTemplateInput): Promise<{ id: string; status: string }> {
  const { accessToken, businessAccountId } = await getWhatsAppCredentials();

  const components: Record<string, unknown>[] = [];

  if (input.headerText?.trim()) {
    const headerVars = extractVarCount(input.headerText);
    const headerComp: Record<string, unknown> = { type: 'HEADER', format: 'TEXT', text: input.headerText.trim() };
    if (headerVars > 0) {
      headerComp.example = { header_text: [Array.from({ length: headerVars }, (_, i) => `Exemplo ${i + 1}`)] };
    }
    components.push(headerComp);
  }

  const bodyVars = extractVarCount(input.bodyText);
  const bodyComp: Record<string, unknown> = { type: 'BODY', text: input.bodyText.trim() };
  if (bodyVars > 0) {
    bodyComp.example = { body_text: [Array.from({ length: bodyVars }, (_, i) => `Exemplo ${i + 1}`)] };
  }
  components.push(bodyComp);

  if (input.footerText?.trim()) {
    components.push({ type: 'FOOTER', text: input.footerText.trim() });
  }

  if (input.buttons && input.buttons.length > 0) {
    const buttons = input.buttons.slice(0, 3).map(btn => {
      const b: Record<string, unknown> = { type: btn.type, text: btn.text.trim() };
      if (btn.type === 'PHONE_NUMBER' && btn.phone_number) b.phone_number = btn.phone_number.trim();
      if (btn.type === 'URL' && btn.url) {
        b.url = btn.url.trim();
        // If URL contains {{1}}, provide example
        if (btn.url.includes('{{1}}')) b.example = ['pagina'];
      }
      return b;
    });
    components.push({ type: 'BUTTONS', buttons });
  }

  const res = await fetch(`https://graph.facebook.com/v19.0/${businessAccountId}/message_templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: input.name,
      language: input.language,
      category: input.category,
      components,
    }),
  });

  const data = await res.json() as { id?: string; status?: string; error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Meta API error ${res.status}`);
  }
  return { id: data.id ?? '', status: data.status ?? 'PENDING' };
}

export async function deleteWhatsAppTemplate(templateName: string): Promise<void> {
  const { accessToken, businessAccountId } = await getWhatsAppCredentials();

  const url = `https://graph.facebook.com/v19.0/${businessAccountId}/message_templates?name=${encodeURIComponent(templateName)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const data = await res.json() as { error?: { message: string } };
    throw new Error(data.error?.message ?? `Meta API error ${res.status}`);
  }
}

export async function setLeadAiHandoff(leadId: string, handoff: boolean): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) throw new Error('Lead não encontrado');
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      aiHandoff: handoff,
      // When re-enabling IA mode, clear any stuck processing lock
      ...(handoff === false ? { aiProcessing: false, aiProcessingAt: null } : {}),
    },
  });
}

export { getWhatsAppCredentials };
