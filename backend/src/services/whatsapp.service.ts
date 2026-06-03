import { PlatformConnectionService } from './platform-connection.service';
import { Platform } from '@prisma/client';

export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: string;
  text?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: WhatsAppTemplateComponent[];
}

async function getWhatsAppCredentials(): Promise<{ accessToken: string; businessAccountId: string }> {
  // env vars take priority (Railway config)
  const envToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const envAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  if (envToken && envAccountId) {
    return { accessToken: envToken, businessAccountId: envAccountId };
  }

  // fall back to DB (saved via Integrações UI)
  const conn = await PlatformConnectionService.getInternalConnection('WHATSAPP' as Platform);
  const accessToken = conn?.accessToken?.trim();
  const meta = (conn?.metadata ?? {}) as Record<string, unknown>;
  const businessAccountId = (meta.businessAccountId as string | undefined)?.trim();

  if (!accessToken || !businessAccountId) {
    throw new Error('WhatsApp não configurado. Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID no Railway.');
  }

  return { accessToken, businessAccountId };
}

export async function fetchWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  const { accessToken, businessAccountId } = await getWhatsAppCredentials();

  const url = `https://graph.facebook.com/v19.0/${businessAccountId}/message_templates?limit=100&fields=id,name,status,category,language,components&access_token=${accessToken}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as { data?: WhatsAppTemplate[]; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);

  return (data.data ?? []).filter(t => t.status === 'APPROVED');
}

export { getWhatsAppCredentials };
