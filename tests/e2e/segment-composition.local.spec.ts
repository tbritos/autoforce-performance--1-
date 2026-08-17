import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:5001/api';
const authHeaders = { Authorization: 'Bearer dev-local-bypass' };
const isLocalRun = !process.env.BASE_URL || /localhost|127\.0\.0\.1/.test(process.env.BASE_URL);
const prefix = `[QA Segmentos ${Date.now()}]`;

async function enterSegments(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('autoforce_token', 'dev-local-bypass');
    localStorage.setItem('autoforce_user', JSON.stringify({
      email: 'dev@autoforce.com', name: 'Dev Local', avatar: '', role: 'AutoForce Member',
    }));
  });
  await page.goto('/leads');
  await page.getByRole('button', { name: 'Segmentos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Segmentos de Leads' })).toBeVisible();
}

async function cleanup(request: APIRequestContext) {
  const response = await request.get(`${API}/segments`, { headers: authHeaders });
  if (!response.ok()) return;
  const segments = await response.json() as Array<{ id: string; name: string }>;
  const fixtures = segments.filter(segment => segment.name.startsWith(prefix));
  const composed = fixtures.filter(segment => segment.name.includes('Todos menos'));
  const exclusions = fixtures.filter(segment => segment.name.includes('Exclusão'));
  for (const segment of [...composed, ...exclusions]) {
    await request.delete(`${API}/segments/${segment.id}`, { headers: authHeaders });
  }
}

test.describe('Composição de segmentações — localhost', () => {
  test.skip(!isLocalRun, 'Esta suíte valida exclusivamente o banco local.');

  test.afterEach(async ({ request }) => cleanup(request));

  test('cria todos os leads menos uma segmentação salva', async ({ page, request }) => {
    const exclusionName = `${prefix} Exclusão`;
    const composedName = `${prefix} Todos menos`;
    const exclusionResponse = await request.post(`${API}/segments`, {
      headers: authHeaders,
      data: {
        name: exclusionName,
        description: 'Clientes que não devem receber este fluxo.',
        color: '#ef4444',
        rules: {
          logic: 'AND',
          conditions: [{ id: 'clientes', field: 'status', operator: 'in', value: ['CLIENT'] }],
        },
      },
    });
    expect(exclusionResponse.status()).toBe(201);
    const exclusion = await exclusionResponse.json() as { id: string };

    await enterSegments(page);
    await page.getByRole('button', { name: 'Novo Segmento' }).click();
    await page.getByPlaceholder('Ex: Leads quentes do Meta').fill(composedName);
    await page.getByRole('button', { name: 'Adicionar condição' }).click();
    await page.getByLabel('Campo da condição 1').selectOption('segment');
    await page.getByLabel('Operador da condição 1').selectOption('not_in_segment');
    await page.getByLabel('Segmentação da condição').selectOption(exclusion.id);
    await page.getByRole('button', { name: 'Criar segmento' }).click();

    await expect(page.getByText(composedName, { exact: true })).toBeVisible();

    const listResponse = await request.get(`${API}/segments`, { headers: authHeaders });
    expect(listResponse.status()).toBe(200);
    const segments = await listResponse.json() as Array<{ name: string; rules: { conditions: Array<Record<string, unknown>> } }>;
    const composed = segments.find(segment => segment.name === composedName);
    expect(composed?.rules.conditions).toEqual([
      expect.objectContaining({
        field: 'segment',
        operator: 'not_in_segment',
        value: exclusion.id,
      }),
    ]);
  });
});
