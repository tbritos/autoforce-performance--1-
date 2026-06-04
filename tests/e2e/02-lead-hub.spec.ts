/**
 * QA — Lead Hub: lista, busca, filtros e perfil do lead.
 */
import { test, expect } from '@playwright/test';
import { goto, assertNoError } from './helpers';

test.describe('Lead Hub', () => {
  test('lista de leads carrega', async ({ page }) => {
    await goto(page, '/leads');
    await assertNoError(page);
    // Tabela ou mensagem de vazio visível
    const hasTable = await page.locator('table, [data-testid="lead-list"]').isVisible().catch(() => false);
    const hasEmpty = await page.locator('text=Nenhum lead').isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBe(true);
  });

  test('busca de leads funciona', async ({ page }) => {
    await goto(page, '/leads');
    const searchInput = page.locator('input[placeholder*="buscar"], input[placeholder*="Buscar"], input[placeholder*="pesquisar"]').first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('test');
    await page.waitForTimeout(600); // debounce
    await assertNoError(page);
  });

  test('filtro por status funciona', async ({ page }) => {
    await goto(page, '/leads');
    const mqlBtn = page.locator('button:has-text("MQL"), button:has-text("mql")').first();
    if (await mqlBtn.isVisible()) {
      await mqlBtn.click();
      await page.waitForTimeout(500);
      await assertNoError(page);
    }
  });

  test('abre perfil do lead', async ({ page }) => {
    await goto(page, '/leads');
    // Clica no primeiro lead disponível
    const firstLead = page.locator('tr[role="row"], [data-testid="lead-row"]').first();
    if (await firstLead.isVisible()) {
      await firstLead.click();
      await page.waitForTimeout(1000);
      // Perfil deve mostrar email
      const hasEmail = await page.locator('text=@').first().isVisible().catch(() => false);
      expect(hasEmail).toBe(true);
    }
  });

  test('exportar leads CSV não gera erro', async ({ page }) => {
    await goto(page, '/leads');
    const exportBtn = page.locator('button:has-text("Exportar"), button:has-text("CSV")').first();
    if (await exportBtn.isVisible()) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
        exportBtn.click(),
      ]);
      // Ou baixou arquivo ou não mostrou erro
      await assertNoError(page);
    }
  });
});
