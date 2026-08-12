import { expect, test, type Page } from '@playwright/test';
import { assertNoError } from './helpers';

const API = 'http://localhost:5001/api';
const authHeaders = { Authorization: 'Bearer dev-local-bypass' };
const isLocalRun = !process.env.BASE_URL || /localhost|127\.0\.0\.1/.test(process.env.BASE_URL);

async function enterLocal(page: Page, path: string) {
  await page.goto(`http://localhost:5173${path}`);
  const localLogin = page.getByRole('button', { name: /Entrar sem Google/i });
  if (await localLogin.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await localLogin.click();
    await page.waitForFunction(() => window.localStorage.getItem('autoforce_token') === 'dev-local-bypass');
    await page.goto(`http://localhost:5173${path}`);
  }
  await page.waitForLoadState('networkidle');
}

test.describe('Descadastros de e-mail — localhost', () => {
  test.skip(!isLocalRun, 'Esta suíte valida exclusivamente o banco local.');

  test('API lista descadastros com paginação, resumo e origens', async ({ request }) => {
    const response = await request.get(`${API}/emails/suppressions?page=1&pageSize=20`, { headers: authHeaders });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({
      items: expect.any(Array),
      page: 1,
      pageSize: 20,
      total: expect.any(Number),
      totalPages: expect.any(Number),
      sources: expect.any(Array),
      scopes: expect.any(Array),
      summary: expect.objectContaining({
        total: expect.any(Number),
        unsubscribe: expect.any(Number),
        complaint: expect.any(Number),
        last30Days: expect.any(Number),
      }),
    }));
  });

  test('tela permite consultar e exportar a lista protegida', async ({ page }) => {
    await enterLocal(page, '/emails');
    await page.getByRole('button', { name: 'Descadastros', exact: true }).click();
    await expect(page).toHaveURL(/\/emails\/unsubscribes$/);
    await expect(page.getByRole('heading', { name: 'Descadastros de e-mail' })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar por nome, e-mail ou empresa...')).toBeVisible();
    await expect(page.getByLabel('Filtrar por origem')).toBeVisible();
    await expect(page.getByLabel('Filtrar por categoria')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'E-mail' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Categoria' })).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^descadastros-email-\d{4}-\d{2}-\d{2}\.csv$/);
    await assertNoError(page);
  });

  test('segmento automático da newsletter fica disponível e protegido contra edição', async ({ request, page }) => {
    const response = await request.get(`${API}/segments`, { headers: authHeaders });
    expect(response.status()).toBe(200);
    const segments = await response.json();
    expect(segments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: '__newsletter_subscribers__',
        name: 'Newsletter — Inscritos',
        system: true,
        leadCount: expect.any(Number),
      }),
    ]));

    await enterLocal(page, '/leads');
    await page.getByRole('button', { name: 'Segmentos', exact: true }).click();
    const card = page.getByText('Newsletter — Inscritos').locator('xpath=ancestor::div[contains(@style, "flex-direction: column")][1]');
    await expect(page.getByText('Newsletter — Inscritos')).toBeVisible();
    await expect(page.getByText('AUTOMÁTICO')).toBeVisible();
    await expect(card.getByTitle('Editar')).toHaveCount(0);
    await expect(card.getByTitle('Excluir')).toHaveCount(0);
    await assertNoError(page);
  });

  test('novo disparo exige a classificação da comunicação', async ({ page }) => {
    await enterLocal(page, '/disparos');
    await page.getByRole('button', { name: 'Novo Disparo', exact: true }).click();
    const communicationType = page.getByLabel('Tipo de comunicação');
    await expect(communicationType).toBeVisible();
    await expect(communicationType.locator('option')).toHaveText([
      'Selecione o tipo...',
      'Newsletter — respeita os descadastros da newsletter',
      'Marketing e nutrição — preferência separada',
      'Operacional — propostas, reuniões e avisos necessários',
    ]);
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    await assertNoError(page);
  });
});
