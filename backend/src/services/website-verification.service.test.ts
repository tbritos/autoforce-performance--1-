import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isBlockedIp,
  validateAndNormalizeUrl,
} from './website-verification.service';

test('navegador aceita dominio sem protocolo e remove credenciais', () => {
  assert.equal(validateAndNormalizeUrl('exemplo.com.br/estoque').toString(), 'https://exemplo.com.br/estoque');
  assert.equal(validateAndNormalizeUrl('https://usuario:senha@exemplo.com.br/').toString(), 'https://exemplo.com.br/');
  assert.throws(() => validateAndNormalizeUrl('ftp://exemplo.com.br/'));
});

test('navegador bloqueia enderecos internos IPv4 e IPv6', () => {
  assert.equal(isBlockedIp('127.0.0.1'), true);
  assert.equal(isBlockedIp('192.168.1.10'), true);
  assert.equal(isBlockedIp('::1'), true);
  assert.equal(isBlockedIp('8.8.8.8'), false);
});
