/**
 * QA — Automações: lista, criar jornada, adicionar blocos, salvar.
 */
import { test, expect } from '@playwright/test';
import { goto, assertNoError } from './helpers';

async function openNewJourney(page: import('@playwright/test').Page) {
  await goto(page, '/automation');
  const newBtn = page.locator('main').getByRole('button', { name: 'Automação', exact: true });
  await expect(newBtn).toBeVisible();
  await newBtn.click();
  await expect(page).toHaveURL(/\/automation\/new$/);
}

test.describe('Automações', () => {
  test('lista de jornadas carrega', async ({ page }) => {
    await goto(page, '/automation');
    await assertNoError(page);
    await expect(page.getByRole('heading', { name: 'Automação', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Buscar regra por nome ou campo...')).toBeVisible();
  });

  test('cria nova jornada e cancela', async ({ page }) => {
    await openNewJourney(page);
    // Canvas deve estar visível
    await expect(page.getByText('Blocos', { exact: true })).toBeVisible();
    await expect(page.getByText('Entrada', { exact: true })).toBeVisible();
    await assertNoError(page);
    // Volta para a lista
    await page.locator('main header button').first().click();
    await expect(page).toHaveURL(/\/automation$/);
  });

  test('editor de jornada mostra todos os blocos', async ({ page }) => {
    await openNewJourney(page);

    const blocks = ['Condição', 'Esperar', 'Ação interna', 'RD Station', 'WhatsApp', 'Pipedrive'];
    for (const block of blocks) {
      await expect(page.getByText(block, { exact: true }).first()).toBeVisible();
    }
  });

  test('drag de bloco para canvas funciona', async ({ page }) => {
    await openNewJourney(page);

    // Arrasta bloco "Esperar" para o canvas
    const block = page.getByText('Esperar', { exact: true }).first();
    const canvas = page.locator('.react-flow').first();
    await block.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    await expect(canvas.getByText('Esperar', { exact: true })).toBeVisible();
    await assertNoError(page);
  });

  test('botão Testar abre modal de busca', async ({ page }) => {
    await goto(page, '/automation');
    const editBtn = page.getByTitle('Editar fluxo').first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    await expect(page).toHaveURL(/\/automation\/(?!new)[^/]+$/);
    await page.getByRole('button', { name: 'Testar', exact: true }).click();
    await expect(page.getByText('Testar automação', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder(/lead/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  });
});
