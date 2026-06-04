/**
 * Auth Setup — roda UMA VEZ antes de todos os testes.
 * Abre o browser, você faz login com Google manualmente,
 * e a sessão é salva em .auth/session.json para reutilizar.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SESSION_FILE = path.join(__dirname, '.auth/session.json');

setup('autenticar com Google', async ({ page, context }) => {
  await page.goto('/');

  // Aguarda o botão de login aparecer (texto real da tela)
  await page.waitForSelector(
    'button:has-text("Continuar com Google"), button:has-text("Entrar sem Google")',
    { timeout: 10_000 }
  );

  console.log('\n\n=== AÇÃO NECESSÁRIA ===');
  console.log('Clique em "Continuar com Google" no browser que abriu.');
  console.log('Aguardando redirecionamento após login...\n');

  // Aguarda sair da tela de login (pathname muda para /dashboard ou similar)
  await page.waitForURL(url => url.pathname !== '/' && !url.pathname.startsWith('/login'), { timeout: 90_000 });

  // Confirma que está logado (dashboard carregou)
  await expect(page.locator('text=Dashboard').or(page.locator('[data-testid="nav"]'))).toBeVisible({ timeout: 10_000 });

  await context.storageState({ path: SESSION_FILE });
  console.log('Sessão salva em', SESSION_FILE);
});
