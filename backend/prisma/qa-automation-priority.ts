import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/database';
import {
  fireTriggerForJourney,
  resumeQueuedNurtures,
  resumeWaitingExecutions,
  testJourneyForLead,
} from '../src/services/automation-engine.service';
import { AutomationJourneysService } from '../src/services/automation-journeys.service';

type JourneyOptions = {
  automationType?: 'NURTURE' | 'STANDALONE';
  entryMode?: 'TRIGGER' | 'AUDIENCE';
  priority?: number;
  canInterrupt?: boolean;
  event?: string;
  eventValue?: string;
  tail?: 'wait' | 'fail_after_wait';
  exitConditions?: Prisma.InputJsonValue;
  queueTtlHours?: number | null;
};

type Scope = {
  journeyIds: string[];
  emails: string[];
  segmentIds: string[];
};

const SUITE_SUFFIX = '@qa-automacao-suite.local';
const FIXTURE_SUFFIX = '@qa-automacao.local';
const FIXTURE_PREFIX = '[QA Prioridade]';
const FAR_FUTURE = new Date('2099-01-01T00:00:00.000Z');
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function nodesFor(options: JourneyOptions): Prisma.InputJsonValue {
  const trigger = {
    id: 'trigger', type: 'trigger', label: 'Entrada', x: 80, y: 80,
    config: { event: options.event ?? 'conversion_received', ...(options.eventValue ? { eventValue: options.eventValue } : {}) },
  };
  const wait = {
    id: 'wait', type: 'wait', label: 'Esperar', x: 80, y: 220,
    config: { amount: 365, unit: 'days' },
  };
  if (options.tail === 'fail_after_wait') {
    return [
      trigger,
      wait,
      { id: 'fail', type: 'internal_action', label: 'Falha controlada', x: 80, y: 360, config: { action: 'add_tag', value: '' } },
    ] as unknown as Prisma.InputJsonValue;
  }
  return [trigger, wait] as unknown as Prisma.InputJsonValue;
}

function edgesFor(options: JourneyOptions): Prisma.InputJsonValue {
  const edges = [{ id: 'trigger-wait', source: 'trigger', target: 'wait' }];
  if (options.tail === 'fail_after_wait') edges.push({ id: 'wait-fail', source: 'wait', target: 'fail' });
  return edges as unknown as Prisma.InputJsonValue;
}

async function createJourney(scope: Scope, name: string, options: JourneyOptions = {}) {
  const journey = await prisma.automationJourney.create({
    data: {
      name,
      description: `Cenário seguro de QA local: ${name}`,
      status: 'ACTIVE',
      isActive: true,
      automationType: options.automationType ?? 'NURTURE',
      entryMode: options.entryMode ?? 'TRIGGER',
      priority: options.priority ?? 50,
      canInterruptLowerPriority: options.canInterrupt ?? true,
      queueTtlHours: options.queueTtlHours === undefined ? 168 : options.queueTtlHours,
      nodes: nodesFor(options),
      edges: edgesFor(options),
      exitConditions: options.exitConditions ?? Prisma.JsonNull,
    },
  });
  scope.journeyIds.push(journey.id);
  return journey;
}

async function createLead(scope: Scope, localPart: string, data: { name?: string; tags?: string[]; status?: 'LEAD' | 'DISQUALIFIED'; notes?: string } = {}) {
  const email = `${localPart}${SUITE_SUFFIX}`;
  const lead = await prisma.lead.create({
    data: {
      email,
      name: data.name ?? `QA ${localPart}`,
      company: 'AutoForce QA Local',
      status: data.status ?? 'LEAD',
      tags: data.tags ?? ['qa-automacao'],
      notes: data.notes ?? 'Dado temporário da suíte de prioridade de automações.',
    },
  });
  scope.emails.push(email);
  return lead;
}

async function createSegment(scope: Scope, name: string, tag: string) {
  const segment = await prisma.segment.create({
    data: {
      name,
      description: 'Segmento temporário da suíte de prioridade.',
      rules: { logic: 'AND', conditions: [{ id: 'qa-tag', field: 'tags', operator: 'contains_tag', value: tag }] },
    },
  });
  scope.segmentIds.push(segment.id);
  return segment;
}

