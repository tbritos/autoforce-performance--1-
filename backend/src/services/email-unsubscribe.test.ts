import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildUnsubscribeUrl,
  createUnsubscribeToken,
  maskUnsubscribeEmail,
  normalizeUnsubscribeEmail,
  readUnsubscribeToken,
} from './email-unsubscribe.service';

function withEnv(run: () => void): void {
  const previousSecret = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  const previousFrontend = process.env.FRONTEND_URL;
  try {
    process.env.EMAIL_UNSUBSCRIBE_SECRET = 'segredo-de-teste-com-tamanho-suficiente';
    process.env.FRONTEND_URL = 'https://app.exemplo.com/';
    run();
  } finally {
    if (previousSecret === undefined) delete process.env.EMAIL_UNSUBSCRIBE_SECRET;
    else process.env.EMAIL_UNSUBSCRIBE_SECRET = previousSecret;
    if (previousFrontend === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = previousFrontend;
  }
}

test('token de desinscrição protege e recupera o email normalizado', () => withEnv(() => {
  const token = createUnsubscribeToken('  Pessoa@Exemplo.com ');
  assert.equal(readUnsubscribeToken(token), 'pessoa@exemplo.com');
  assert.equal(token.includes('pessoa'), false);
  assert.equal(token.includes('@'), false);
}));

test('token adulterado é rejeitado', () => withEnv(() => {
  const token = createUnsubscribeToken('pessoa@exemplo.com');
  const replacement = token.at(-1) === 'A' ? 'B' : 'A';
  assert.throws(() => readUnsubscribeToken(`${token.slice(0, -1)}${replacement}`), /inválido/);
}));

test('URL pública e máscara não expõem o email completo', () => withEnv(() => {
  const url = buildUnsubscribeUrl('pessoa@exemplo.com');
  assert.match(url, /^https:\/\/app\.exemplo\.com\/unsubscribe\?token=/);
  assert.equal(url.includes('pessoa@exemplo.com'), false);
  assert.equal(maskUnsubscribeEmail('pessoa@exemplo.com'), 'pe****@exemplo.com');
  assert.equal(normalizeUnsubscribeEmail(' Pessoa@Exemplo.com '), 'pessoa@exemplo.com');
}));
