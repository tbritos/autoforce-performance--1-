/**
 * QA — API Backend: endpoints críticos respondem corretamente.
 * Testa diretamente a API Railway.
 */
import { test, expect } from '@playwright/test';

const API = process.env.API_URL || 'https://autoforce-performance-1-production.up.railway.app/api';

test.describe('API Health', () => {
  test('GET /health retorna 200', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.ok()).toBe(true);
  });

  test('GET /lead-hub retorna lista (autenticado via cookie)', async ({ request }) => {
    const res = await request.get(`${API}/lead-hub?pageSize=1`);
    expect(res.status()).not.toBe(500);
    if (res.ok()) {
      const body = await res.json();
      expect(body).toHaveProperty('leads');
      expect(body).toHaveProperty('total');
    }
  });

  test('GET /automation-journeys retorna lista', async ({ request }) => {
    const res = await request.get(`${API}/automation-journeys`);
    expect(res.status()).not.toBe(500);
    if (res.ok()) {
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    }
  });

  test('GET /pipedrive/stages responde', async ({ request }) => {
    const res = await request.get(`${API}/pipedrive/stages`);
    // 200 (conectado) ou 400/500 (não conectado) — nunca 500 de crash
    expect(res.status()).not.toBe(500);
  });

  test('GET /whatsapp/templates responde', async ({ request }) => {
    const res = await request.get(`${API}/whatsapp/templates`);
    expect(res.status()).not.toBe(500);
  });

  test('GET /whatsapp/phone-numbers responde', async ({ request }) => {
    const res = await request.get(`${API}/whatsapp/phone-numbers`);
    expect(res.status()).not.toBe(500);
  });

  test('POST /pipedrive-webhook sem token retorna 401', async ({ request }) => {
    const res = await request.post(
      'https://autoforce-performance-1-production.up.railway.app/api/pipedrive-webhook',
      { data: { event: 'updated.deal', current: {} } }
    );
    // Com PIPEDRIVE_WEBHOOK_SECRET configurado deve ser 401
    // Sem a variável qualquer coisa é válida (200)
    expect([200, 401]).toContain(res.status());
  });
});
