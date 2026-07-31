import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findWebsiteValue,
  isLeadWebsiteFieldName,
  normalizeWebsiteUrl,
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
