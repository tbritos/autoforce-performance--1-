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

export async function fetchWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  const conn = await PlatformConnectionService.getInternalConnection('WHATSAPP' as Platform);
  if (!conn?.accessToken) {
    throw new Error('WhatsApp não configurado. Acesse Integrações e configure a API Business.');
  }

  const meta = (conn.metadata ?? {}) as Record<string, unknown>;
  const businessAccountId = meta.businessAccountId as string | undefined;
  if (!businessAccountId) {
    throw new Error('WhatsApp Business Account ID não encontrado. Reconfigure a integração.');
  }

  const url = `https://graph.facebook.com/v19.0/${businessAccountId}/message_templates?limit=100&fields=id,name,status,category,language,components&access_token=${conn.accessToken}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as { data?: WhatsAppTemplate[]; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);

  return (data.data ?? []).filter(t => t.status === 'APPROVED');
}