async function cleanupScope(scope: Scope) {
  if (scope.journeyIds.length) await prisma.automationJourney.deleteMany({ where: { id: { in: scope.journeyIds } } });
  if (scope.segmentIds.length) await prisma.segment.deleteMany({ where: { id: { in: scope.segmentIds } } });
  if (scope.emails.length) await prisma.lead.deleteMany({ where: { email: { in: scope.emails } } });
}

async function waitUntil<T>(read: () => Promise<T>, predicate: (value: T) => boolean, label: string, timeoutMs = 6000): Promise<T> {
  const started = Date.now();
  let last = await read();
  while (!predicate(last)) {
    if (Date.now() - started > timeoutMs) throw new Error(`Timeout aguardando ${label}: ${JSON.stringify(last)}`);
    await sleep(30);
    last = await read();
  }
  return last;
}

async function execution(journeyId: string, email: string) {
  return prisma.automationExecution.findFirst({ where: { journeyId, leadEmail: email }, orderBy: { startedAt: 'desc' } });
}

async function waitStatus(journeyId: string, email: string, status: string) {
  return waitUntil(
    () => execution(journeyId, email),
    value => value?.status === status,
    `${journeyId}/${email} ficar ${status}`
  );
}

async function forceResume(executionId: string) {
  await prisma.automationExecution.update({ where: { id: executionId }, data: { resumeAt: new Date(Date.now() - 1000) } });
  await resumeWaitingExecutions();
}

async function runCase(name: string, body: (scope: Scope) => Promise<void>, results: string[]) {
  const scope: Scope = { journeyIds: [], emails: [], segmentIds: [] };
  try {
    await body(scope);
    results.push(`OK  ${name}`);
  } finally {
    await cleanupScope(scope);
  }
}

