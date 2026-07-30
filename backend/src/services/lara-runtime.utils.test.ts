import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampAIScore,
  countSentFollowUp,
  fetchWithAIRequestTimeout,
  isHumanHandoffStage,
  kanbanCardQueryLimit,
  marketingStageForResearchFit,
  normalizeAIScoreForFit,
  pendingResearchFailureData,
  protectedMarketingStagesForSource,
  isResearchRetryDue,
  researchRetryDelayMs,
  resolveAIRequestTimeout,
  resolveHandoffReturnStage,
  shouldPersistAIAnalysis,
  shouldScheduleAIReply,
  withAbortableTimeout,
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

test('score da Lara respeita a faixa coerente com o fit', () => {
  assert.equal(normalizeAIScoreForFit('qualified', 20), 70);
  assert.equal(normalizeAIScoreForFit('qualified', 95), 95);
  assert.equal(normalizeAIScoreForFit('nurture', 95), 69);
  assert.equal(normalizeAIScoreForFit('nurture', 25), 25);
  assert.equal(normalizeAIScoreForFit('disqualified', 95), 39);
  assert.equal(normalizeAIScoreForFit('disqualified', 10), 10);
});

test('fallback nao sobrescreve score nem classificacao da Lara', () => {
  assert.equal(shouldPersistAIAnalysis('gemini'), true);
  assert.equal(shouldPersistAIAnalysis('openai'), true);
  assert.equal(shouldPersistAIAnalysis('fallback'), false);
});

test('pesquisa traduz cada fit para a etapa correta do CRM', () => {
  assert.equal(marketingStageForResearchFit('qualified'), 'QUALIFICACAO');
  assert.equal(marketingStageForResearchFit('nurture'), 'NUTRICAO');
  assert.equal(marketingStageForResearchFit('disqualified'), 'SEM_INTERESSE');
});

test('pesquisa nao sobrescreve progresso comprovado pela conversa', () => {
  const protectedStages = protectedMarketingStagesForSource('research');
  assert.deepEqual(protectedStages, [
    'AGUARDANDO_FOLLOWUP',
    'AGENDA_ENVIADA',
    'REUNIAO_AGENDADA',
    'TRANSFERIDO_HUMANO',
  ]);
  assert.deepEqual(protectedMarketingStagesForSource('manual'), []);
  assert.deepEqual(protectedMarketingStagesForSource('ai'), [
    'REUNIAO_AGENDADA',
    'TRANSFERIDO_HUMANO',
  ]);
});

test('retry da pesquisa usa a ultima tentativa como inicio do backoff', () => {
  const firstSeenAt = new Date('2026-07-30T10:00:00.000Z');
  const lastAttemptAt = new Date('2026-07-30T10:10:00.000Z');
  assert.equal(researchRetryDelayMs(0), 0);
  assert.equal(researchRetryDelayMs(1), 5 * 60 * 1000);
  assert.equal(researchRetryDelayMs(2), 30 * 60 * 1000);
  assert.equal(
    isResearchRetryDue(1, firstSeenAt, lastAttemptAt, new Date('2026-07-30T10:14:59.000Z').getTime()),
    false,
  );
  assert.equal(
    isResearchRetryDue(1, firstSeenAt, lastAttemptAt, new Date('2026-07-30T10:15:00.000Z').getTime()),
    true,
  );
  assert.equal(
    isResearchRetryDue(2, firstSeenAt, lastAttemptAt, new Date('2026-07-30T10:39:59.000Z').getTime()),
    false,
  );
  assert.equal(
    isResearchRetryDue(2, firstSeenAt, lastAttemptAt, new Date('2026-07-30T10:40:00.000Z').getTime()),
    true,
  );
});

test('falha de pesquisa permanece pendente para a proxima tentativa', () => {
  assert.deepEqual(pendingResearchFailureData(), {
    researchedAt: null,
    researchAttempts: { increment: 1 },
  });
});

test('timeout abortavel cancela a operacao de pesquisa pendurada', async () => {
  let aborted = false;
  await assert.rejects(
    withAbortableTimeout(
      signal => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          aborted = true;
          reject(new Error('cancelada'));
        });
      }),
      20,
      'fonte de pesquisa',
    ),
    /Timeout \(20ms\): fonte de pesquisa/,
  );
  assert.equal(aborted, true);
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
