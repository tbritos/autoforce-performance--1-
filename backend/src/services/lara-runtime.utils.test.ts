import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampAIScore,
  countSentFollowUp,
  fetchWithAIRequestTimeout,
  isHumanHandoffStage,
  kanbanCardQueryLimit,
  resolveAIRequestTimeout,
  resolveHandoffReturnStage,
  shouldScheduleAIReply,
} from './lara-runtime.utils';

test('Lara so agenda uma mensagem inbound que ainda nao foi processada', () => {
  assert.equal(shouldScheduleAIReply(true, null), true);
  assert.equal(shouldScheduleAIReply(true, new Date()), false);
  assert.equal(shouldScheduleAIReply(false, null), false);
});

test('score da Lara e independente e fica entre 0 e 100', () => {
  assert.equal(clampAIScore(72.6), 73);
  assert.equal(clampAIScore(-10), 0);
  assert.equal(clampAIScore(140), 100);
  assert.equal(clampAIScore('invalido'), 0);
});

test('Eu respondo restaura a etapa anterior ao handoff', () => {
  assert.equal(isHumanHandoffStage('TRANSFERIDO_HUMANO'), true);
  assert.equal(isHumanHandoffStage('NUTRICAO'), false);
  assert.equal(resolveHandoffReturnStage('NUTRICAO'), 'NUTRICAO');
  assert.equal(resolveHandoffReturnStage('NOVO'), 'NOVO');
  assert.equal(resolveHandoffReturnStage(null), 'QUALIFICACAO');
  assert.equal(resolveHandoffReturnStage('TRANSFERIDO_HUMANO'), 'QUALIFICACAO');
});

test('Ver tudo remove o limite de cards do CRM', () => {
  assert.deepEqual(kanbanCardQueryLimit(false), { take: 50 });
  assert.deepEqual(kanbanCardQueryLimit(true), {});
});

test('contagem de follow-ups sobe somente quando houve envio', () => {
  assert.equal(countSentFollowUp(3, false), 3);
  assert.equal(countSentFollowUp(3, true), 4);
});

test('timeout da IA tem default e limites seguros', () => {
  assert.equal(resolveAIRequestTimeout(undefined), 45_000);
  assert.equal(resolveAIRequestTimeout('100'), 5_000);
  assert.equal(resolveAIRequestTimeout('90000'), 90_000);
  assert.equal(resolveAIRequestTimeout('999999'), 120_000);
});

test('chamada de IA pendurada e abortada pelo timeout', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_input: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  })) as typeof fetch;

  try {
    await assert.rejects(
      fetchWithAIRequestTimeout('https://example.invalid/ai', {}, 20),
      /Timeout da IA apos 20ms/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
