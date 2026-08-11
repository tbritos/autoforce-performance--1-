import { Page, expect } from '@playwright/test';

export const API = process.env.API_URL || 'http://localhost:5001/api';

/** Aguarda a tela carregar (sem spinner visível) */
export async function waitForLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

/** Navega para uma rota e aguarda carregar */
export async function goto(page: Page, path: string) {
  await page.goto(path);
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(new URL(page.url()).hostname);
  const localLogin = page.getByRole('button', { name: /Entrar sem Google/i });
  if (isLocal && await localLogin.isVisible().catch(() => false)) {
    await localLogin.click();
    await page.waitForFunction(
      () => window.localStorage.getItem('autoforce_token') === 'dev-local-bypass',
      undefined,
      { timeout: 10_000 },
    );
    await page.goto(path);
  }
  await waitForLoad(page);
}

/** Verifica que um toast/mensagem de erro NÃO está presente */
export async function assertNoError(page: Page) {
  const errorLocators = [
    page.locator('[role="alert"]').filter({ hasText: /\b(erro|error|falha)\b/i }),
  ];
  for (const locator of errorLocators) {
    const el = locator.first();
    const visible = await el.isVisible().catch(() => false);
    if (visible) {
      const text = await el.textContent();
      throw new Error(`Erro inesperado na tela: "${text}"`);
    }
  }
}
