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
      select: { id: true, email: true, phone: true },
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
  return (data.data ?? []).filter(t => t.status === 'APPROVED');
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

async function recordInboundMessage(message: any): Promise<void> {
  const from = normalizePhone(message.from);
  if (!from) return;

  let lead = await findLeadByPhone(from);

  // Auto-create a placeholder lead for unknown numbers
  if (!lead) {
    const toE164 = from.startsWith('55') ? from : `55${from}`;
    const generatedEmail = `wpp_${toE164}@autoforce.internal`;
    lead = await prisma.lead.upsert({
      where: { email: generatedEmail },
      create: { email: generatedEmail, phone: toE164, tags: ['whatsapp_inbound'] },
      update: {},
      select: { id: true, email: true, phone: true },
    });
  }

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

  const { resumeWaitingWhatsAppReply } = await import('./automation-engine.service');
  await resumeWaitingWhatsAppReply(lead.email, text ?? '', 'replied');

  const { scheduleAIReply } = await import('./ai-whatsapp-reply.service');
  scheduleAIReply(from);
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
      for (const message of value.messages ?? []) {
        await recordInboundMessage(message);
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

export async function setLeadAiHandoff(leadId: string, handoff: boolean): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) throw new Error('Lead não encontrado');
  await prisma.lead.update({ where: { id: leadId }, data: { aiHandoff: handoff } });
}

export { getWhatsAppCredentials };
