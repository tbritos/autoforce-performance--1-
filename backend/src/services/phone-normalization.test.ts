import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePhoneE164, phoneSearchVariants } from '../utils/phone';

test('normaliza celular brasileiro com DDD e sem codigo do pais', () => {
  assert.equal(normalizePhoneE164('(84) 99680-5226'), '5584996805226');
  assert.equal(normalizePhoneE164('84996805226'), '5584996805226');
});

test('insere o nono digito em celular brasileiro antigo', () => {
  assert.equal(normalizePhoneE164('(84) 9680-5226'), '5584996805226');
  assert.equal(normalizePhoneE164('558496805226'), '5584996805226');
  assert.equal(normalizePhoneE164('84 8680-5226'), '5584986805226');
  assert.equal(normalizePhoneE164('84 7680-5226'), '5584976805226');
  assert.equal(normalizePhoneE164('84 6680-5226'), '5584966805226');
});

test('nao insere nono digito em telefone fixo', () => {
  assert.equal(normalizePhoneE164('(84) 3205-1234'), '558432051234');
  assert.equal(normalizePhoneE164('+55 84 3205-1234'), '558432051234');
});

test('nao confunde o DDD 55 com o codigo do Brasil', () => {
  assert.equal(normalizePhoneE164('(55) 99999-9999'), '5555999999999');
  assert.equal(normalizePhoneE164('(55) 3234-5678'), '555532345678');
});

test('remove zero e codigo de operadora de ligacao nacional', () => {
  assert.equal(normalizePhoneE164('084996805226'), '5584996805226');
  assert.equal(normalizePhoneE164('01584996805226'), '5584996805226');
  assert.equal(normalizePhoneE164('0158432051234'), '558432051234');
});

test('preserva numero internacional explicito e rejeita brasileiro sem DDD', () => {
  assert.equal(normalizePhoneE164('+351 912 345 678'), '351912345678');
  assert.equal(normalizePhoneE164('0044 7700 900123'), '447700900123');
  assert.equal(normalizePhoneE164('+1 919 555-0123'), '19195550123');
  assert.equal(normalizePhoneE164('99680-5226'), null);
  assert.equal(normalizePhoneE164('680-5226'), null);
});

test('variantes encontram registros brasileiros com e sem nono digito', () => {
  const variants = phoneSearchVariants('(84) 9680-5226');

  assert.ok(variants.includes('5584996805226'));
  assert.ok(variants.includes('84996805226'));
  assert.ok(variants.includes('558496805226'));
  assert.ok(variants.includes('8496805226'));
});
