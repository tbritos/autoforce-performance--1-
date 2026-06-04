/**
 * QA — Navegação: todas as rotas principais carregam sem erro.
 */
import { test, expect } from '@playwright/test';
import { goto, assertNoError } from './helpers';

const ROUTES = [
  { path: '/dashboard',      label: 'Dashboard' },
  { path: '/leads',          label: 'Leads' },
  { path: '/automation',     label: 'Automação' },
  { path: '/connections',    label: 'Conexões' },
  { path: '/utm-links',      label: 'UTM Links' },
  { path: '/revenue',        label: 'Receita' },
  { path: '/campaigns',      label: 'Campanhas' },
  { path: '/email',          label: 'E-mail' },
];

for (const route of ROUTES) {
  test(`${route.label} carrega sem erro`, async ({ page }) => {
    await goto(page, route.path);
    await assertNoError(page);
    // Página não é uma tela em branco
    const body = await page.locator('body').textContent();
    expect(body?.trim().length).toBeGreaterThan(50);
  });
}
