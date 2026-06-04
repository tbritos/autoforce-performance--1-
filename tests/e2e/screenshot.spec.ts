/**
 * Screenshot generator — tira prints de todas as telas do sistema.
 * Usa dev-bypass para autenticar sem precisar de login Google.
 *
 * Rodar com:
 *   npx playwright test tests/e2e/screenshot.spec.ts --project=chromium --no-deps
 *
 * Pré-requisito: frontend rodando em http://localhost:5173
 *                backend rodando em http://localhost:5000 (ou apontar para Railway)
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRINTS_DIR = path.join(__dirname, '../../prints');
const BASE = 'http://localhost:5173';

// Garante que a pasta prints/ existe
if (!fs.existsSync(PRINTS_DIR)) fs.mkdirSync(PRINTS_DIR, { recursive: true });

async function screenshot(page: import('@playwright/test').Page, name: string) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800); // aguarda animações
  await page.screenshot({
    path: path.join(PRINTS_DIR, `${name}.png`),
    fullPage: false,
  });
  console.log(`✅ Screenshot: prints/${name}.png`);
}

test.use({ storageState: { cookies: [], origins: [] } }); // sem sessão salva

test('Gerar prints de todas as telas', async ({ page }) => {
  // ── 1. LOGIN PAGE ──────────────────────────────────────────────────────────
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await screenshot(page, '00-login');

  // ── 2. Dev bypass ──────────────────────────────────────────────────────────
  const devBtn = page.locator('button:has-text("Entrar sem Google")');
  if (await devBtn.isVisible({ timeout: 5000 })) {
    await devBtn.click();
    // Wait for sidebar to appear (means login was successful)
    await expect(page.locator('text=Banco de Leads').first()).toBeVisible({ timeout: 15_000 });
  } else {
    throw new Error('Botão dev-login não encontrado. Certifique-se que NODE_ENV=development no backend.');
  }

  await page.setViewportSize({ width: 1440, height: 900 });

  // ── 3. DASHBOARD ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/`);
  await screenshot(page, '01-dashboard');

  // ── 4. BANCO DE LEADS ─────────────────────────────────────────────────────
  await page.goto(`${BASE}/leads`);
  await screenshot(page, '02-leads-lista');

  // Abre perfil do primeiro lead disponível
  const firstRow = page.locator('tr').nth(1);
  if (await firstRow.isVisible()) {
    await firstRow.click();
    await page.waitForTimeout(1000);
    await screenshot(page, '03-leads-perfil');
    await page.keyboard.press('Escape');
  }

  // ── 5. UTM TRACKER ────────────────────────────────────────────────────────
  await page.goto(`${BASE}/utm`);
  await screenshot(page, '04-utm-tracker');

  // ── 6. FUNIL ──────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/funnel`);
  await screenshot(page, '05-funil');

  // ── 7. CAMPANHAS ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/campaigns`);
  await screenshot(page, '06-campanhas');

  // ── 8. ANALYTICS ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/analytics`);
  await screenshot(page, '07-analytics');

  // ── 9. E-MAILS ────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/email`);
  await screenshot(page, '08-emails');

  // ── 10. GANHOS ────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/revenue`);
  await screenshot(page, '09-ganhos');

  // ── 11. AUTOMAÇÕES — lista ────────────────────────────────────────────────
  await page.goto(`${BASE}/automation`);
  await screenshot(page, '10-automacoes-lista');

  // Abre o editor de uma jornada se existir
  const editBtn = page.locator('button[title="Editar fluxo"]').first();
  if (await editBtn.isVisible({ timeout: 3000 })) {
    await editBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, '11-automacoes-canvas');

    // Abre painel de execuções
    const execBtn = page.locator('button:has-text("Execuções")').first();
    if (await execBtn.isVisible()) {
      await execBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '12-automacoes-execucoes');
      await page.keyboard.press('Escape');
    }
  }

  // ── 12. CONEXÕES ──────────────────────────────────────────────────────────
  await page.goto(`${BASE}/connections`);
  await screenshot(page, '13-conexoes');

  // ── 13. DOCUMENTAÇÃO ──────────────────────────────────────────────────────
  await page.goto(`${BASE}/docs`);
  await screenshot(page, '14-documentacao');

  console.log(`\n🎉 Prints salvos em: prints/`);
});
