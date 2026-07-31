import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { buildInstagramWebhookSubscriptionUrl, OAuthService } from './oauth.service';

async function withInstagramEnv<T>(run: () => T | Promise<T>): Promise<T> {
  const previousId = process.env.INSTAGRAM_APP_ID;
  const previousSecret = process.env.INSTAGRAM_APP_SECRET;
  process.env.INSTAGRAM_APP_ID = 'instagram-app-id-test';
  process.env.INSTAGRAM_APP_SECRET = 'instagram-app-secret-test';
  try {
    return await run();
  } finally {
    if (previousId === undefined) delete process.env.INSTAGRAM_APP_ID;
    else process.env.INSTAGRAM_APP_ID = previousId;
    if (previousSecret === undefined) delete process.env.INSTAGRAM_APP_SECRET;
    else process.env.INSTAGRAM_APP_SECRET = previousSecret;
  }
}

async function withInstagramAliasEnv<T>(run: () => T | Promise<T>): Promise<T> {
  const names = [
    'INSTAGRAM_APP_ID',
    'INSTAGRAM_APP_SECRET',
    'Instagram_App_ID',
    'Instagram_App_Secret',
  ] as const;
  const previous = new Map(names.map(name => [name, process.env[name]]));
  delete process.env.INSTAGRAM_APP_ID;
  delete process.env.INSTAGRAM_APP_SECRET;
  process.env.Instagram_App_ID = 'instagram-alias-id-test';
  process.env.Instagram_App_Secret = 'instagram-alias-secret-test';
  try {
    return await run();
  } finally {
    for (const name of names) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test('OAuth do Instagram usa login oficial, escopos mínimos e state assinado', async () => {
  await withInstagramEnv(() => {
    const authUrl = new URL(OAuthService.getAuthUrl('INSTAGRAM'));
    assert.equal(authUrl.origin, 'https://www.instagram.com');
    assert.equal(authUrl.pathname, '/oauth/authorize');
    assert.equal(authUrl.searchParams.get('client_id'), 'instagram-app-id-test');
    assert.equal(authUrl.searchParams.get('response_type'), 'code');
    assert.equal(authUrl.searchParams.get('enable_fb_login'), '0');
    assert.equal(authUrl.searchParams.get('force_authentication'), '1');

    const scopes = new Set((authUrl.searchParams.get('scope') || '').split(','));
    assert.deepEqual(scopes, new Set([
      'instagram_business_basic',
      'instagram_business_manage_messages',
      'instagram_business_manage_comments',
    ]));

    const state = authUrl.searchParams.get('state') || '';
    const [payload, signature] = state.split('.');
    assert.ok(payload);
    assert.ok(signature);
    const expected = crypto
      .createHmac('sha256', 'instagram-app-secret-test')
      .update(payload)
      .digest('base64url');
    assert.equal(signature, expected);

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      platform: string;
      expiresAt: number;
    };
    assert.equal(decoded.platform, 'INSTAGRAM');
    assert.ok(decoded.expiresAt > Date.now());
  });
});

test('callback do Instagram rejeita state adulterado antes de chamar a Meta', async () => {
  await withInstagramEnv(async () => {
    await assert.rejects(
      OAuthService.handleCallback('INSTAGRAM', 'codigo-nao-utilizado', 'payload.assinatura-invalida'),
      /State OAuth inválido ou expirado/,
    );
  });
});

test('OAuth do Instagram aceita os nomes de variavel cadastrados no Railway', async () => {
  await withInstagramAliasEnv(() => {
    const authUrl = new URL(OAuthService.getAuthUrl('INSTAGRAM'));
    assert.equal(authUrl.searchParams.get('client_id'), 'instagram-alias-id-test');

    const state = authUrl.searchParams.get('state') || '';
    const [payload, signature] = state.split('.');
    const expected = crypto
      .createHmac('sha256', 'instagram-alias-secret-test')
      .update(payload)
      .digest('base64url');
    assert.equal(signature, expected);
  });
});

test('assinatura de eventos usa a conta profissional e o campo messages', () => {
  const url = buildInstagramWebhookSubscriptionUrl('17841400012345678', 'v24.0');
  assert.equal(url.origin, 'https://graph.instagram.com');
  assert.equal(url.pathname, '/v24.0/17841400012345678/subscribed_apps');
  assert.equal(url.searchParams.get('subscribed_fields'), 'messages');
});
