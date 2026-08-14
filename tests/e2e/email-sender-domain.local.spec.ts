import { expect, test } from '@playwright/test';

const localUser = {
  email: 'dev@autoforce.com',
  name: 'Dev Local',
  avatar: '',
  role: 'AutoForce Member',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(user => {
    localStorage.setItem('autoforce_token', 'dev-local-bypass');
    localStorage.setItem('autoforce_user', JSON.stringify(user));
  }, localUser);

  await page.route('**/api/email-templates/sender-domains', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      domains: ['mail.autoforce.com', 'updates.autoforce.com'],
    }),
  }));
});

test('monta o remetente com parte livre e domínio selecionado do Resend', async ({ page }) => {
  await page.goto('/emails/new');

  await page.getByPlaceholder('Ex: Marketing AutoForce').fill('Lara da AutoForce');
  await page.getByLabel('Nome antes do arroba').fill('lara');
  await page.getByLabel('Domínio do remetente').selectOption('updates.autoforce.com');

  await expect(page.getByText('Endereço completo:').locator('..')).toContainText(
    'lara@updates.autoforce.com'
  );
  await expect(page.getByLabel('Domínio do remetente').locator('option')).toHaveCount(3);
});

test('separa corretamente o endereço de um template existente', async ({ page }) => {
  await page.route('**/api/email-templates/template-existente', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'template-existente',
      name: 'Template existente',
      subject: 'Assunto existente',
      body: '<p>Conteúdo</p>',
      design: null,
      fromName: 'Lara da AutoForce',
      fromEmail: 'autoforce@updates.autoforce.com',
      status: 'draft',
    }),
  }));

  await page.goto('/emails/template-existente/edit');
  await page.getByRole('button', { name: 'Alterar' }).click();

  await expect(page.getByLabel('Nome antes do arroba')).toHaveValue('autoforce');
  await expect(page.getByLabel('Domínio do remetente')).toHaveValue('updates.autoforce.com');
});
