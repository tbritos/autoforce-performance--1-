import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { getInstagramAppSecret, getInstagramWebhookVerifyToken } from './instagram-env.service';

type JsonRecord = Record<string, unknown>;

export interface NormalizedInstagramWebhookEvent {
  eventKey: string;
  objectType: string;
  eventType: string;
  accountId: string | null;
  senderId: string | null;
  recipientId: string | null;
  messageId: string | null;
  occurredAt: Date | null;
  payload: JsonRecord;
}

export interface NormalizedInstagramMessage {
  messageId: string;
  accountId: string;
  senderId: string;
  recipientId: string;
  direction: 'inbound' | 'outbound';
  type: string;
  text: string | null;
  occurredAt: Date | null;
  payload: JsonRecord;
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function metaTime(value: unknown): Date | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  // Instagram messaging timestamps are milliseconds; change events may use seconds.
  return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
}

function hash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function messagingType(event: JsonRecord): string {
  if (asRecord(event.message)) return 'message';
  if (asRecord(event.postback)) return 'messaging_postbacks';
  if (asRecord(event.reaction)) return 'message_reactions';
  if (asRecord(event.read)) return 'messaging_seen';
  if (asRecord(event.referral)) return 'messaging_referrals';
  if (asRecord(event.optin)) return 'messaging_optins';
  return 'messaging';
}

function messageType(message: JsonRecord): string {
  if (typeof message.text === 'string') return 'text';
  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    const first = asRecord(message.attachments[0]);
    return asString(first?.type) || 'attachment';
  }
  if (message.is_unsupported === true) return 'unsupported';
  return 'message';
}

function normalizeMessagingEvent(
  objectType: string,
  accountId: string,
  event: JsonRecord,
): { event: NormalizedInstagramWebhookEvent; message: NormalizedInstagramMessage | null } {
  const senderId = asString(asRecord(event.sender)?.id);
  const recipientId = asString(asRecord(event.recipient)?.id);
  const message = asRecord(event.message);
  const messageId = asString(message?.mid) || asString(asRecord(event.postback)?.mid);
  const eventType = messagingType(event);
  const occurredAt = metaTime(event.timestamp);
  const stableIdentity = messageId || `${senderId || ''}:${recipientId || ''}:${asString(event.timestamp) || ''}:${hash(event)}`;

  const normalizedEvent: NormalizedInstagramWebhookEvent = {
    eventKey: `${eventType}:${stableIdentity}`,
    objectType,
    eventType,
    accountId: accountId || null,
    senderId,
    recipientId,
    messageId,
    occurredAt,
    payload: event,
  };

  if (!message || !messageId || !senderId || !recipientId || !accountId) {
    return { event: normalizedEvent, message: null };
  }

  return {
    event: normalizedEvent,
    message: {
      messageId,
      accountId,
      senderId,
      recipientId,
      direction: senderId === accountId || message.is_echo === true ? 'outbound' : 'inbound',
      type: messageType(message),
      text: asString(message.text),
      occurredAt,
      payload: event,
    },
  };
}

export function normalizeInstagramWebhook(payload: unknown): {
  events: NormalizedInstagramWebhookEvent[];
  messages: NormalizedInstagramMessage[];
} {
  const root = asRecord(payload);
  if (!root) return { events: [], messages: [] };

  const objectType = asString(root.object) || 'instagram';
  const events: NormalizedInstagramWebhookEvent[] = [];
  const messages: NormalizedInstagramMessage[] = [];

  for (const rawEntry of Array.isArray(root.entry) ? root.entry : []) {
    const entry = asRecord(rawEntry);
    if (!entry) continue;
    const accountId = asString(entry.id) || '';

    for (const rawMessaging of Array.isArray(entry.messaging) ? entry.messaging : []) {
      const messaging = asRecord(rawMessaging);
      if (!messaging) continue;
      const normalized = normalizeMessagingEvent(objectType, accountId, messaging);
      events.push(normalized.event);
      if (normalized.message) messages.push(normalized.message);
    }

    for (const rawChange of Array.isArray(entry.changes) ? entry.changes : []) {
      const change = asRecord(rawChange);
      if (!change) continue;
      const field = asString(change.field) || 'change';
      const value = asRecord(change.value) || {};
      const externalId = asString(value.id)
        || asString(value.comment_id)
        || asString(value.message_id)
        || hash(change);
      events.push({
        eventKey: `${field}:${accountId}:${externalId}`,
        objectType,
        eventType: field,
        accountId: accountId || null,
        senderId: asString(value.from) || asString(asRecord(value.from)?.id),
        recipientId: accountId || null,
        messageId: asString(value.message_id),
        occurredAt: metaTime(value.timestamp) || metaTime(entry.time),
        payload: change,
      });
    }
  }

  const uniqueEvents = Array.from(new Map(events.map(event => [event.eventKey, event])).values());
  const uniqueMessages = Array.from(new Map(messages.map(message => [message.messageId, message])).values());
  return { events: uniqueEvents, messages: uniqueMessages };
}

