import { expect, test, type Page } from '@playwright/test';

const FRONTEND = 'http://localhost:5173';
const API = 'http://localhost:5001/api';
const authHeaders = { Authorization: 'Bearer dev-local-bypass' };
const isLocalRun = !process.env.BASE_URL || /localhost|127\.0\.0\.1/.test(process.env.BASE_URL);

async function enterLocal(page: Page) {
  await page.goto(`${FRONTEND}/automation`);
  const localLogin = page.getByRole('button', { name: /Entrar sem Google/i });
  if (await localLogin.isVisible().catch(() => false)) await localLogin.click();
  await page.goto(`${FRONTEND}/automation`);
}

test.describe('Prioridade de automações — localhost', () => {
  test.skip(!isLocalRun, 'Esta suíte usa exclusivamente os fixtures do PostgreSQL local.');

  test('API expõe classificação, prioridades e estados dos casos QA', async ({ request }) => {
    const response = await request.get(`${API}/automation-journeys`, { headers: authHeaders });
    expect(response.status()).toBe(200);
    const journeys = await response.json();
    const qa = journeys.filter((journey: any) => journey.name.startsWith('[QA Prioridade]'));
    expect(qa).toHaveLength(10);

    const ebook = qa.find((journey: any) => journey.name.endsWith('Ebook | Alta'));
    const audience = qa.find((journey: any) => journey.name.endsWith('Público da base'));
    const standalone = qa.find((journey: any) => journey.name.endsWith('Avulsa A'));
    const unlimited = qa.find((journey: any) => journey.name.endsWith('Alta sem interrupção'));
    expect(ebook).toMatchObject({ automationType: 'NURTURE', entryMode: 'TRIGGER', priority: 75 });
    expect(audience).toMatchObject({ automationType: 'NURTURE', entryMode: 'AUDIENCE', priority: 50 });
    expect(standalone).toMatchObject({ automationType: 'STANDALONE' });
    expect(unlimited).toMatchObject({ automationType: 'NURTURE', queueTtlHours: null });

    const base = qa.find((journey: any) => journey.name.endsWith('Base | Baixa'));
    const [statsResponse, executionsResponse] = await Promise.all([
      request.get(`${API}/automation-journeys/${base.id}/execution-stats`, { headers: authHeaders }),
      request.get(`${API}/automation-journeys/${base.id}/executions`, { headers: authHeaders }),
    ]);
    expect(statsResponse.status()).toBe(200);
    expect(executionsResponse.status()).toBe(200);
    const stats = await statsResponse.json();
    const executions = await executionsResponse.json();
    expect(stats.total).toBe(4);
    expect(stats.cancelled).toBeGreaterThanOrEqual(2);
    expect(executions.some((item: any) => item.status === 'cancelled')).toBe(true);
    expect(executions.some((item: any) => item.status === 'waiting')).toBe(true);
  });

  test('API bloqueia ativação sem classificação e permite após classificar', async ({ request }) => {
    let journeyId = '';
    try {
      const createdResponse = await request.post(`${API}/automation-journeys`, {
        headers: authHeaders,
        data: { name: '[QA API temporário] validação de classificação', status: 'DRAFT', nodes: [], edges: [] },
      });
      expect(createdResponse.status()).toBe(201);
      journeyId = (await createdResponse.json()).id;

      const invalidResponse = await request.patch(`${API}/automation-journeys/${journeyId}`, {
        headers: authHeaders,
        data: { status: 'active' },
      });
      expect(invalidResponse.ok()).toBe(false);
      expect(JSON.stringify(await invalidResponse.json())).toContain('Classifique a automação');

      const validResponse = await request.patch(`${API}/automation-journeys/${journeyId}`, {
        headers: authHeaders,
        data: { status: 'ACTIVE', automationType: 'STANDALONE' },
      });
      expect(validResponse.status()).toBe(200);
      expect(await validResponse.json()).toMatchObject({ status: 'ACTIVE', isActive: true, automationType: 'STANDALONE' });
    } finally {
      if (journeyId) await request.delete(`${API}/automation-journeys/${journeyId}`, { headers: authHeaders });
    }
  });

  test('interface mostra classificação, prioridade e monitoramento', async ({ page, request }) => {
    const response = await request.get(`${API}/automation-journeys`, { headers: authHeaders });
    const journeys = await response.json();
    const ebook = journeys.find((journey: any) => journey.name === '[QA Prioridade] Ebook | Alta');
    const unlimited = journeys.find((journey: any) => journey.name === '[QA Prioridade] Alta sem interrupção');
    expect(ebook).toBeTruthy();
    expect(unlimited).toBeTruthy();

    await enterLocal(page);
    await expect(page.getByText('[QA Prioridade] Ebook | Alta', { exact: true })).toBeVisible();
    await page.goto(`${FRONTEND}/automation/${ebook.id}`);
    const classification = page.getByRole('button', { name: /Fluxo de nutrição.*Alta/i });
    await expect(classification).toBeVisible();
    await classification.click();
    await expect(page.getByRole('heading', { name: 'Classificação e prioridade' })).toBeVisible();
    await expect(page.getByText('Gatilho específico', { exact: true })).toBeVisible();
    await expect(page.getByText('Pode interromper uma nutrição menos prioritária', { exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Sem prazo' })).toBeAttached();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await page.getByRole('button', { name: 'Execuções' }).click();
    await expect(page.getByText('Aguardando', { exact: true })).toBeVisible();
    await expect(page.getByText('[QA] 01 — Conversão interrompe base', { exact: true })).toBeVisible();

    await page.goto(`${FRONTEND}/automation/${unlimited.id}`);
    await page.getByRole('button', { name: /Fluxo de nutrição.*Alta/i }).click();
    await expect(page.locator('select').filter({ has: page.getByRole('option', { name: 'Sem prazo' }) })).toHaveValue('unlimited');
  });
});
