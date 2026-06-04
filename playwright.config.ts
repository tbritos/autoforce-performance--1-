import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 1,
  workers: 1,
  reporter: [['html', { outputFolder: 'tests/e2e/report' }], ['list']],

  use: {
    baseURL: BASE_URL,
    storageState: 'tests/e2e/.auth/session.json',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    // Setup: salva sessão autenticada
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Testes principais (dependem da sessão salva)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
