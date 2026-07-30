import assert from 'node:assert/strict';
import test from 'node:test';
import { planHistoricalLaraRepair } from './lara-crm-repair';

const researchTime = new Date('2026-07-29T15:04:00.000Z');

function lead(
  overrides: Partial<Parameters<typeof planHistoricalLaraRepair>[0]> = {},
): Parameters<typeof planHistoricalLaraRepair>[0] {
  return {
    marketingStage: 'QUALIFICACAO',
    marketingStageSource: 'ai',
    marketingStageChangedAt: researchTime,
    researchedAt: researchTime,
    researchIcpSignal: 'qualified',
    aiScore: null,
    tags: [],
    aiHandoff: false,
    ...overrides,
  };
}

test('repara oportunidade descartada depois que a agenda foi enviada', () => {
  const plan = planHistoricalLaraRepair(lead({
    marketingStage: 'SEM_INTERESSE',
    researchIcpSignal: 'disqualified',
    aiScore: 95,
    tags: ['link_agendamento_enviado'],
  }));
  assert.equal(plan.stage, 'AGENDA_ENVIADA');
  assert.equal(plan.aiScore, undefined);
});

test('movimentacao manual nunca e sobrescrita pelo reparador', () => {
  const plan = planHistoricalLaraRepair(lead({
    marketingStage: 'SEM_INTERESSE',
    marketingStageSource: 'manual',
    tags: ['link_agendamento_enviado'],
  }));
  assert.equal(plan.stage, undefined);
});

test('tag antiga de agenda nao retira lead de aguardando follow-up', () => {
  const plan = planHistoricalLaraRepair(lead({
    marketingStage: 'AGUARDANDO_FOLLOWUP',
    marketingStageSource: 'system',
    tags: ['link_agendamento_enviado'],
  }));
  assert.equal(plan.stage, undefined);
});

test('repara nurture historico colocado em qualificacao pela pesquisa antiga', () => {
  const plan = planHistoricalLaraRepair(lead({
    researchIcpSignal: 'nurture',
  }));
  assert.equal(plan.stage, 'NUTRICAO');
  assert.equal(plan.aiScore, 40);
});

test('nao confunde uma avaliacao de conversa com a pesquisa antiga', () => {
  const plan = planHistoricalLaraRepair(lead({
    researchIcpSignal: 'nurture',
    aiScore: 55,
  }));
  assert.equal(plan.stage, undefined);
  assert.equal(plan.aiScore, undefined);
});

test('reuniao confirmada prevalece sobre outros sinais automaticos', () => {
  const plan = planHistoricalLaraRepair(lead({
    marketingStage: 'AGENDA_ENVIADA',
    tags: ['link_agendamento_enviado', 'reuniao_agendada'],
    aiHandoff: true,
  }));
  assert.equal(plan.stage, 'REUNIAO_AGENDADA');
});

test('handoff historico e sincronizado com transferido pra humano', () => {
  const plan = planHistoricalLaraRepair(lead({
    marketingStage: 'QUALIFICACAO',
    aiHandoff: true,
  }));
  assert.equal(plan.stage, 'TRANSFERIDO_HUMANO');
});

test('preenche somente score ausente com base conservadora da pesquisa', () => {
  assert.equal(planHistoricalLaraRepair(lead({
    researchIcpSignal: 'qualified',
  })).aiScore, 70);
  assert.equal(planHistoricalLaraRepair(lead({
    researchIcpSignal: 'nurture',
  })).aiScore, 40);
  assert.equal(planHistoricalLaraRepair(lead({
    researchIcpSignal: 'disqualified',
  })).aiScore, 20);
  assert.equal(planHistoricalLaraRepair(lead({
    researchIcpSignal: 'qualified',
    aiScore: 88,
  })).aiScore, undefined);
});

test('estagios terminais nao sao retirados automaticamente', () => {
  const meeting = planHistoricalLaraRepair(lead({
    marketingStage: 'REUNIAO_AGENDADA',
    tags: ['link_agendamento_enviado'],
  }));
  const handoff = planHistoricalLaraRepair(lead({
    marketingStage: 'TRANSFERIDO_HUMANO',
    tags: ['reuniao_agendada'],
  }));
  assert.equal(meeting.stage, undefined);
  assert.equal(handoff.stage, undefined);
});
