/**
 * Auth Setup — roda UMA VEZ antes de todos os testes.
 * Abre o browser, você faz login com Google manualmente,
 * e a sessão é salva em .auth/session.json para reutilizar.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const SESSION_FILE = path.join(__dirname, '.auth/session.json');

setup('autenticar com Google', async ({ page, context }) => {
  await page.goto('/');

  // Aguarda o botão de login aparecer
  await page.waitForSelector('text=Entrar com Google', { timeout: 10_000 });

  console.log('\n\n=== AÇÃO NECESSÁRIA ===');
  console.log('Faça login com Google no browser que abriu.');
  console.log('Aguardando redirecionamento após login...\n');

  // Aguarda até 90s para o usuário fazer login manualmente
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 90_000 });

  // Confirma que está logado (dashboard carregou)
  await expect(page.locator('text=Dashboard').or(page.locator('[data-testid="nav"]'))).toBeVisible({ timeout: 10_000 });

  await context.storageState({ path: SESSION_FILE });
  console.log('Sessão salva em', SESSION_FILE);
});
