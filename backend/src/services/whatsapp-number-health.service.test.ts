import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeWhatsAppHealthRows, type WhatsAppHealthMessageRow } from './whatsapp-number-health.service';

const now = new Date('2026-08-14T12:00:00.000Z');

function row(id: string, input: Partial<WhatsAppHealthMessageRow> = {}): WhatsAppHealthMessageRow {
  const createdAt = input.createdAt ?? new Date('2026-08-13T12:00:00.000Z');
  return {
    id,
    leadId: null,
    leadEmail: null,
    phone: `55119999999${id}`,
    status: 'sent',
    templateName: 'boas_vindas',
    errorCode: null,
    errorTitle: null,
    errorMessage: null,
    phoneNumberId: 'number-a',
    automationJourneyId: null,
    whatsAppBlastId: null,
    sentAt: createdAt,
    deliveredAt: null,
    readAt: null,
    failedAt: null,
    createdAt,
    ...input,
  };
}

test('saúde do WhatsApp calcula entrega, leitura, falhas e ranking de erros', () => {
  const rows = [
    row('1', { status: 'read', deliveredAt: new Date('2026-08-13T12:01:00Z'), readAt: new Date('2026-08-13T12:02:00Z') }),
    row('2', { status: 'delivered', deliveredAt: new Date('2026-08-13T12:01:00Z') }),
    row('3'),
    row('4', { status: 'failed', sentAt: null, failedAt: new Date('2026-08-13T12:01:00Z'), errorCode: 133010, errorTitle: 'Conta não registrada', errorMessage: 'not registered on WhatsApp' }),
    row('5', { status: 'failed', sentAt: null, failedAt: new Date('2026-08-13T12:02:00Z'), errorCode: 133010, errorTitle: 'Conta não registrada', errorMessage: 'not registered on WhatsApp' }),
    row('6', { status: 'failed', sentAt: null, failedAt: new Date('2026-08-13T12:03:00Z'), errorCode: 130429, errorTitle: 'Limite atingido', errorMessage: 'Rate limit reached', phoneNumberId: 'number-b' }),
    row('old-1', { createdAt: new Date('2026-08-05T12:00:00Z'), status: 'failed', sentAt: null, failedAt: new Date('2026-08-05T12:01:00Z'), errorCode: 130429 }),
    row('old-2', { createdAt: new Date('2026-08-05T13:00:00Z') }),
  ];

  const result = summarizeWhatsAppHealthRows(rows, { now, days: 7, defaultPhoneNumberId: 'number-a' });

  assert.deepEqual(result.metrics, {
    totalTemplates: 6,
    accepted: 3,
    delivered: 2,
    read: 1,
    failed: 3,
    waitingDelivery: 1,
    uniqueRecipients: 6,
    affectedRecipients: 3,
    acceptanceRate: 50,
    deliveryRate: 66.67,
    readRate: 50,
    errorRate: 50,
  });
  assert.equal(result.daily.length, 7);
  assert.equal(result.daily.reduce((total, day) => total + day.total, 0), 6);
  assert.equal(result.errors[0].code, 133010);
  assert.equal(result.errors[0].count, 2);
  assert.equal(result.errors[0].percentage, 66.67);
  assert.equal(result.errors[0].classification, 'permanent');
  assert.equal(result.byNumber.length, 2);
  assert.equal(result.health.level, 'critical');
  assert.equal(result.comparison.errorRateDelta, 0);
});

test('filtro por número incorpora mensagens antigas sem phoneNumberId ao número padrão', () => {
  const rows = [
    row('legacy', { phoneNumberId: null }),
    row('other', { phoneNumberId: 'number-b' }),
  ];

  const result = summarizeWhatsAppHealthRows(rows, {
    now,
    days: 7,
    defaultPhoneNumberId: 'number-a',
    selectedPhoneNumberId: 'number-a',
  });

  assert.equal(result.metrics.totalTemplates, 1);
  assert.equal(result.byNumber[0].phoneNumberId, 'number-a');
});

test('período sem templates retorna situação sem dados e taxas zeradas', () => {
  const result = summarizeWhatsAppHealthRows([], { now, days: 30, defaultPhoneNumberId: null });
  assert.equal(result.health.level, 'no_data');
  assert.equal(result.metrics.errorRate, 0);
  assert.equal(result.daily.length, 30);
});
