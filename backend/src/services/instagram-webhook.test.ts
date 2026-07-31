import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  normalizeInstagramWebhook,
  verifyInstagramWebhookSignature,
  verifyInstagramWebhookToken,
} from './instagram-webhook.service';

function withInstagramWebhookEnv<T>(run: () => T): T {
  const names = [
    'INSTAGRAM_APP_SECRET',
    'Instagram_App_Secret',
    'INSTAGRAM_WEBHOOK_VERIFY_TOKEN',
    'Instagram_Webhook_Verify_Token',
  ] as const;
  const previous = new Map(names.map(name => [name, process.env[name]]));
  delete process.env.INSTAGRAM_APP_SECRET;
  delete process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  process.env.Instagram_App_Secret = 'segredo-instagram-teste';
  process.env.Instagram_Webhook_Verify_Token = 'token-verificacao-teste';
  try {
    return run();
  } finally {
    for (const name of names) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function incomingMessage(messageOverrides: Record<string, unknown> = {}) {
  return {
    object: 'instagram',
    entry: [{
      id: 'conta-autoforce',
      time: 1_720_000_000,
      messaging: [{
        sender: { id: 'lead-123' },
        recipient: { id: 'conta-autoforce' },
        timestamp: 1_720_000_000_123,
        message: {
          mid: 'mid.123',
          text: 'Olá, quero conhecer a AutoForce',
          ...messageOverrides,
        },
      }],
    }],
  };
}

test('webhook do Instagram aceita somente a assinatura HMAC correta', () => {
  withInstagramWebhookEnv(() => {
    const rawBody = Buffer.from(JSON.stringify(incomingMessage()));
    const signature = crypto
      .createHmac('sha256', 'segredo-instagram-teste')
      .update(rawBody)
      .digest('hex');

    assert.equal(verifyInstagramWebhookSignature(rawBody, `sha256=${signature}`), true);
    assert.equal(verifyInstagramWebhookSignature(rawBody, `sha256=${'0'.repeat(64)}`), false);
    assert.equal(verifyInstagramWebhookSignature(rawBody, undefined), false);
  });
});

test('verificacao inicial da Meta aceita o alias de token usado no Railway', () => {
  withInstagramWebhookEnv(() => {
    assert.equal(verifyInstagramWebhookToken('token-verificacao-teste'), true);
    assert.equal(verifyInstagramWebhookToken('token-incorreto'), false);
    assert.equal(verifyInstagramWebhookToken(undefined), false);
  });
});

test('mensagem recebida e normalizada para a caixa de entrada do AutoChat', () => {
  const normalized = normalizeInstagramWebhook(incomingMessage());

  assert.equal(normalized.events.length, 1);
  assert.equal(normalized.events[0].eventKey, 'message:mid.123');
  assert.equal(normalized.events[0].eventType, 'message');
  assert.equal(normalized.messages.length, 1);
  assert.deepEqual(normalized.messages[0], {
    messageId: 'mid.123',
    accountId: 'conta-autoforce',
    senderId: 'lead-123',
    recipientId: 'conta-autoforce',
    direction: 'inbound',
    type: 'text',
    text: 'Olá, quero conhecer a AutoForce',
    occurredAt: new Date(1_720_000_000_123),
    payload: incomingMessage().entry[0].messaging[0],
  });
});

test('reentrega da Meta nao duplica evento nem mensagem no mesmo payload', () => {
  const first = incomingMessage().entry[0].messaging[0];
  const payload = incomingMessage();
  payload.entry[0].messaging.push(structuredClone(first));

  const normalized = normalizeInstagramWebhook(payload);
  assert.equal(normalized.events.length, 1);
  assert.equal(normalized.messages.length, 1);
});

test('eco de mensagem enviada pela conta e identificado como outbound', () => {
  const payload = incomingMessage({ is_echo: true });
  payload.entry[0].messaging[0].sender.id = 'conta-autoforce';
  payload.entry[0].messaging[0].recipient.id = 'lead-123';

  const normalized = normalizeInstagramWebhook(payload);
  assert.equal(normalized.messages[0].direction, 'outbound');
  assert.equal(normalized.messages[0].type, 'text');
});

test('mudanca de comentario recebe uma chave idempotente estavel', () => {
  const payload = {
    object: 'instagram',
    entry: [{
      id: 'conta-autoforce',
      time: 1_720_000_000,
      changes: [{
        field: 'comments',
        value: {
          id: 'comentario-456',
          from: { id: 'lead-123', username: 'lead' },
          text: 'Tenho interesse',
          timestamp: 1_720_000_001,
        },
      }],
    }],
  };

  const first = normalizeInstagramWebhook(payload);
  const second = normalizeInstagramWebhook(structuredClone(payload));
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].eventKey, 'comments:conta-autoforce:comentario-456');
  assert.equal(first.events[0].eventKey, second.events[0].eventKey);
  assert.equal(first.events[0].senderId, 'lead-123');
  assert.equal(first.events[0].occurredAt?.toISOString(), '2024-07-03T09:46:41.000Z');
});
