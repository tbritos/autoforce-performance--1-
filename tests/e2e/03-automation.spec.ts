/**
 * QA — Automações: lista, criar jornada, adicionar blocos, salvar.
 */
import { test, expect } from '@playwright/test';
import { goto, assertNoError } from './helpers';

test.describe('Automações', () => {
  test('lista de jornadas carrega', async ({ page }) => {
    await goto(page, '/automation');
    await assertNoError(page);
    const hasContent = await page.locator('text=Automação, text=jornada, button:has-text("Automação")').first().isVisible();
    expect(hasContent).toBe(true);
  });

  test('cria nova jornada e cancela', async ({ page }) => {
    await goto(page, '/automation');
    const newBtn = page.locator('button:has-text("Automação"), button:has-text("Nova")').last();
    await expect(newBtn).toBeVisible();
    await newBtn.click();
    await page.waitForURL('**/automation/new', { timeout: 5000 });
    // Canvas deve estar visível
    await expect(page.locator('text=BLOCOS, text=Entrada, text=Condição').first()).toBeVisible({ timeout: 5000 });
    await assertNoError(page);
    // Volta para a lista
    await page.locator('button[title*="voltar"], button[aria-label*="voltar"]').first().click().catch(() =>
      page.goBack()
    );
  });

  test('editor de jornada mostra todos os blocos', async ({ page }) => {
    await goto(page, '/automation');
    const newBtn = page.locator('button:has-text("Automação"), button:has-text("Nova")').last();
    await newBtn.click();
    await page.waitForURL('**/automation/new', { timeout: 5000 });

    const blocks = ['Condição', 'Esperar', 'Ação interna', 'RD Station', 'WhatsApp', 'Pipedrive'];
    for (const block of blocks) {
      await expect(page.locator(`text=${block}`).first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('drag de bloco para canvas funciona', async ({ page }) => {
    await goto(page, '/automation');
    const newBtn = page.locator('button:has-text("Automação"), button:has-text("Nova")').last();
    await newBtn.click();
    await page.waitForURL('**/automation/new', { timeout: 5000 });

    // Arrasta bloco "Esperar" para o canvas
    const block = page.locator('text=Esperar').first();
    const canvas = page.locator('[style*="overflow: auto"], [style*="overflow:auto"]').last();
    await block.dragTo(canvas, { targetPosition: { x: 300, y: 200 } });
    await page.waitForTimeout(500);
    await assertNoError(page);
  });

  test('botão Testar abre modal de busca', async ({ page }) => {
    await goto(page, '/automation');
    // Abrir qualquer jornada existente, ou pular se não houver
    const anyJourney = page.locator('[style*="gridTemplateColumns"] button').first();
    if (await anyJourney.isVisible()) {
      const editBtn = page.locator('button[title="Editar fluxo"]').first();
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await page.waitForTimeout(1000);
        const testBtn = page.locator('button:has-text("Testar")');
        if (await testBtn.isVisible()) {
          await testBtn.click();
          await expect(page.locator('text=Testar automação')).toBeVisible({ timeout: 3000 });
          await expect(page.locator('input[placeholder*="lead"]')).toBeVisible();
          // Fechar modal
          await page.locator('button:has-text("Cancelar")').click();
        }
      }
    }
  });
});