async function runAutomatedSuite() {
  await prisma.automationJourney.deleteMany({ where: { name: { startsWith: '[QA Suite]' } } });
  await prisma.segment.deleteMany({ where: { name: { startsWith: '[QA Suite]' } } });
  await prisma.lead.deleteMany({ where: { email: { endsWith: SUITE_SUFFIX } } });

  const results: string[] = [];

  await runCase('bloqueia ativação sem classificação, inclusive status em minúsculas', async scope => {
    await assert.rejects(() => AutomationJourneysService.create({ name: '[QA Suite] inválida', status: 'ACTIVE' }));
    const draft = await AutomationJourneysService.create({ name: '[QA Suite] rascunho sem classificação' });
    scope.journeyIds.push(draft.id);
    await assert.rejects(() => AutomationJourneysService.update(draft.id, { status: 'active' }));
  }, results);

  await runCase('sugere prioridade Alta para conversão e Normal para público da base', async scope => {
    const conversion = await AutomationJourneysService.create({
      name: '[QA Suite] prioridade conversão', automationType: 'NURTURE', nodes: nodesFor({ event: 'conversion_received' }) as any,
    });
    const audience = await AutomationJourneysService.create({
      name: '[QA Suite] prioridade segmento', automationType: 'NURTURE', nodes: nodesFor({ event: 'segment_entered' }) as any,
    });
    scope.journeyIds.push(conversion.id, audience.id);
    assert.equal(conversion.priority, 75);
    assert.equal(conversion.entryMode, 'TRIGGER');
    assert.equal(audience.priority, 50);
    assert.equal(audience.entryMode, 'AUDIENCE');
  }, results);

  await runCase('prioridade maior interrompe a nutrição menor e registra substituição', async scope => {
    const lead = await createLead(scope, 'preempcao');
    const low = await createJourney(scope, '[QA Suite] baixa', { priority: 20 });
    const high = await createJourney(scope, '[QA Suite] alta', { priority: 75 });
    await fireTriggerForJourney(low.id, lead.email, { conversionName: 'base' });
    const lowWaiting = await waitStatus(low.id, lead.email, 'waiting');
    await fireTriggerForJourney(high.id, lead.email, { conversionName: 'ebook' });
    const highWaiting = await waitStatus(high.id, lead.email, 'waiting');
    const lowCancelled = await waitStatus(low.id, lead.email, 'cancelled');
    assert.equal(lowCancelled?.supersededById, highWaiting?.id);
    assert.match(lowCancelled?.error ?? '', /Interrompido por fluxo prioritário/);
  }, results);

  await runCase('prioridades iguais respeitam FIFO e promovem uma por vez', async scope => {
    const lead = await createLead(scope, 'fifo');
    const blocker = await createJourney(scope, '[QA Suite] bloqueador', { priority: 95 });
    const first = await createJourney(scope, '[QA Suite] fila A', { priority: 50 });
    const second = await createJourney(scope, '[QA Suite] fila B', { priority: 50 });
    await fireTriggerForJourney(blocker.id, lead.email);
    const active = await waitStatus(blocker.id, lead.email, 'waiting');
    await fireTriggerForJourney(first.id, lead.email);
    await waitStatus(first.id, lead.email, 'queued');
    await sleep(20);
    await fireTriggerForJourney(second.id, lead.email);
    await waitStatus(second.id, lead.email, 'queued');
    await forceResume(active!.id);
    const firstWaiting = await waitStatus(first.id, lead.email, 'waiting');
    assert.equal((await execution(second.id, lead.email))?.status, 'queued');
    await forceResume(firstWaiting!.id);
    await waitStatus(second.id, lead.email, 'waiting');
  }, results);

  await runCase('prioridade maior sem permissão de interrupção aguarda na fila', async scope => {
    const lead = await createLead(scope, 'sem-interrupcao');
    const low = await createJourney(scope, '[QA Suite] ativa baixa', { priority: 20 });
    const high = await createJourney(scope, '[QA Suite] alta sem interrupção', { priority: 75, canInterrupt: false });
    await fireTriggerForJourney(low.id, lead.email);
    await waitStatus(low.id, lead.email, 'waiting');
    await fireTriggerForJourney(high.id, lead.email);
    await waitStatus(high.id, lead.email, 'queued');
    assert.equal((await execution(low.id, lead.email))?.status, 'waiting');
  }, results);

  await runCase('automações avulsas rodam em paralelo com uma nutrição', async scope => {
    const lead = await createLead(scope, 'avulsas');
    const nurture = await createJourney(scope, '[QA Suite] nutrição', { priority: 50 });
    const standaloneA = await createJourney(scope, '[QA Suite] avulsa A', { automationType: 'STANDALONE' });
    const standaloneB = await createJourney(scope, '[QA Suite] avulsa B', { automationType: 'STANDALONE' });
    await Promise.all([
      fireTriggerForJourney(nurture.id, lead.email),
      fireTriggerForJourney(standaloneA.id, lead.email),
      fireTriggerForJourney(standaloneB.id, lead.email),
    ]);
    await Promise.all([
      waitStatus(nurture.id, lead.email, 'waiting'),
      waitStatus(standaloneA.id, lead.email, 'waiting'),
      waitStatus(standaloneB.id, lead.email, 'waiting'),
    ]);
  }, results);

  await runCase('20 gatilhos concorrentes não duplicam a mesma inscrição', async scope => {
    const lead = await createLead(scope, 'concorrencia');
    const journey = await createJourney(scope, '[QA Suite] concorrência', { priority: 75 });
    await Promise.all(Array.from({ length: 20 }, () => fireTriggerForJourney(journey.id, lead.email)));
    await waitStatus(journey.id, lead.email, 'waiting');
    assert.equal(await prisma.automationExecution.count({ where: { journeyId: journey.id, leadEmail: lead.email } }), 1);
  }, results);

  await runCase('12 jornadas concorrentes mantêm somente a maior prioridade ativa', async scope => {
    const lead = await createLead(scope, 'concorrencia-multiplos-fluxos');
    const journeys = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      createJourney(scope, `[QA Suite] concorrente ${index + 1}`, { priority: 10 + index * 7 })
    ));
    await Promise.all(journeys.map(journey => fireTriggerForJourney(journey.id, lead.email)));
    const rows = await waitUntil(
      () => prisma.automationExecution.findMany({ where: { leadEmail: lead.email } }),
      executions => executions.length === journeys.length && executions.some(item => item.status === 'waiting'),
      'todas as jornadas concorrentes serem persistidas'
    );
    const active = rows.filter(item => item.status === 'running' || item.status === 'waiting');
    assert.equal(active.length, 1);
    assert.equal(active[0].prioritySnapshot, Math.max(...journeys.map(journey => journey.priority)));
    assert.equal(rows.filter(item => item.status === 'failed').length, 0);
  }, results);

  await runCase('índice do PostgreSQL impede duas nutrições ativas para o mesmo lead', async scope => {
    const lead = await createLead(scope, 'indice-unico');
    const first = await createJourney(scope, '[QA Suite] índice A', { priority: 50 });
    const second = await createJourney(scope, '[QA Suite] índice B', { priority: 50 });
    await fireTriggerForJourney(first.id, lead.email);
    await waitStatus(first.id, lead.email, 'waiting');
    await assert.rejects(() => prisma.automationExecution.create({
      data: {
        journeyId: second.id, leadEmail: lead.email, status: 'running', currentNodeId: 'trigger',
        automationTypeSnapshot: 'NURTURE', prioritySnapshot: 50, log: [],
      },
    }), (error: any) => error?.code === 'P2002');
  }, results);

  await runCase('item expirado é cancelado e não entra após a liberação da fila', async scope => {
    const lead = await createLead(scope, 'expiracao');
    const blocker = await createJourney(scope, '[QA Suite] bloqueador expiração', { priority: 95 });
    const candidate = await createJourney(scope, '[QA Suite] candidato expirado', { priority: 20 });
    await fireTriggerForJourney(blocker.id, lead.email);
    const active = await waitStatus(blocker.id, lead.email, 'waiting');
    await fireTriggerForJourney(candidate.id, lead.email);
    const queued = await waitStatus(candidate.id, lead.email, 'queued');
    await prisma.automationExecution.update({ where: { id: queued!.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await forceResume(active!.id);
    const cancelled = await waitStatus(candidate.id, lead.email, 'cancelled');
    assert.match(cancelled?.error ?? '', /Expirou/);
  }, results);

  await runCase('item sem prazo permanece elegível mesmo após longa espera', async scope => {
    const lead = await createLead(scope, 'sem-prazo');
    const blocker = await createJourney(scope, '[QA Suite] bloqueador sem prazo', { priority: 95 });
    const candidate = await createJourney(scope, '[QA Suite] candidato sem prazo', { priority: 50, queueTtlHours: null });
    await fireTriggerForJourney(blocker.id, lead.email);
    const active = await waitStatus(blocker.id, lead.email, 'waiting');
    await fireTriggerForJourney(candidate.id, lead.email);
    const queued = await waitStatus(candidate.id, lead.email, 'queued');
    assert.equal(queued?.expiresAt, null);
    await prisma.automationExecution.update({
      where: { id: queued!.id },
      data: { queuedAt: new Date('2020-01-01T00:00:00.000Z') },
    });
    await forceResume(active!.id);
    await waitStatus(candidate.id, lead.email, 'waiting');
  }, results);

  await runCase('público da base é revalidado antes de sair da fila', async scope => {
    const lead = await createLead(scope, 'revalidacao', { tags: ['qa-automacao', 'qa-elegivel'] });
    const segment = await createSegment(scope, '[QA Suite] elegíveis', 'qa-elegivel');
    const blocker = await createJourney(scope, '[QA Suite] bloqueador público', { priority: 95 });
    const audience = await createJourney(scope, '[QA Suite] público dinâmico', {
      priority: 50, entryMode: 'AUDIENCE', event: 'segment_entered', eventValue: segment.id,
    });
    await fireTriggerForJourney(blocker.id, lead.email);
    const active = await waitStatus(blocker.id, lead.email, 'waiting');
    await fireTriggerForJourney(audience.id, lead.email, { segmentId: segment.id });
    await waitStatus(audience.id, lead.email, 'queued');
    await prisma.lead.update({ where: { email: lead.email }, data: { tags: ['qa-automacao'] } });
    await forceResume(active!.id);
    const cancelled = await waitStatus(audience.id, lead.email, 'cancelled');
    assert.match(cancelled?.error ?? '', /Não estava mais elegível/);
  }, results);

  await runCase('lead desqualificado não entra em nenhuma automação', async scope => {
    const lead = await createLead(scope, 'desqualificado', { status: 'DISQUALIFIED' });
    const journey = await createJourney(scope, '[QA Suite] bloqueio desqualificado', { priority: 75 });
    await fireTriggerForJourney(journey.id, lead.email);
    await sleep(80);
    assert.equal(await prisma.automationExecution.count({ where: { journeyId: journey.id, leadEmail: lead.email } }), 0);
  }, results);

  await runCase('lead desqualificado enquanto está na fila é cancelado na promoção', async scope => {
    const lead = await createLead(scope, 'desqualificado-na-fila');
    const blocker = await createJourney(scope, '[QA Suite] bloqueador desqualificação', { priority: 95 });
    const candidate = await createJourney(scope, '[QA Suite] candidato desqualificado', { priority: 50 });
    await fireTriggerForJourney(blocker.id, lead.email);
    const active = await waitStatus(blocker.id, lead.email, 'waiting');
    await fireTriggerForJourney(candidate.id, lead.email);
    await waitStatus(candidate.id, lead.email, 'queued');
    await prisma.lead.update({ where: { email: lead.email }, data: { status: 'DISQUALIFIED' } });
    await forceResume(active!.id);
    await waitStatus(candidate.id, lead.email, 'cancelled');
  }, results);

  await runCase('falha controlada libera e promove o próximo fluxo', async scope => {
    const lead = await createLead(scope, 'falha-promove');
    const failing = await createJourney(scope, '[QA Suite] falha controlada', { priority: 95, tail: 'fail_after_wait' });
    const queuedJourney = await createJourney(scope, '[QA Suite] após falha', { priority: 50 });
    await fireTriggerForJourney(failing.id, lead.email);
    const active = await waitStatus(failing.id, lead.email, 'waiting');
    await fireTriggerForJourney(queuedJourney.id, lead.email);
    await waitStatus(queuedJourney.id, lead.email, 'queued');
    await forceResume(active!.id);
    const failed = await waitStatus(failing.id, lead.email, 'failed');
    assert.match(failed?.error ?? '', /Tag não configurada/);
    await waitStatus(queuedJourney.id, lead.email, 'waiting');
  }, results);

  await runCase('condição de saída encerra o atual e libera a fila', async scope => {
    const lead = await createLead(scope, 'saida-global');
    const exiting = await createJourney(scope, '[QA Suite] saída global', {
      priority: 95,
      exitConditions: { logic: 'AND', conditions: [{ field: 'tag', operator: 'has_tag', value: 'qa-sair' }] },
    });
    const queuedJourney = await createJourney(scope, '[QA Suite] após saída', { priority: 50 });
    await fireTriggerForJourney(exiting.id, lead.email);
    const active = await waitStatus(exiting.id, lead.email, 'waiting');
    await fireTriggerForJourney(queuedJourney.id, lead.email);
    await waitStatus(queuedJourney.id, lead.email, 'queued');
    await prisma.lead.update({ where: { email: lead.email }, data: { tags: ['qa-automacao', 'qa-sair'] } });
    await forceResume(active!.id);
    await waitStatus(exiting.id, lead.email, 'completed');
    await waitStatus(queuedJourney.id, lead.email, 'waiting');
  }, results);

  await runCase('automação pausada enquanto aguardava é descartada na promoção', async scope => {
    const lead = await createLead(scope, 'pausada-na-fila');
    const blocker = await createJourney(scope, '[QA Suite] bloqueador pausa', { priority: 95 });
    const candidate = await createJourney(scope, '[QA Suite] candidata pausada', { priority: 50 });
    await fireTriggerForJourney(blocker.id, lead.email);
    const active = await waitStatus(blocker.id, lead.email, 'waiting');
    await fireTriggerForJourney(candidate.id, lead.email);
    await waitStatus(candidate.id, lead.email, 'queued');
    await prisma.automationJourney.update({ where: { id: candidate.id }, data: { status: 'PAUSED', isActive: false } });
    await forceResume(active!.id);
    await waitStatus(candidate.id, lead.email, 'cancelled');
  }, results);

  await runCase('execução de teste não disputa a vaga da nutrição real', async scope => {
    const lead = await createLead(scope, 'teste-isolado');
    const journey = await createJourney(scope, '[QA Suite] teste isolado', { priority: 75 });
    await fireTriggerForJourney(journey.id, lead.email);
    await waitStatus(journey.id, lead.email, 'waiting');
    await testJourneyForLead(journey.id, lead.email);
    await waitUntil(
      () => prisma.automationExecution.findMany({ where: { journeyId: journey.id, leadEmail: lead.email } }),
      rows => rows.length === 2 && rows.every(row => row.status === 'waiting'),
      'execução real e execução de teste em paralelo'
    );
    const rows = await prisma.automationExecution.findMany({ where: { journeyId: journey.id, leadEmail: lead.email } });
    assert.deepEqual(rows.map(row => row.isTest).sort(), [false, true]);
  }, results);

  await runCase('teste sem bloco de entrada falha antes de criar execução presa', async scope => {
    const lead = await createLead(scope, 'sem-entrada');
    const journey = await prisma.automationJourney.create({
      data: {
        name: '[QA Suite] sem entrada', status: 'DRAFT', isActive: false,
        automationType: 'NURTURE', entryMode: 'TRIGGER', priority: 50,
        nodes: [{ id: 'wait', type: 'wait', label: 'Esperar', x: 80, y: 80, config: { amount: 1, unit: 'days' } }],
        edges: [],
      },
    });
    scope.journeyIds.push(journey.id);
    await assert.rejects(() => testJourneyForLead(journey.id, lead.email), /não tem nó de Entrada/);
    assert.equal(await prisma.automationExecution.count({ where: { journeyId: journey.id } }), 0);
  }, results);

  await runCase('varredura recupera item órfão da fila', async scope => {
    const lead = await createLead(scope, 'fila-orfa');
    const journey = await createJourney(scope, '[QA Suite] fila órfã', { priority: 50 });
    await prisma.automationExecution.create({
      data: {
        journeyId: journey.id, leadEmail: lead.email, status: 'queued', currentNodeId: 'trigger',
        automationTypeSnapshot: 'NURTURE', prioritySnapshot: 50, queuedAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000), triggerEvent: 'conversion_received', triggerContext: {}, log: [],
      },
    });
    await resumeQueuedNurtures();
    await waitStatus(journey.id, lead.email, 'waiting');
  }, results);

  await runCase('estatísticas contabilizam fila e interrupções', async scope => {
    const journey = await createJourney(scope, '[QA Suite] estatísticas', { priority: 50 });
    const statuses = ['running', 'waiting', 'queued', 'completed', 'failed', 'cancelled'];
    for (const [index, status] of statuses.entries()) {
      const lead = await createLead(scope, `stats-${index}`);
      await prisma.automationExecution.create({
        data: {
          journeyId: journey.id, leadEmail: lead.email, status, currentNodeId: 'wait', isTest: true,
          automationTypeSnapshot: 'NURTURE', prioritySnapshot: 50, log: [],
          ...(status === 'queued' ? { queuedAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) } : {}),
          ...(['completed', 'failed', 'cancelled'].includes(status) ? { completedAt: new Date() } : {}),
        },
      });
    }
    const stats = await AutomationJourneysService.getExecutionStats(journey.id);
    assert.deepEqual(stats, { running: 1, waiting: 1, queued: 1, completed: 1, failed: 1, cancelled: 1, total: 6 });
  }, results);

  return results;
}

