import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { parseInstagramDataDeletionSignedRequest } from './instagram-data-deletion.service';

function withInstagramSecret<T>(run: () => T): T {
  const previousCanonical = process.env.INSTAGRAM_APP_SECRET;
  const previousAlias = process.env.Instagram_App_Secret;
  delete process.env.INSTAGRAM_APP_SECRET;
  process.env.Instagram_App_Secret = 'segredo-exclusao-teste';
  try {
    return run();
  } finally {
    if (previousCanonical === undefined) delete process.env.INSTAGRAM_APP_SECRET;
    else process.env.INSTAGRAM_APP_SECRET = previousCanonical;
    if (previousAlias === undefined) delete process.env.Instagram_App_Secret;
    else process.env.Instagram_App_Secret = previousAlias;
  }
}

function signedRequest(payload: Record<string, unknown>): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', 'segredo-exclusao-teste')
    .update(encodedPayload)
    .digest('base64url');
  return `${signature}.${encodedPayload}`;
}

test('pedido de exclusão da Meta aceita somente signed_request autêntico', () => {
  withInstagramSecret(() => {
    const valid = signedRequest({ algorithm: 'HMAC-SHA256', user_id: 'ig-user-123', issued_at: 1_720_000_000 });
    assert.deepEqual(parseInstagramDataDeletionSignedRequest(valid), { userId: 'ig-user-123' });
    assert.throws(
      () => parseInstagramDataDeletionSignedRequest(`assinatura-invalida.${valid.split('.')[1]}`),
      /assinatura de exclusão inválida/,
    );
  });
});

test('pedido de exclusão rejeita algoritmo diferente ou user_id ausente', () => {
  withInstagramSecret(() => {
    assert.throws(
      () => parseInstagramDataDeletionSignedRequest(signedRequest({ algorithm: 'HMAC-SHA1', user_id: '123' })),
      /algoritmo de exclusão inválido/,
    );
    assert.throws(
      () => parseInstagramDataDeletionSignedRequest(signedRequest({ algorithm: 'HMAC-SHA256' })),
      /user_id ausente/,
    );
  });
});
