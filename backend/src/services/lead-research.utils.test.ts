import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLeadResearchQuery,
  normalizeResearchAssessment,
} from './lead-research.utils';

test('pesquisa usa o dominio informado e nao injeta termos do ICP na consulta', () => {
  const query = buildLeadResearchQuery({
    name: 'Pessoa teste',
    company: 'Adadwa',
    siteUrl: 'https://dealerintelligence.com.br/',
  });

  assert.match(query ?? '', /site:dealerintelligence\.com\.br/);
  assert.doesNotMatch(query ?? '', /Adadwa/);
  assert.match(query ?? '', /produtos serviços o que faz/);
  assert.doesNotMatch(query ?? '', /concessionária|revenda de veículos/i);
});

test('fornecedor de tecnologia para concessionarias fica fora do ICP', () => {
  const assessment = normalizeResearchAssessment({
    business_type: 'technology_supplier',
    fit: 'nurture',
    score: 82,
    summary: 'Dealer Intelligence oferece uma plataforma web de BI integrada ao DMS de concessionárias.',
    reason: 'A empresa fornece tecnologia para concessionárias, mas não vende veículos.',
    evidence: [{
      source: 'official_site',
      fact: 'O site define o produto como plataforma 100% web integrada ao DMS.',
    }],
  }, 'fallback');

  assert.equal(assessment.businessType, 'technology_supplier');
  assert.equal(assessment.fit, 'disqualified');
  assert.equal(assessment.score, 39);
});

test('resposta qualified sem tipo elegivel e evidencia nao avanca o lead', () => {
  const assessment = normalizeResearchAssessment({
    business_type: 'unknown',
    fit: 'qualified',
    score: 95,
    summary: 'Empresa automotiva regional.',
    evidence: [],
  }, 'fallback');

  assert.equal(assessment.fit, 'nurture');
  assert.equal(assessment.score, 69);
});

test('desqualificacao sem nenhuma evidencia volta para analise inconclusiva', () => {
  const assessment = normalizeResearchAssessment({
    business_type: 'technology_supplier',
    fit: 'disqualified',
    score: 10,
    summary: 'Fornecedor de tecnologia.',
    evidence: [],
  }, 'fallback');

  assert.equal(assessment.fit, 'nurture');
});

test('revenda so e qualified quando o estoque minimo esta comprovado', () => {
  const evidence = [{ source: 'official_site' as const, fact: 'Site anuncia veículos à venda.' }];
  const withoutStock = normalizeResearchAssessment({
    business_type: 'vehicle_reseller',
    vehicle_stock: null,
    fit: 'qualified',
    score: 90,
    evidence,
  }, 'fallback');
  const withStock = normalizeResearchAssessment({
    business_type: 'vehicle_reseller',
    vehicle_stock: 75,
    fit: 'qualified',
    score: 90,
    evidence,
  }, 'fallback');

  assert.equal(withoutStock.fit, 'nurture');
  assert.equal(withStock.fit, 'qualified');
  assert.equal(withStock.vehicleStock, 75);
});

test('concessionaria oficial avanca com evidencia forte sem exigir estoque', () => {
  const assessment = normalizeResearchAssessment({
    business_type: 'dealership',
    vehicle_stock: null,
    fit: 'qualified',
    score: 86,
    evidence: [{
      source: 'official_site',
      fact: 'O site apresenta a empresa como concessionária autorizada da marca e anuncia veículos novos.',
    }],
  }, 'fallback');

  assert.equal(assessment.fit, 'qualified');
  assert.equal(assessment.vehicleStock, null);
});

test('resultado generico da web sozinho nao qualifica empresa automotiva', () => {
  const assessment = normalizeResearchAssessment({
    business_type: 'dealership',
    fit: 'qualified',
    score: 90,
    evidence: [{ source: 'web_search', fact: 'Um diretório chama a empresa de concessionária.' }],
  }, 'fallback');

  assert.equal(assessment.fit, 'nurture');
});

test('fornecedor do site so e salvo com credito observavel', () => {
  const identified = normalizeResearchAssessment({
    business_type: 'dealership',
    fit: 'qualified',
    score: 85,
    website_provider: 'AutoForce',
    website_provider_evidence: 'O rodapé contém o texto "Desenvolvido por AutoForce" com link para autoforce.com.',
    evidence: [{ source: 'official_site', fact: 'Site de concessionária autorizada.' }],
  }, 'fallback');
  const guessed = normalizeResearchAssessment({
    business_type: 'dealership',
    fit: 'qualified',
    score: 85,
    website_provider: 'Fornecedor presumido',
    website_provider_evidence: null,
    evidence: [{ source: 'official_site', fact: 'Site de concessionária autorizada.' }],
  }, 'fallback');

  assert.equal(identified.websiteProvider, 'AutoForce');
  assert.match(identified.websiteProviderEvidence ?? '', /rodapé/i);
  assert.equal(guessed.websiteProvider, null);
  assert.equal(guessed.websiteProviderEvidence, null);
});