async function resetPermanentFixtures() {
  await prisma.automationJourney.deleteMany({ where: { name: { startsWith: FIXTURE_PREFIX } } });
  await prisma.segment.deleteMany({ where: { name: { startsWith: FIXTURE_PREFIX } } });
  await prisma.lead.deleteMany({ where: { email: { endsWith: FIXTURE_SUFFIX } } });
}

async function seedPermanentFixtures() {
  await resetPermanentFixtures();
  const scope: Scope = { journeyIds: [], emails: [], segmentIds: [] };

  const segment = await prisma.segment.create({
    data: {
      name: `${FIXTURE_PREFIX} Público elegível`,
      description: 'Usado para comprovar que o lead é revalidado antes de sair da fila.',
      color: '#456CEC',
      rules: { logic: 'AND', conditions: [{ id: 'qa-tag', field: 'tags', operator: 'contains_tag', value: 'qa-publico-elegivel' }] },
    },
  });
  scope.segmentIds.push(segment.id);

  const journeys = {
    base: await createJourney(scope, `${FIXTURE_PREFIX} Base | Baixa`, { priority: 20, eventValue: 'qa-base' }),
    ebook: await createJourney(scope, `${FIXTURE_PREFIX} Ebook | Alta`, { priority: 75, eventValue: 'qa-ebook' }),
    critical: await createJourney(scope, `${FIXTURE_PREFIX} Comercial | Crítica`, { priority: 95, eventValue: 'qa-comercial' }),
    noInterrupt: await createJourney(scope, `${FIXTURE_PREFIX} Alta sem interrupção`, { priority: 75, canInterrupt: false, queueTtlHours: null, eventValue: 'qa-sem-interrupcao' }),
    normalA: await createJourney(scope, `${FIXTURE_PREFIX} Fila Normal A`, { priority: 50, eventValue: 'qa-normal-a' }),
    normalB: await createJourney(scope, `${FIXTURE_PREFIX} Fila Normal B`, { priority: 50, eventValue: 'qa-normal-b' }),
    standaloneA: await createJourney(scope, `${FIXTURE_PREFIX} Avulsa A`, { automationType: 'STANDALONE', eventValue: 'qa-avulsa-a' }),
    standaloneB: await createJourney(scope, `${FIXTURE_PREFIX} Avulsa B`, { automationType: 'STANDALONE', eventValue: 'qa-avulsa-b' }),
    audience: await createJourney(scope, `${FIXTURE_PREFIX} Público da base`, {
      priority: 50, entryMode: 'AUDIENCE', event: 'segment_entered', eventValue: segment.id,
    }),
    failing: await createJourney(scope, `${FIXTURE_PREFIX} Falha controlada`, { priority: 95, tail: 'fail_after_wait', eventValue: 'qa-falha' }),
  };

  async function fixtureLead(localPart: string, name: string, notes: string, tags = ['qa-automacao']) {
    const email = `${localPart}${FIXTURE_SUFFIX}`;
    const lead = await prisma.lead.create({ data: { email, name, company: 'AutoForce QA Local', tags, notes } });
    scope.emails.push(email);
    return lead;
  }

  const preemption = await fixtureLead('01-prioridade', '[QA] 01 — Conversão interrompe base', 'Esperado: Base cancelada, Ebook ativo, Normal na fila e Avulsa ativa.');
  await fireTriggerForJourney(journeys.base.id, preemption.email);
  await waitStatus(journeys.base.id, preemption.email, 'waiting');
  await fireTriggerForJourney(journeys.ebook.id, preemption.email);
  await waitStatus(journeys.ebook.id, preemption.email, 'waiting');
  await waitStatus(journeys.base.id, preemption.email, 'cancelled');
  await fireTriggerForJourney(journeys.normalA.id, preemption.email);
  await waitStatus(journeys.normalA.id, preemption.email, 'queued');
  await fireTriggerForJourney(journeys.standaloneA.id, preemption.email);
  await waitStatus(journeys.standaloneA.id, preemption.email, 'waiting');

  const noInterrupt = await fixtureLead('02-sem-interrupcao', '[QA] 02 — Alta sem interromper', 'Esperado: Base ativa e Alta sem interrupção na fila.');
  await fireTriggerForJourney(journeys.base.id, noInterrupt.email);
  await waitStatus(journeys.base.id, noInterrupt.email, 'waiting');
  await fireTriggerForJourney(journeys.noInterrupt.id, noInterrupt.email);
  await waitStatus(journeys.noInterrupt.id, noInterrupt.email, 'queued');

  const fifo = await fixtureLead('03-fifo', '[QA] 03 — Ordem FIFO', 'Esperado: Comercial ativo; Normal A e Normal B na fila nessa ordem.');
  await fireTriggerForJourney(journeys.critical.id, fifo.email);
  await waitStatus(journeys.critical.id, fifo.email, 'waiting');
  await fireTriggerForJourney(journeys.normalA.id, fifo.email);
  await waitStatus(journeys.normalA.id, fifo.email, 'queued');
  await sleep(20);
  await fireTriggerForJourney(journeys.normalB.id, fifo.email);
  await waitStatus(journeys.normalB.id, fifo.email, 'queued');

  const expired = await fixtureLead('04-expiracao', '[QA] 04 — Item expirado', 'Esperado: Comercial concluído e Base cancelada por expiração na fila.');
  await fireTriggerForJourney(journeys.critical.id, expired.email);
  const expiredBlocker = await waitStatus(journeys.critical.id, expired.email, 'waiting');
  await fireTriggerForJourney(journeys.base.id, expired.email);
  const expiredCandidate = await waitStatus(journeys.base.id, expired.email, 'queued');
  await prisma.automationExecution.update({ where: { id: expiredCandidate!.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await forceResume(expiredBlocker!.id);
  await waitStatus(journeys.base.id, expired.email, 'cancelled');

  const audience = await fixtureLead('05-publico', '[QA] 05 — Saiu do público', 'Esperado: Público da base cancelado porque o lead deixou de ser elegível.', ['qa-automacao', 'qa-publico-elegivel']);
  await fireTriggerForJourney(journeys.critical.id, audience.email);
  const audienceBlocker = await waitStatus(journeys.critical.id, audience.email, 'waiting');
  await fireTriggerForJourney(journeys.audience.id, audience.email, { segmentId: segment.id });
  await waitStatus(journeys.audience.id, audience.email, 'queued');
  await prisma.lead.update({ where: { email: audience.email }, data: { tags: ['qa-automacao'] } });
  await forceResume(audienceBlocker!.id);
  await waitStatus(journeys.audience.id, audience.email, 'cancelled');

  const failure = await fixtureLead('06-falha', '[QA] 06 — Falha libera fila', 'Esperado: Falha controlada com status Falhou e Normal A promovida para Aguardando.');
  await fireTriggerForJourney(journeys.failing.id, failure.email);
  const failureActive = await waitStatus(journeys.failing.id, failure.email, 'waiting');
  await fireTriggerForJourney(journeys.normalA.id, failure.email);
  await waitStatus(journeys.normalA.id, failure.email, 'queued');
  await forceResume(failureActive!.id);
  await waitStatus(journeys.failing.id, failure.email, 'failed');
  await waitStatus(journeys.normalA.id, failure.email, 'waiting');

  const disqualifiedEmail = `07-desqualificado${FIXTURE_SUFFIX}`;
  await prisma.lead.create({
    data: {
      email: disqualifiedEmail, name: '[QA] 07 — Desqualificado não entra', company: 'AutoForce QA Local',
      status: 'DISQUALIFIED', tags: ['qa-automacao'], notes: 'Esperado: nenhuma execução de automação para este lead.',
    },
  });
  scope.emails.push(disqualifiedEmail);
  await fireTriggerForJourney(journeys.ebook.id, disqualifiedEmail);

  const duplicate = await fixtureLead('08-duplicidade', '[QA] 08 — Gatilho duplicado', 'Esperado: 20 disparos simultâneos geram somente uma execução do Ebook.');
  await Promise.all(Array.from({ length: 20 }, () => fireTriggerForJourney(journeys.ebook.id, duplicate.email)));
  await waitStatus(journeys.ebook.id, duplicate.email, 'waiting');

  const parallel = await fixtureLead('09-paralelo', '[QA] 09 — Avulsas em paralelo', 'Esperado: Base, Avulsa A e Avulsa B ficam ativas juntas.');
  await Promise.all([
    fireTriggerForJourney(journeys.base.id, parallel.email),
    fireTriggerForJourney(journeys.standaloneA.id, parallel.email),
    fireTriggerForJourney(journeys.standaloneB.id, parallel.email),
  ]);
  await Promise.all([
    waitStatus(journeys.base.id, parallel.email, 'waiting'),
    waitStatus(journeys.standaloneA.id, parallel.email, 'waiting'),
    waitStatus(journeys.standaloneB.id, parallel.email, 'waiting'),
  ]);

  await prisma.automationExecution.updateMany({
    where: { leadEmail: { endsWith: FIXTURE_SUFFIX }, status: 'waiting' },
    data: { resumeAt: FAR_FUTURE },
  });
  await prisma.automationJourney.updateMany({
    where: { id: { in: scope.journeyIds } },
    data: { status: 'PAUSED', isActive: false },
  });

  return {
    journeys: scope.journeyIds.length,
    leads: scope.emails.length,
    segmentId: segment.id,
    executions: await prisma.automationExecution.count({ where: { leadEmail: { endsWith: FIXTURE_SUFFIX } } }),
  };
}

async function main() {
  const results = await runAutomatedSuite();
  const fixtures = await seedPermanentFixtures();
  console.log(JSON.stringify({ ok: true, automatedTests: results, fixtures }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.automationJourney.deleteMany({ where: { name: { startsWith: '[QA Suite]' } } }).catch(() => {});
    await prisma.segment.deleteMany({ where: { name: { startsWith: '[QA Suite]' } } }).catch(() => {});
    await prisma.lead.deleteMany({ where: { email: { endsWith: SUITE_SUFFIX } } }).catch(() => {});
    await prisma.$disconnect();
  });
