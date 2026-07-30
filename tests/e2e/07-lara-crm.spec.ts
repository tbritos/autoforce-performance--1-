/**
 * QA — Lara + CRM: board, score, "Ver tudo" e status do WhatsApp.
 */
import { test, expect } from '@playwright/test';
import { assertNoError, goto } from './helpers';

const STAGES = [
  'NOVO',
  'QUALIFICACAO',
  'NUTRICAO',
  'AGUARDANDO_FOLLOWUP',
  'AGENDA_ENVIADA',
  'REUNIAO_AGENDADA',
  'SEM_INTERESSE',
  'TRANSFERIDO_HUMANO',
];

test.describe('Lara e CRM', () => {
  test('board exibe as oito etapas e o score proprio da Lara', async ({ page }) => {
    await goto(page, '/crm-lara');
    await assertNoError(page);
    await expect(page.getByTestId('crm-lara-board')).toBeVisible();

    for (const stage of STAGES) {
      await expect(page.getByTestId(`crm-lara-column-${stage}`)).toBeVisible();
    }

    const cards = page.getByTestId('crm-lara-card');
    for (let index = 0; index < await cards.count(); index++) {
      await expect(cards.nth(index)).toContainText(/score Lara (—|\d+)/);
    }
  });

  test('Ver tudo consulta o historico completo e renderiza todos os cards retornados', async ({ page }) => {
    await goto(page, '/crm-lara');
    const includeAll = page.getByTestId('crm-lara-include-all');
    const fullHistoryResponse = page.waitForResponse(response =>
      response.url().includes('/lead-hub/marketing-kanban?includeAll=true')
      && response.request().method() === 'GET',
    );

    await includeAll.check();
    await expect(includeAll).toBeChecked();
    expect((await fullHistoryResponse).status()).toBeLessThan(500);
    await expect(page.getByRole('button', { name: /Atualizar/i })).toBeEnabled();
    await assertNoError(page);

    for (const stage of STAGES) {
      const column = page.getByTestId(`crm-lara-column-${stage}`);
      const rendered = await column.getByTestId('crm-lara-card').count();
      const total = Number(await page.getByTestId(`crm-lara-total-${stage}`).textContent());
      expect(rendered, `quantidade renderizada em ${stage}`).toBe(total);
    }
  });

  test('perfil nao inventa status online do WhatsApp', async ({ page }) => {
    await goto(page, '/crm-lara');
    const firstCard = page.getByTestId('crm-lara-card').first();
    test.skip(await firstCard.count() === 0, 'CRM sem cards para abrir um perfil');

    await firstCard.click();
    await page.getByTestId('lead-whatsapp-tab').click();
    const status = page.getByTestId('lead-whatsapp-status');
    await expect(status).toBeVisible();
    await expect(status).not.toContainText(/online agora/i);
  });
});
