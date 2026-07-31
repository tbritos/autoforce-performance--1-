import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampAIScore,
  countSentFollowUp,
  fetchWithAIRequestTimeout,
  isHumanHandoffStage,
  kanbanCardQueryLimit,
  LARA_NEW_LEADS_ACTIVE_SINCE,
  marketingStageForResearchFit,
  marketingStageForAIConversation,
  normalizeAIScoreForFit,
  pendingResearchFailureData,
  protectedMarketingStagesForSource,
  resetResolvedFollowUpOnInbound,
  resolveAIFollowUpDecision,
  isResearchRetryDue,
  researchRetryDelayMs,
  resolveAIRequestTimeout,
  resolveHandoffReturnStage,
  resolveResolvedConversationReturnStage,
  resolveAIHotState,
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

test('primeiro contato traduz a classificacao da Lara para a coluna correta', () => {
  assert.equal(marketingStageForAIConversation('disqualified'), 'SEM_INTERESSE');
  assert.equal(marketingStageForAIConversation('nurture', 'qualificacao'), 'QUALIFICACAO');
  assert.equal(marketingStageForAIConversation('nurture', 'nutricao'), 'NUTRICAO');
  assert.equal(marketingStageForAIConversation('qualified'), null);
});

test('lead quente e recalculado e sai do destaque ao ser desqualificado', () => {
  assert.equal(resolveAIHotState({ fit: 'qualified', score: 80 }), true);
  assert.equal(resolveAIHotState({ fit: 'nurture', score: 35, isHot: false }), false);
  assert.equal(resolveAIHotState({ fit: 'disqualified', score: 39, isHot: true }), false);
});

test('pesquisa nao sobrescreve progresso comprovado pela conversa', () => {
  const protectedStages = protectedMarketingStagesForSource('research');
  assert.deepEqual(protectedStages, [
    'AGUARDANDO_FOLLOWUP',
    'CONVERSA_RESOLVIDA',
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

test('corte da Lara preserva a base antiga sem excluir novos leads por origem', () => {
  assert.equal(LARA_NEW_LEADS_ACTIVE_SINCE.toISOString(), '2026-07-30T03:00:00.000Z');
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

test('nova mensagem reabre conversa resolvida na etapa anterior', () => {
  assert.equal(resolveResolvedConversationReturnStage('NUTRICAO'), 'NUTRICAO');
  assert.equal(resolveResolvedConversationReturnStage('NOVO'), 'NOVO');
  assert.equal(resolveResolvedConversationReturnStage(null), 'QUALIFICACAO');
  assert.equal(resolveResolvedConversationReturnStage('CONVERSA_RESOLVIDA'), 'QUALIFICACAO');
  assert.equal(resolveResolvedConversationReturnStage('AGUARDANDO_FOLLOWUP'), 'QUALIFICACAO');
});

test('Ver tudo remove o limite de cards do CRM', () => {
  assert.deepEqual(kanbanCardQueryLimit(false), { take: 50 });
  assert.deepEqual(kanbanCardQueryLimit(true), {});
});

test('contagem de follow-ups sobe somente quando houve envio', () => {
  assert.equal(countSentFollowUp(3, false), 3);
  assert.equal(countSentFollowUp(3, true), 4);
});

test('follow-up so envia com confirmacao positiva explicita da Lara', () => {
  assert.equal(resolveAIFollowUpDecision('gemini', []).kind, 'undecided');
  assert.equal(resolveAIFollowUpDecision('fallback', [
    { type: 'send_followup', reason: 'Ha uma pergunta pendente.' },
  ]).kind, 'undecided');
  assert.equal(resolveAIFollowUpDecision('gemini', [
    { type: 'send_followup', reason: 'A Lara perguntou quantos vendedores a operacao possui.' },
  ]).kind, 'send');
});

test('conversa resolvida vence uma confirmacao de envio conflitante', () => {
  const decision = resolveAIFollowUpDecision('openai', [
    { type: 'send_followup', reason: 'Tentar novamente.' },
    { type: 'skip_followup', reason: 'A Lara apenas respondeu a duvida.', payload: { outcome: 'resolved' } },
  ]);
  assert.equal(decision.kind, 'skip_resolved');
});

test('desinteresse explicito continua separado de conversa apenas resolvida', () => {
  assert.equal(resolveAIFollowUpDecision('gemini', [
    { type: 'skip_followup', reason: 'Pediu para nao receber mensagens.', payload: { outcome: 'do_not_contact' } },
  ]).kind, 'skip_disinterest');
  assert.equal(resolveAIFollowUpDecision('gemini', [
    { type: 'skip_followup', reason: 'Duvida respondida.' },
  ]).kind, 'skip_resolved');
});

test('nova mensagem do lead reabre apenas um ciclo encerrado por conversa resolvida', () => {
  assert.deepEqual(
    resetResolvedFollowUpOnInbound(['cliente_site', 'followup_conversa_resolvida', 'followup_desinteresse']),
    ['cliente_site', 'followup_desinteresse'],
  );
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
