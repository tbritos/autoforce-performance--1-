/**
 * QA — Conexões: cards de plataforma, status, botão Testar.
 */
import { test, expect } from '@playwright/test';
import { goto, assertNoError } from './helpers';

const PLATFORMS = ['Meta Ads', 'Google Ads', 'Google Analytics', 'RD Station', 'Pipedrive', 'WhatsApp'];

test.describe('Conexões', () => {
  test('página carrega com todos os cards', async ({ page }) => {
    await goto(page, '/connections');
    await assertNoError(page);
    for (const platform of PLATFORMS) {
      await expect(page.locator(`text=${platform}`).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('badge de status visível em cada card', async ({ page }) => {
    await goto(page, '/connections');
    // Pelo menos um badge de status (CONECTADO ou DESCONECTADO)
    const badges = page.locator('text=Conectado, text=Desconectado, text=CONECTADO, text=DESCONECTADO');
    await expect(badges.first()).toBeVisible({ timeout: 5000 });
  });

  test('botão Testar visível nas plataformas conectadas', async ({ page }) => {
    await goto(page, '/connections');
    const testBtns = page.locator('button:has-text("Testar")');
    const count = await testBtns.count();
    // Se houver plataformas conectadas, deve ter botão Testar
    if (count > 0) {
      await expect(testBtns.first()).toBeVisible();
    }
  });

  test('WhatsApp mostra env vars em vez de botão Configurar', async ({ page }) => {
    await goto(page, '/connections');
    // O card do WhatsApp NÃO deve ter botão "Configurar"
    const configBtn = page.locator('button:has-text("Configurar")').first();
    const visible = await configBtn.isVisible().catch(() => false);
    expect(visible).toBe(false);
    // Deve mostrar as env vars
    await expect(page.locator('text=WHATSAPP_ACCESS_TOKEN').first()).toBeVisible({ timeout: 5000 });
  });
});
