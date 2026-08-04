import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPaidLeadChannel, countPaidLeadsByChannel } from './lead-attribution.utils';

test('reconhece fontes explicitas de Meta Ads mesmo sem utm_medium', () => {
  assert.equal(classifyPaidLeadChannel({ source: 'Meta', medium: null }), 'meta');
  assert.equal(classifyPaidLeadChannel({ source: 'meta_ads' }), 'meta');
  assert.equal(classifyPaidLeadChannel({ source: 'Facebook Lead Ads' }), 'meta');
});

test('exige meio pago para fontes sociais genericas', () => {
  assert.equal(classifyPaidLeadChannel({ source: 'facebook', medium: 'cpc' }), 'meta');
  assert.equal(classifyPaidLeadChannel({ source: 'instagram', medium: 'paid_social' }), 'meta');
  assert.equal(classifyPaidLeadChannel({ source: 'facebook', medium: 'organic' }), null);
  assert.equal(classifyPaidLeadChannel({ source: 'instagram', medium: null }), null);
});

test('separa Google Ads de busca organica', () => {
  assert.equal(classifyPaidLeadChannel({ source: 'google_ads' }), 'google');
  assert.equal(classifyPaidLeadChannel({ source: 'Google Ads' }), 'google');
  assert.equal(classifyPaidLeadChannel({ source: 'adwords' }), 'google');
  assert.equal(classifyPaidLeadChannel({ source: 'google', medium: 'cpc' }), 'google');
  assert.equal(classifyPaidLeadChannel({ source: 'google', medium: 'organic' }), null);
  assert.equal(classifyPaidLeadChannel({ source: 'google', medium: null }), null);
});

test('conta cada registro de lead uma vez no canal da primeira origem', () => {
  assert.deepEqual(countPaidLeadsByChannel([
    { source: 'Meta' },
    { source: 'facebook', medium: 'cpc' },
    { source: 'google_ads' },
    { source: 'google', medium: 'organic' },
    { source: 'indicacao' },
  ]), { meta: 2, google: 1, total: 3 });
});
