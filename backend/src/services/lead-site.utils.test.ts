import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findWebsiteValue,
  isNonOfficialWebsiteUrl,
  isLeadWebsiteFieldName,
  normalizeWebsiteUrl,
  resolveLeadResearchWebsite,
} from './lead-site.utils';

test('normaliza dominio informado pelo lead como URL HTTPS', () => {
  assert.equal(normalizeWebsiteUrl('dealerintelligence.com.br'), 'https://dealerintelligence.com.br/');
  assert.equal(normalizeWebsiteUrl('Site: https://www.exemplo.com.br/estoque#topo'), 'https://www.exemplo.com.br/estoque');
  assert.equal(normalizeWebsiteUrl('nao tenho site'), undefined);
});

test('reconhece campos comuns de site sem confundir landing page', () => {
  assert.equal(isLeadWebsiteFieldName('website'), true);
  assert.equal(isLeadWebsiteFieldName('Qual é o site da empresa?'), true);
  assert.equal(isLeadWebsiteFieldName('url_empresa'), true);
  assert.equal(isLeadWebsiteFieldName('page_url'), false);
  assert.equal(isLeadWebsiteFieldName('landing_page'), false);
});

test('encontra o site em payloads de formulario', () => {
  assert.equal(findWebsiteValue(
    { nome: 'Lead', 'Site da empresa': 'www.grupoteste.com.br' },
    { website: 'ignorado.com.br' },
  ), 'https://www.grupoteste.com.br/');
});

test('encontra site informado dentro de campos personalizados aninhados', () => {
  assert.equal(findWebsiteValue({
    customFields: { Site: 'Grupoindiana.com.br' },
  }), 'https://grupoindiana.com.br/');
});

test('site informado pelo lead vence dominio descoberto pela pesquisa', () => {
  assert.deepEqual(resolveLeadResearchWebsite({
    siteUrl: 'https://empresas.serasaexperian.com.br/',
    researchSiteSource: 'web_search',
    customFields: { Site: 'Grupoindiana.com.br' },
  }), {
    siteUrl: 'https://grupoindiana.com.br/',
    source: 'lead_provided',
    cameFromCustomField: true,
  });
});

test('preserva a origem de um site descoberto entre tentativas', () => {
  assert.deepEqual(resolveLeadResearchWebsite({
    siteUrl: 'https://resultado-encontrado.com.br/',
    researchSiteSource: 'web_search',
  }), {
    siteUrl: 'https://resultado-encontrado.com.br/',
    source: 'web_search',
    cameFromCustomField: false,
  });
});

test('identifica Serasa e outros diretorios como fontes nao oficiais', () => {
  assert.equal(isNonOfficialWebsiteUrl('https://empresas.serasaexperian.com.br/consulta-serasa'), true);
  assert.equal(isNonOfficialWebsiteUrl('https://grupoindiana.com.br/'), false);
});
