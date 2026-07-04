import { Platform } from '@prisma/client';
import { PlatformConnectionService } from './platform-connection.service';
import { getWhatsAppCredentials } from './whatsapp.service';

// Verifies end-to-end that WhatsApp inbound messages can actually reach the system:
// 1. the access token is still valid
// 2. the Meta app's webhook subscription is still active, points at OUR callback URL,
//    and has the "messages" field enabled
// This exists because the Meta webhook config can silently change/reset on Meta's side
// (e.g. callback URL got cleared) without anything on our side reporting an error —
// inbound messages just stop arriving and nobody notices until a customer complains.

const REALERT_INTERVAL_MS = 6 * 60 * 60 * 1000; // don't email more than once every 6h while still broken

let lastCheckOk: boolean | null = null; // null = never checked yet
let lastFailureAlertAt: number | null = null;

interface SubscriptionField {
  name: string;
}

interface SubscriptionEntry {
  object: string;
  callback_url: string;
  active: boolean;
  fields: Array<string | SubscriptionField>;
}

async function fetchAppSubscriptions(): Promise<SubscriptionEntry[]> {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error('META_APP_ID/META_APP_SECRET não configurados — não é possível verificar a inscrição do webhook');
  }

  const url = `https://graph.facebook.com/v19.0/${appId}/subscriptions?access_token=${appId}|${appSecret}`;
  const res = await fetch(url);
  const data = await res.json() as { data?: SubscriptionEntry[]; error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Meta API error ${res.status} ao listar subscriptions`);
  }
  return data.data ?? [];
}

function expectedCallbackUrl(): string {
  const base = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (!base) throw new Error('APP_URL não configurado — não é possível confirmar a callback URL do webhook');
  return `${base}/api/whatsapp/webhook`;
}

export interface WhatsAppWebhookHealth {
  ok: boolean;
  message: string;
}

export async function checkWhatsAppWebhookHealth(): Promise<WhatsAppWebhookHealth> {
  try {
    const { accessToken, businessAccountId } = await getWhatsAppCredentials();

    const tokenRes = await fetch(`https://graph.facebook.com/v19.0/${businessAccountId}?fields=id&access_token=${accessToken}`);
    const tokenData = await tokenRes.json() as { error?: { message: string } };
    if (!tokenRes.ok || tokenData.error) {
      return { ok: false, message: `Token de acesso do WhatsApp inválido/expirado: ${tokenData.error?.message ?? `HTTP ${tokenRes.status}`}` };
    }

    const subscriptions = await fetchAppSubscriptions();
    const waSubscription = subscriptions.find(s => s.object === 'whatsapp_business_account');

    if (!waSubscription) {
      return { ok: false, message: 'Nenhuma inscrição de webhook para "whatsapp_business_account" encontrada no App da Meta — o webhook foi removido.' };
    }
    if (!waSubscription.active) {
      return { ok: false, message: 'A inscrição do webhook do WhatsApp está marcada como inativa no painel da Meta.' };
    }

    const expected = expectedCallbackUrl();
    if (waSubscription.callback_url !== expected) {
      return {
        ok: false,
        message: `A callback URL do webhook mudou! Esperado "${expected}", mas a Meta tem cadastrado "${waSubscription.callback_url}". Corrija em developers.facebook.com > WhatsApp > Configuration.`,
      };
    }

    const fieldNames = waSubscription.fields.map(f => typeof f === 'string' ? f : f.name);
    if (!fieldNames.includes('messages')) {
      return { ok: false, message: 'O campo "messages" não está mais inscrito no webhook — mensagens recebidas não vão chegar ao sistema.' };
    }

    return { ok: true, message: 'Webhook do WhatsApp OK: token válido, callback URL e campo "messages" corretos.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Erro desconhecido ao verificar o webhook do WhatsApp' };
  }
}

async function sendAlertEmail(subject: string, message: string): Promise<void> {
  try {
    const { sendEmail } = await import('./resend.service');
    const adminEmail = process.env.ALERT_EMAIL?.trim() || 'marketing@autoforce.com';
    await sendEmail({
      leadEmail: adminEmail,
      toEmail: adminEmail,
      subject,
      html: `<p>${message}</p><p style="color:#888">Verificado em ${new Date().toLocaleString('pt-BR')}</p>`,
      skipRecord: true,
    });
  } catch (err) {
    console.error('[whatsapp-health] Erro ao enviar e-mail de alerta:', err);
  }
}

export async function runWhatsAppWebhookHealthCheck(): Promise<void> {
  const result = await checkWhatsAppWebhookHealth();
  const wasOk = lastCheckOk;
  lastCheckOk = result.ok;

  if (result.ok) {
    await PlatformConnectionService.recordSyncSuccess('WHATSAPP' as Platform);
    if (wasOk === false) {
      console.log('[whatsapp-health] Recuperado:', result.message);
      await sendAlertEmail('✅ WhatsApp voltou a funcionar', result.message);
      lastFailureAlertAt = null;
    }
    return;
  }

  console.error('[whatsapp-health] FALHOU:', result.message);
  await PlatformConnectionService.markError('WHATSAPP' as Platform, result.message);

  const now = Date.now();
  const shouldAlert = wasOk !== false || lastFailureAlertAt === null || (now - lastFailureAlertAt > REALERT_INTERVAL_MS);
  if (shouldAlert) {
    await sendAlertEmail('🚨 WhatsApp parou de funcionar', result.message);
    lastFailureAlertAt = now;
  }
}
