import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSenderDomainAllowed,
  normalizeSenderEmail,
  SenderEmailValidationError,
} from './email-sender.service';

test('normaliza somente o domínio e preserva a parte livre antes do arroba', () => {
  assert.equal(
    normalizeSenderEmail('Lara.Marketing@UPDATES.AUTOFORCE.COM'),
    'Lara.Marketing@updates.autoforce.com'
  );
});

test('aceita remetente cujo domínio está habilitado no Resend', () => {
  assert.doesNotThrow(() => {
    assertSenderDomainAllowed(
      'qualquer.nome@updates.autoforce.com',
      ['updates.autoforce.com']
    );
  });
});

test('rejeita domínio que não está habilitado no Resend', () => {
  assert.throws(
    () => assertSenderDomainAllowed('marketing@dominio-invalido.com', ['updates.autoforce.com']),
    (error: unknown) => error instanceof SenderEmailValidationError && error.statusCode === 400
  );
});

test('rejeita endereço incompleto ou com mais de um arroba', () => {
  for (const email of ['marketing', '@updates.autoforce.com', 'a@b@updates.autoforce.com']) {
    assert.throws(() => normalizeSenderEmail(email), SenderEmailValidationError);
  }
});
