import { expect, test, type Page } from '@playwright/test';
import { assertNoError } from './helpers';

const API = 'http://localhost:5001/api';
const authHeaders = { Authorization: 'Bearer dev-local-bypass' };
const isLocalRun = !process.env.BASE_URL || /localhost|127\.0\.0\.1/.test(process.env.BASE_URL);

async function enterLocal(page: Page) {
  await page.goto('http://localhost:5173/ai-agents');
  const localLogin = page.getByRole('button', { name: /Entrar sem Google/i });
  if (await localLogin.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await localLogin.click();
    await page.waitForFunction(() => window.localStorage.getItem('autoforce_token') === 'dev-local-bypass');
    await page.goto('http://localhost:5173/ai-agents');
  }
  await page.waitForLoadState('networkidle');
}

test.describe('Saúde do número de WhatsApp — localhost', () => {
  test.skip(!isLocalRun, 'Esta suíte valida exclusivamente o ambiente local.');

  test('API entrega métricas, série histórica e detalhamento dos erros', async ({ request }) => {
    const response = await request.get(`${API}/whatsapp/health?days=30`, { headers: authHeaders });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({
      period: expect.objectContaining({ days: 30 }),
      health: expect.objectContaining({
        level: expect.stringMatching(/^(healthy|attention|critical|no_data)$/),
        label: expect.any(String),
      }),
      metrics: expect.objectContaining({
        totalTemplates: expect.any(Number),
        delivered: expect.any(Number),
        read: expect.any(Number),
        failed: expect.any(Number),
        errorRate: expect.any(Number),
      }),
      daily: expect.any(Array),
      errors: expect.any(Array),
      byNumber: expect.any(Array),
      recentFailures: expect.any(Array),
    }));
    expect(body.daily).toHaveLength(30);
  });

  test('tela mostra indicadores, gráfico, erros e filtros', async ({ page }) => {
    await page.route('**/api/whatsapp/numbers', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'meta-number-qa',
        display_phone_number: '+55 84 99999-0000',
        verified_name: 'AutoForce QA',
        quality_rating: 'GREEN',
        label: 'Comercial QA',
        isRegistered: true,
      }]),
    }));
    await enterLocal(page);
    await page.getByRole('button', { name: 'Saúde do número', exact: true }).click();

    await expect(page.getByText('Quais erros estão acontecendo', { exact: true })).toBeVisible();
    await expect(page.getByText('Evolução dos envios', { exact: true })).toBeVisible();
    await expect(page.getByText('Qualidade Meta', { exact: true })).toBeVisible();
    await expect(page.getByText('Templates enviados', { exact: true })).toBeVisible();
    await expect(page.getByText('Taxa de entrega', { exact: true })).toBeVisible();
    await expect(page.getByText('Taxa de leitura', { exact: true })).toBeVisible();
    await expect(page.getByText('Todas as métricas consideram somente o número selecionado.', { exact: true })).toBeVisible();
    const number = page.getByLabel('Número do WhatsApp');
    await expect(number).toHaveValue('meta-number-qa');
    await expect(number.locator('option')).toHaveCount(1);
    const noErrors = page.getByText('Nenhum erro no período', { exact: true });
    if (await noErrors.isVisible().catch(() => false)) {
      await expect(noErrors).toBeVisible();
    } else {
      await expect(page.getByRole('columnheader', { name: 'Código' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Tipo' })).toBeVisible();
    }

    const period = page.getByLabel('Período da saúde');
    await expect(period).toHaveValue('30');
    await period.selectOption('7');
    await expect(period).toHaveValue('7');

    await assertNoError(page);
  });
});
