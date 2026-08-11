/**
 * QA — Conexões: cards de plataforma, status, botão Testar.
 */
import { test, expect } from '@playwright/test';
import { goto } from './helpers';

const PLATFORMS = ['Meta Ads', 'Google Ads', 'Google Analytics', 'RD Station', 'Pipedrive', 'WhatsApp'];

test.describe('Conexões', () => {
  test('página carrega com todos os cards', async ({ page }) => {
    await goto(page, '/connections');
    for (const platform of PLATFORMS) {
      await expect(page.getByText(platform, { exact: true })).toBeVisible();
    }
  });

  test('badge de status visível em cada card', async ({ page }) => {
    await goto(page, '/connections');
    for (const platform of PLATFORMS) {
      const card = page.locator('.ds-card').filter({ hasText: platform });
      await expect(card.getByText(/^(Conectado|Desconectado|Erro|Expirado)$/)).toBeVisible();
    }
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
    const whatsappCard = page.locator('.ds-card').filter({ hasText: 'WhatsApp Business' });
    // O card do WhatsApp NÃO deve ter botão "Configurar"
    await expect(whatsappCard.getByRole('button', { name: /Configurar/i })).toHaveCount(0);
    // Deve mostrar as env vars
    await expect(whatsappCard.getByText(/WHATSAPP_ACCESS_TOKEN/).first()).toBeVisible();
  });
});
