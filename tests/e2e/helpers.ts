import { Page, expect } from '@playwright/test';

export const API = process.env.API_URL || 'http://localhost:5000/api';

/** Aguarda a tela carregar (sem spinner visível) */
export async function waitForLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

/** Navega para uma rota e aguarda carregar */
export async function goto(page: Page, path: string) {
  await page.goto(path);
  await waitForLoad(page);
}

/** Verifica que um toast/mensagem de erro NÃO está presente */
export async function assertNoError(page: Page) {
  const errorSelectors = ['text=Erro', 'text=Error', '[role="alert"]'];
  for (const sel of errorSelectors) {
    const el = page.locator(sel).first();
    const visible = await el.isVisible().catch(() => false);
    if (visible) {
      const text = await el.textContent();
      throw new Error(`Erro inesperado na tela: "${text}"`);
    }
  }
}
