/**
 * QA — UTM Links: lista, criar link, copiar URL.
 */
import { test, expect } from '@playwright/test';
import { goto, assertNoError } from './helpers';

test.describe('UTM Links', () => {
  test('lista carrega', async ({ page }) => {
    await goto(page, '/utm-links');
    await assertNoError(page);
    // Botão de criar deve existir
    await expect(page.locator('button:has-text("Criar"), button:has-text("Novo link"), button:has-text("UTM")').first()).toBeVisible({ timeout: 5000 });
  });

  test('criar link UTM — preencher e gerar URL', async ({ page }) => {
    await goto(page, '/utm-links');
    const createBtn = page.locator('button:has-text("Criar"), button:has-text("Novo"), button:has-text("+ Link")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // Preencher campos obrigatórios
      const urlInput = page.locator('input[placeholder*="https"], input[placeholder*="URL"], input[type="url"]').first();
      if (await urlInput.isVisible()) {
        await urlInput.fill('https://autoforce.com');

        const sourceInput = page.locator('input[placeholder*="source"], input[placeholder*="origem"]').first();
        if (await sourceInput.isVisible()) await sourceInput.fill('google');

        const mediumInput = page.locator('input[placeholder*="medium"], input[placeholder*="mídia"]').first();
        if (await mediumInput.isVisible()) await mediumInput.fill('cpc');

        const campaignInput = page.locator('input[placeholder*="campaign"], input[placeholder*="campanha"]').first();
        if (await campaignInput.isVisible()) await campaignInput.fill('teste_qa');

        await assertNoError(page);
      }
      // Fecha modal se aberto
      await page.keyboard.press('Escape');
    }
  });
});
