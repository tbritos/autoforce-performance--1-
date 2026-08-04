import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getGoogleAdsApiVersion,
  normalizeGoogleAdsCustomerId,
  requireGoogleAdsCustomerId,
} from '../config/google-ads';
import { OAuthService } from './oauth.service';
import { PlatformConnectionService } from './platform-connection.service';
import { fetchGoogleAdsCampaigns } from './google-ads.service';

test('Google Ads remove hifens dos IDs de cliente e MCC', () => {
  assert.equal(normalizeGoogleAdsCustomerId('123-456-7890'), '1234567890');
  assert.equal(normalizeGoogleAdsCustomerId(' 9876543210 '), '9876543210');
  assert.equal(requireGoogleAdsCustomerId('123-456-7890'), '1234567890');
  assert.throws(() => requireGoogleAdsCustomerId('12345'), /10 digitos/);
  assert.throws(() => requireGoogleAdsCustomerId('abc-456-7890'), /10 digitos/);
});

test('Google Ads usa v25 por padrao e rejeita versoes antigas', () => {
  const previous = process.env.GOOGLE_ADS_API_VERSION;
  try {
    delete process.env.GOOGLE_ADS_API_VERSION;
    assert.equal(getGoogleAdsApiVersion(), 'v25');

    process.env.GOOGLE_ADS_API_VERSION = 'v17';
    assert.throws(() => getGoogleAdsApiVersion(), /versao suportada/);
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_ADS_API_VERSION;
    else process.env.GOOGLE_ADS_API_VERSION = previous;
  }
});

test('Google Ads chama a API v25 com OAuth, developer token e MCC normalizada', async () => {
  const previousFetch = globalThis.fetch;
  const previousToken = OAuthService.getValidToken;
  const previousConnection = PlatformConnectionService.getConnection;
  const previousEnv = {
    apiVersion: process.env.GOOGLE_ADS_API_VERSION,
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID,
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  };

  let requestUrl = '';
  let requestInit: RequestInit | undefined;

  try {
    process.env.GOOGLE_ADS_API_VERSION = 'v25';
    process.env.GOOGLE_ADS_CUSTOMER_ID = '123-456-7890';
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'developer-token-test';
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = '987-654-3210';

    OAuthService.getValidToken = (async () => 'oauth-token-test') as typeof OAuthService.getValidToken;
    PlatformConnectionService.getConnection = (async () => null) as typeof PlatformConnectionService.getConnection;
    globalThis.fetch = (async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify([{
        results: [{
          campaign: { id: '42', name: 'Pesquisa local', status: 'ENABLED' },
          campaignBudget: { amountMicros: '25000000' },
          metrics: {
            costMicros: '12500000', impressions: '1000', clicks: '50',
            ctr: 0.05, averageCpc: '250000', conversions: 4,
          },
        }],
      }]), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;

    const campaigns = await fetchGoogleAdsCampaigns('2026-07-01', '2026-07-31');
    const headers = requestInit?.headers as Record<string, string>;
    const payload = JSON.parse(String(requestInit?.body)) as { query: string };

    assert.equal(requestUrl, 'https://googleads.googleapis.com/v25/customers/1234567890/googleAds:searchStream');
    assert.equal(requestInit?.method, 'POST');
    assert.equal(headers.Authorization, 'Bearer oauth-token-test');
    assert.equal(headers['developer-token'], 'developer-token-test');
    assert.equal(headers['login-customer-id'], '9876543210');
    assert.match(payload.query, /segments\.date BETWEEN '2026-07-01' AND '2026-07-31'/);
    assert.deepEqual(campaigns[0], {
      id: '42', name: 'Pesquisa local', status: 'ENABLED', budget: 25,
      spend: 12.5, impressions: 1000, clicks: 50, ctr: 5, cpc: 0.25,
      conversions: 4, startDate: '2026-07-01', endDate: '2026-07-31',
    });
  } finally {
    globalThis.fetch = previousFetch;
    OAuthService.getValidToken = previousToken;
    PlatformConnectionService.getConnection = previousConnection;

    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore('GOOGLE_ADS_API_VERSION', previousEnv.apiVersion);
    restore('GOOGLE_ADS_CUSTOMER_ID', previousEnv.customerId);
    restore('GOOGLE_ADS_DEVELOPER_TOKEN', previousEnv.developerToken);
    restore('GOOGLE_ADS_LOGIN_CUSTOMER_ID', previousEnv.loginCustomerId);
  }
});

test('Google Ads rejeita intervalo de data invalido antes de chamar a API', async () => {
  await assert.rejects(
    () => fetchGoogleAdsCampaigns('2026-07-31', '2026-07-01'),
    /data inicial.*posterior/i,
  );
  await assert.rejects(
    () => fetchGoogleAdsCampaigns("2026-07-01' OR true", '2026-07-31'),
    /Data inicial invalida/,
  );
});
