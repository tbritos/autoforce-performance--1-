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
  const envToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const envAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  if (envToken && envAccountId) {
    return { accessToken: envToken, businessAccountId: envAccountId };
  }

  const conn = await PlatformConnectionService.getInternalConnection('WHATSAPP' as Platform);
  const accessToken = conn?.accessToken?.trim();
  const meta = (conn?.metadata ?? {}) as Record<string, unknown>;
  const businessAccountId = (meta.businessAccountId as string | undefined)?.trim();

  if (!accessToken || !businessAccountId) {
    throw new Error('WhatsApp não configurado. Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID no Railway.');
  }

  return { accessToken, businessAccountId };
}

// FIX: Meta Graph API IDs are always numeric — validate to prevent path injection
function validateGraphId(id: string, fieldName: string): void {
  if (!/^\d+$/.test(id)) {
    throw new Error(`${fieldName} inválido: deve ser numérico (ex: 123456789012345)`);
  }
}

async function metaGet<T>(url: string, accessToken: string): Promise<T> {
  // FIX: token in Authorization header, NOT in URL query string
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as T & { error?: { message: string } };
  if ((data as { error?: { message: string } }).error) {
    throw new Error((data as { error: { message: string } }).error.message);
  }
  return data;
}

export interface WhatsAppPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
}

export async function fetchWhatsAppPhoneNumbers(): Promise<WhatsAppPhoneNumber[]> {
  const { accessToken, businessAccountId } = await getWhatsAppCredentials();

  const url = `https://graph.facebook.com/v19.0/${businessAccountId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`;
  const data = await metaGet<{ data?: WhatsAppPhoneNumber[] }>(url, accessToken);
  return data.data ?? [];
}

// Fetch templates — if phoneNumberId is provided, find its WABA first so we get
// templates scoped to that specific number's Business Account.
export async function fetchWhatsAppTemplates(phoneNumberId?: string): Promise<WhatsAppTemplate[]> {
  const { accessToken, businessAccountId } = await getWhatsAppCredentials();

  let wabaId = businessAccountId;

  if (phoneNumberId) {
    // FIX: validate before using in URL path
    validateGraphId(phoneNumberId, 'phoneNumberId');

    try {
      const infoUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=whatsapp_business_account`;
      const info = await metaGet<{ whatsapp_business_account?: { id: string } }>(infoUrl, accessToken);
      if (info.whatsapp_business_account?.id) {
        wabaId = info.whatsapp_business_account.id;
      }
    } catch {
      // Fall back to default WABA
    }
  }

  const url = `https://graph.facebook.com/v19.0/${wabaId}/message_templates?limit=100&fields=id,name,status,category,language,components`;
  const data = await metaGet<{ data?: WhatsAppTemplate[] }>(url, accessToken);
  return (data.data ?? []).filter(t => t.status === 'APPROVED');
}

export { getWhatsAppCredentials };
