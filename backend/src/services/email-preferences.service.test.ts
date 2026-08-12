import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blockingSuppressionScopes,
  normalizeEmailCommunicationType,
  normalizeEmailSuppressionScope,
  suppressionScopeForCommunication,
} from './email-preferences.service';

test('normaliza os três tipos de comunicação com fallback seguro para marketing', () => {
  assert.equal(normalizeEmailCommunicationType('newsletter'), 'NEWSLETTER');
  assert.equal(normalizeEmailCommunicationType('OPERATIONAL'), 'OPERATIONAL');
  assert.equal(normalizeEmailCommunicationType('qualquer'), 'MARKETING');
  assert.equal(normalizeEmailCommunicationType(undefined, 'NEWSLETTER'), 'NEWSLETTER');
});

test('descadastro de newsletter não bloqueia email operacional', () => {
  assert.deepEqual(blockingSuppressionScopes('NEWSLETTER'), ['all', 'newsletter']);
  assert.deepEqual(blockingSuppressionScopes('MARKETING'), ['all', 'marketing']);
  assert.deepEqual(blockingSuppressionScopes('OPERATIONAL'), ['all']);
});

test('escopos públicos aceitam newsletter e marketing sem permitir all', () => {
  assert.equal(normalizeEmailSuppressionScope('marketing'), 'marketing');
  assert.equal(normalizeEmailSuppressionScope('all'), 'newsletter');
  assert.equal(suppressionScopeForCommunication('OPERATIONAL'), null);
});
