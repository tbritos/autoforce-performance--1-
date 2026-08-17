import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateRules,
  matchesCondition,
  RECOMMENDED_SCORING_RULES,
  RECOMMENDED_SCORE_THRESHOLD,
} from './lead-scoring.service';

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-1',
    phone: null,
    company: null,
    jobTitle: null,
    city: null,
    state: null,
    status: 'LEAD',
    firstSource: null,
    firstMedium: null,
    firstCampaign: null,
    firstLandingPage: null,
    assignedTo: null,
    tags: [],
    siteUrl: null,
    researchIcpSignal: null,
    researchBusinessType: null,
    aiScore: null,
    _count: { conversions: 0 },
    customFields: {},
    ...overrides,
  } as any;
}

const rules = RECOMMENDED_SCORING_RULES.map((rule, index) => ({ ...rule, id: `rule-${index}` }));

test('comparação numérica usa a quantidade real de conversões', () => {
  assert.equal(matchesCondition(lead({ _count: { conversions: 2 } }), {
    id: 'conversion-count', field: 'conversionCount', operator: 'gte', value: '2',
  }), true);
  assert.equal(matchesCondition(lead({ _count: { conversions: 1 } }), {
    id: 'conversion-count', field: 'conversionCount', operator: 'gte', value: '2',
  }), false);
});
test('ICP confirmado e cadastro consistente ultrapassam o corte', () => {
  const score = evaluateRules(lead({
    researchIcpSignal: 'qualified',
    phone: '5584999999999',
    company: 'Grupo Auto',
    siteUrl: 'https://grupoauto.com.br',
    firstMedium: 'cpc',
    _count: { conversions: 2 },
  }), rules);

  assert.equal(score, 85);
  assert.ok(score >= RECOMMENDED_SCORE_THRESHOLD);
});

test('cadastro e engajamento sem evidência de ICP não atingem o corte', () => {
  const score = evaluateRules(lead({
    jobTitle: 'Diretor Comercial',
    phone: '5584999999999',
    company: 'Empresa sem pesquisa',
    siteUrl: 'https://empresa.com.br',
    firstMedium: 'cpc',
    _count: { conversions: 3 },
  }), rules);

  assert.equal(score, 55);
  assert.ok(score < RECOMMENDED_SCORE_THRESHOLD);
});

test('concessionária com cargo decisor atinge o corte mesmo sem pesquisa prévia', () => {
  const score = evaluateRules(lead({
    jobTitle: 'Gerente de Marketing',
    customFields: { segmento: 'CONCESSIONÁRIA 4 RODAS' },
  }), rules);

  assert.equal(score, 70);
  assert.ok(score >= RECOMMENDED_SCORE_THRESHOLD);
});

test('revenda com cargo decisor atinge o corte sem depender de pesquisa ou contato', () => {
  const score = evaluateRules(lead({
    jobTitle: 'Sócio proprietário',
    customFields: { segmento: 'Revenda multimarcas' },
  }), rules);

  assert.equal(score, 70);
  assert.ok(score >= RECOMMENDED_SCORE_THRESHOLD);
});

test('fornecedor do setor automotivo não qualifica apenas por cargo e cadastro', () => {
  const score = evaluateRules(lead({
    jobTitle: 'Diretor Comercial',
    phone: '5584999999999',
    company: 'Software Automotivo',
    siteUrl: 'https://softwareautomotivo.com.br',
    customFields: { segmento: 'Tecnologia automotiva' },
  }), rules);

  assert.equal(score, 40);
  assert.ok(score < RECOMMENDED_SCORE_THRESHOLD);
});

test('lead fora do ICP nunca é promovido por cadastro ou engajamento', () => {
  const score = evaluateRules(lead({
    researchIcpSignal: 'disqualified',
    jobTitle: 'Diretor Comercial',
    phone: '5584999999999',
    company: 'Agência',
    siteUrl: 'https://agencia.com.br',
    firstMedium: 'cpc',
    _count: { conversions: 5 },
  }), rules);

  assert.equal(score, 0);
});

test('cargo de vendedor mantém o lead abaixo do corte mesmo numa empresa elegível', () => {
  const score = evaluateRules(lead({
    researchIcpSignal: 'qualified',
    jobTitle: 'Consultor de vendas',
    phone: '5584999999999',
    company: 'Concessionária',
    siteUrl: 'https://concessionaria.com.br',
    firstMedium: 'cpc',
    _count: { conversions: 2 },
  }), rules);

  assert.equal(score, 45);
  assert.ok(score < RECOMMENDED_SCORE_THRESHOLD);
});