export function verifyInstagramWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = getInstagramAppSecret();
  if (!secret || !signatureHeader?.startsWith('sha256=')) return false;

  const receivedHex = signatureHeader.slice('sha256='.length);
  if (!/^[a-f0-9]{64}$/i.test(receivedHex)) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(receivedHex, 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function verifyInstagramWebhookToken(received: unknown): boolean {
  const expected = getInstagramWebhookVerifyToken();
  if (typeof received !== 'string' || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function handleInstagramWebhook(payload: unknown): Promise<{
  received: number;
  inserted: number;
  messages: number;
}> {
  const normalized = normalizeInstagramWebhook(payload);
  if (normalized.events.length === 0) return { received: 0, inserted: 0, messages: 0 };

  const insertedEvents = await prisma.instagramWebhookEvent.createMany({
    data: normalized.events.map(event => ({
      eventKey: event.eventKey,
      objectType: event.objectType,
      eventType: event.eventType,
      accountId: event.accountId,
      senderId: event.senderId,
      recipientId: event.recipientId,
      messageId: event.messageId,
      occurredAt: event.occurredAt,
      payload: event.payload as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });

  const insertedMessages = normalized.messages.length > 0
    ? await prisma.instagramMessage.createMany({
      data: normalized.messages.map(message => ({
        messageId: message.messageId,
        accountId: message.accountId,
        senderId: message.senderId,
        recipientId: message.recipientId,
        direction: message.direction,
        type: message.type,
        status: message.direction === 'inbound' ? 'received' : 'sent',
        text: message.text,
        occurredAt: message.occurredAt,
        payload: message.payload as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    })
    : { count: 0 };

  return {
    received: normalized.events.length,
    inserted: insertedEvents.count,
    messages: insertedMessages.count,
  };
}

export async function getInstagramWebhookStatus(): Promise<{
  eventCount: number;
  messageCount: number;
  lastEvent: { type: string; receivedAt: Date } | null;
  lastMessage: { direction: string; type: string; receivedAt: Date } | null;
  subscription: {
    status: string;
    fields: string[];
    subscribedAt: string | null;
    error: string | null;
  };
}> {
  const [eventCount, messageCount, lastEvent, lastMessage, connection] = await Promise.all([
    prisma.instagramWebhookEvent.count(),
    prisma.instagramMessage.count(),
    prisma.instagramWebhookEvent.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { eventType: true, createdAt: true },
    }),
    prisma.instagramMessage.findFirst({
      orderBy: { receivedAt: 'desc' },
      select: { direction: true, type: true, receivedAt: true },
    }),
    prisma.platformConnection.findUnique({
      where: { platform: 'INSTAGRAM' },
      select: { metadata: true },
    }),
  ]);

  const metadata = connection?.metadata
    && typeof connection.metadata === 'object'
    && !Array.isArray(connection.metadata)
    ? connection.metadata as JsonRecord
    : {};
  const fields = Array.isArray(metadata.webhookFields)
    ? metadata.webhookFields.filter((field): field is string => typeof field === 'string')
    : [];

  return {
    eventCount,
    messageCount,
    lastEvent: lastEvent
      ? { type: lastEvent.eventType, receivedAt: lastEvent.createdAt }
      : null,
    lastMessage,
    subscription: {
      status: asString(metadata.webhookSubscription) || 'not_started',
      fields,
      subscribedAt: asString(metadata.webhookSubscribedAt),
      error: asString(metadata.webhookSubscriptionError),
    },
  };
}
