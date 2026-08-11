import { expect, test, type Page } from '@playwright/test';

const FRONTEND = 'http://localhost:5173';
const API = 'http://localhost:5001/api';
const authHeaders = { Authorization: 'Bearer dev-local-bypass' };
const isLocalRun = !process.env.BASE_URL || /localhost|127\.0\.0\.1/.test(process.env.BASE_URL);

async function enterLocal(page: Page) {
  await page.goto(`${FRONTEND}/automation`);
  const localLogin = page.getByRole('button', { name: /Entrar sem Google/i });
  if (await localLogin.isVisible().catch(() => false)) {
    await localLogin.click();
    await page.waitForFunction(
      () => window.localStorage.getItem('autoforce_token') === 'dev-local-bypass',
      undefined,
      { timeout: 10_000 },
    );
  }
  await page.goto(`${FRONTEND}/automation`);
}

test.describe('Prioridade de automações — localhost', () => {
  test.skip(!isLocalRun, 'Esta suíte usa exclusivamente os fixtures do PostgreSQL local.');

  test('API expõe classificação, prioridades e estados dos casos QA', async ({ request }) => {
    const response = await request.get(`${API}/automation-journeys`, { headers: authHeaders });
    expect(response.status()).toBe(200);
    const journeys = await response.json();
    const qa = journeys.filter((journey: any) => journey.name.startsWith('[QA Prioridade]'));
    expect(qa).toHaveLength(12);

    const ebook = qa.find((journey: any) => journey.name.endsWith('Ebook | Alta'));
    const audience = qa.find((journey: any) => journey.name.endsWith('Público da base'));
    const standalone = qa.find((journey: any) => journey.name.endsWith('Avulsa A'));
    const unlimited = qa.find((journey: any) => journey.name.endsWith('Alta sem interrupção'));
    expect(ebook).toMatchObject({ automationType: 'NURTURE', entryMode: 'TRIGGER', priority: 75 });
    expect(audience).toMatchObject({ automationType: 'NURTURE', entryMode: 'AUDIENCE', priority: 50 });
    expect(standalone).toMatchObject({ automationType: 'STANDALONE' });
    expect(unlimited).toMatchObject({ automationType: 'NURTURE', queueTtlHours: null });

    const groupedEmail = qa.find((journey: any) => journey.name.endsWith('Grupo Ebook | Email'));
    const groupedWhatsapp = qa.find((journey: any) => journey.name.endsWith('Grupo Ebook | WhatsApp'));
    expect(groupedEmail.nurtureGroup).toMatchObject({ name: '[QA Prioridade] Ebook multicanal', priority: 75, queueTtlHours: null });
    expect(groupedWhatsapp.nurtureGroupId).toBe(groupedEmail.nurtureGroupId);

    const groupsResponse = await request.get(`${API}/automation-journeys/nurture-groups`, { headers: authHeaders });
    expect(groupsResponse.status()).toBe(200);
    const groups = await groupsResponse.json();
    expect(groups.some((group: any) => group.name === '[QA Prioridade] Ebook multicanal' && group._count.journeys === 2)).toBe(true);

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

  test('interface arquiva, restaura e exclui definitivamente um fluxo sem histórico', async ({ page, request }) => {
    let journeyId = '';
    const journeyName = `[QA API temporário] arquivamento ${Date.now()}`;
    try {
      const createdResponse = await request.post(`${API}/automation-journeys`, {
        headers: authHeaders,
        data: {
          name: journeyName,
          status: 'DRAFT',
          automationType: 'STANDALONE',
          nodes: [],
          edges: [],
        },
      });
      expect(createdResponse.status()).toBe(201);
      journeyId = (await createdResponse.json()).id;

      await enterLocal(page);
      const row = page.getByTestId(`automation-journey-${journeyId}`);
      await expect(row).toBeVisible();

      await row.getByRole('button', { name: `Mais ações de ${journeyName}` }).click();
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('menuitem', { name: 'Arquivar fluxo' }).click();
      await expect(row.getByText('Arquivada', { exact: true })).toBeVisible();

      await page.getByRole('button', { name: /Arquivadas 1$/ }).click();
      await expect(row).toBeVisible();
      await page.getByRole('button', { name: /Todas \d+$/ }).click();

      await row.getByRole('button', { name: `Mais ações de ${journeyName}` }).click();
      await page.getByRole('menuitem', { name: 'Restaurar fluxo' }).click();
      await expect(row.getByText('Pausada', { exact: true })).toBeVisible();

      await row.getByRole('button', { name: `Mais ações de ${journeyName}` }).click();
      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('menuitem', { name: 'Excluir definitivamente' }).click();
      await expect(row).toHaveCount(0);
      journeyId = '';
    } finally {
      if (journeyId) await request.delete(`${API}/automation-journeys/${journeyId}`, { headers: authHeaders });
    }
  });

  test('API impede exclusão de fluxo com histórico e mantém suas execuções', async ({ request }) => {
    const response = await request.get(`${API}/automation-journeys`, { headers: authHeaders });
    expect(response.status()).toBe(200);
    const journeys = await response.json();
    const protectedJourney = journeys.find((journey: any) =>
      journey.name === '[QA Prioridade] Base | Baixa' && Number(journey._count?.executions ?? 0) > 0,
    );
    expect(protectedJourney).toBeTruthy();

    const deleteResponse = await request.delete(`${API}/automation-journeys/${protectedJourney.id}`, { headers: authHeaders });
    expect(deleteResponse.status()).toBe(409);
    expect(JSON.stringify(await deleteResponse.json())).toContain('deve ser arquivado');

    const executionsResponse = await request.get(`${API}/automation-journeys/${protectedJourney.id}/executions`, { headers: authHeaders });
    expect(executionsResponse.status()).toBe(200);
    expect((await executionsResponse.json()).length).toBeGreaterThan(0);
  });

  test('excluir integrantes preserva o grupo até a última automação', async ({ request }) => {
    const suffix = Date.now();
    let firstId = '';
    let secondId = '';

    const groupResponse = await request.post(`${API}/automation-journeys/nurture-groups`, {
      headers: authHeaders,
      data: {
        name: `[QA API temporário] grupo para exclusão ${suffix}`,
        priority: 50,
        canInterruptLowerPriority: true,
        queueTtlHours: null,
      },
    });
    expect(groupResponse.status()).toBe(201);
    const group = await groupResponse.json();

    try {
      for (const channel of ['Email', 'WhatsApp']) {
        const journeyResponse = await request.post(`${API}/automation-journeys`, {
          headers: authHeaders,
          data: {
            name: `[QA API temporário] grupo ${suffix} | ${channel}`,
            status: 'DRAFT',
            automationType: 'NURTURE',
            nurtureGroupId: group.id,
            nodes: [],
            edges: [],
          },
        });
        expect(journeyResponse.status()).toBe(201);
        const journey = await journeyResponse.json();
        if (!firstId) firstId = journey.id;
        else secondId = journey.id;
      }

      expect((await request.delete(`${API}/automation-journeys/${firstId}`, { headers: authHeaders })).status()).toBe(204);
      firstId = '';
      let groups = await (await request.get(`${API}/automation-journeys/nurture-groups`, { headers: authHeaders })).json();
      expect(groups.find((item: any) => item.id === group.id)?._count.journeys).toBe(1);

      expect((await request.delete(`${API}/automation-journeys/${secondId}`, { headers: authHeaders })).status()).toBe(204);
      secondId = '';
      groups = await (await request.get(`${API}/automation-journeys/nurture-groups`, { headers: authHeaders })).json();
      expect(groups.some((item: any) => item.id === group.id)).toBe(false);
    } finally {
      if (firstId) await request.delete(`${API}/automation-journeys/${firstId}`, { headers: authHeaders });
      if (secondId) await request.delete(`${API}/automation-journeys/${secondId}`, { headers: authHeaders });
    }
  });

  test('interface mostra classificação, prioridade e monitoramento', async ({ page, request }) => {
    const response = await request.get(`${API}/automation-journeys`, { headers: authHeaders });
    const journeys = await response.json();
    const ebook = journeys.find((journey: any) => journey.name === '[QA Prioridade] Ebook | Alta');
    const unlimited = journeys.find((journey: any) => journey.name === '[QA Prioridade] Alta sem interrupção');
    const groupedEmail = journeys.find((journey: any) => journey.name === '[QA Prioridade] Grupo Ebook | Email');
    expect(ebook).toBeTruthy();
    expect(unlimited).toBeTruthy();
    expect(groupedEmail).toBeTruthy();

    await enterLocal(page);
    await expect(page.getByText('[QA Prioridade] Ebook | Alta', { exact: true })).toBeVisible();
    const groupCard = page.getByTestId(`automation-group-${groupedEmail.nurtureGroupId}`);
    await expect(groupCard).toBeVisible();
    await expect(groupCard.getByText('[QA Prioridade] Ebook multicanal', { exact: true })).toBeVisible();
    await expect(groupCard.getByText('[QA Prioridade] Grupo Ebook | Email', { exact: true })).toBeVisible();
    await expect(groupCard.getByText('[QA Prioridade] Grupo Ebook | WhatsApp', { exact: true })).toBeVisible();
    await expect(groupCard.getByText('Email', { exact: true })).toBeVisible();
    await expect(groupCard.getByText('WhatsApp', { exact: true })).toBeVisible();
    const groupToggle = groupCard.getByRole('button').first();
    await expect(groupToggle).toHaveAttribute('aria-expanded', 'true');
    await groupToggle.click();
    await expect(groupToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(groupCard.getByText('[QA Prioridade] Grupo Ebook | Email', { exact: true })).toBeHidden();
    await groupToggle.click();
    await page.goto(`${FRONTEND}/automation/${ebook.id}`);
    const classification = page.getByRole('button', { name: /Fluxo de nutrição.*Alta/i });
    await expect(classification).toBeVisible();
    await classification.click();
    await expect(page.getByRole('heading', { name: 'Classificação e prioridade' })).toBeVisible();
    await expect(page.getByText('Gatilho específico', { exact: true })).toBeVisible();
    await expect(page.getByText('Pode interromper um grupo menos prioritário', { exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Sem prazo' })).toBeAttached();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await page.getByRole('button', { name: 'Execuções' }).click();
    await expect(page.getByText('Aguardando', { exact: true })).toBeVisible();
    await expect(page.getByText('[QA] 01 — Conversão interrompe base', { exact: true })).toBeVisible();

    await page.goto(`${FRONTEND}/automation/${unlimited.id}`);
    await page.getByRole('button', { name: /Fluxo de nutrição.*Alta/i }).click();
    await expect(page.locator('select').filter({ has: page.getByRole('option', { name: 'Sem prazo' }) })).toHaveValue('unlimited');

    await page.goto(`${FRONTEND}/automation/${groupedEmail.id}`);
    await expect(page.getByRole('button', { name: /Fluxo de nutrição.*Ebook multicanal.*Alta/i })).toBeVisible();
    await page.getByRole('button', { name: /Fluxo de nutrição.*Ebook multicanal.*Alta/i }).click();
    await expect(page.getByLabel('Grupo de nutrição')).toHaveValue(groupedEmail.nurtureGroupId);
    await expect(page.getByLabel('Validade na fila')).toHaveValue('unlimited');
  });
});
