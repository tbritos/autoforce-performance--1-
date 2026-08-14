import { Resend } from 'resend';
import { prisma } from '../config/database';
import {
  buildOneClickUnsubscribeUrl,
  buildUnsubscribeUrl,
  normalizeUnsubscribeEmail,
} from './email-unsubscribe.service';
import {
  blockingSuppressionScopes,
  normalizeEmailCommunicationType,
  suppressionScopeForCommunication,
  type EmailCommunicationType,
} from './email-preferences.service';

const SEND_TIMEOUT_MS = 20_000;
const DOMAIN_LIST_TIMEOUT_MS = 10_000;
const DOMAIN_CACHE_TTL_MS = 5 * 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout (${ms / 1000}s): ${label}`)), ms)),
  ]);
}

let _resend: Resend | null = null;
let verifiedSendingDomainsCache: { domains: string[]; expiresAt: number } | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY não configurada');
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export async function listVerifiedSendingDomains(): Promise<string[]> {
  if (verifiedSendingDomainsCache && verifiedSendingDomainsCache.expiresAt > Date.now()) {
    return verifiedSendingDomainsCache.domains;
  }

  const result = await withTimeout(
    getResend().domains.list({ limit: 100 }),
    DOMAIN_LIST_TIMEOUT_MS,
    'listVerifiedSendingDomains'
  );

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? 'Não foi possível consultar os domínios no Resend');
  }

  const domains = [...new Set(
    result.data.data
      .filter(domain => domain.capabilities.sending === 'enabled')
      .map(domain => domain.name.trim().toLowerCase())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  verifiedSendingDomainsCache = {
    domains,
    expiresAt: Date.now() + DOMAIN_CACHE_TTL_MS,
  };

  return domains;
}

export interface SendEmailInput {
  leadEmail: string;
  toEmail: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
  templateId?: string;
  blastId?: string;
  automationExecutionId?: string;
  automationNodeId?: string;
  skipRecord?: boolean;
  // Alertas operacionais podem ignorar a preferência de marketing.
  respectUnsubscribe?: boolean;
  includeUnsubscribe?: boolean;
  communicationType?: EmailCommunicationType;
  // Opcional: recebe a mensagem de erro real quando o envio falha, sem mudar o
  // contrato de retorno (boolean) que os outros chamadores (disparo em massa)
  // ja dependem pra contar sucesso/falha.
  onError?: (message: string) => void;
}

export interface ReceivedEmailContent {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  html: string | null;
  createdAt: string;
}

export async function getReceivedEmailContent(id: string): Promise<ReceivedEmailContent> {
  const result = await getResend().emails.receiving.get(id);
  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? 'Conteúdo do email recebido não encontrado');
  }

  return {
    id: result.data.id,
    from: result.data.from,
    to: result.data.to,
    subject: result.data.subject,
    text: result.data.text,
    html: result.data.html,
    createdAt: result.data.created_at,
  };
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const fromName  = input.fromName  || process.env.RESEND_FROM_NAME  || 'AutoForce';
  const fromEmail = input.fromEmail || process.env.RESEND_FROM_EMAIL || 'noreply@updates.autoforce.com';
  const from      = `${fromName} <${fromEmail}>`;

  let resendId: string | null = null;
  let status = 'failed';
  let html = input.html;

  const respectUnsubscribe = input.respectUnsubscribe !== false;
  const communicationType = normalizeEmailCommunicationType(input.communicationType);
  let normalizedEmail: string;
  try {
    normalizedEmail = normalizeUnsubscribeEmail(input.toEmail);
  } catch {
    normalizedEmail = input.toEmail.trim().toLowerCase();
  }

  if (respectUnsubscribe) {
    const suppression = await prisma.emailSuppression.findFirst({
      where: { email: normalizedEmail, scope: { in: blockingSuppressionScopes(communicationType) } },
      select: { id: true },
    });
    if (suppression) {
      status = 'suppressed';
    }
  }

  if (status !== 'suppressed') try {
    const unsubscribeScope = suppressionScopeForCommunication(communicationType);
    const includeUnsubscribe = input.includeUnsubscribe ?? (unsubscribeScope !== null);
    const headers: Record<string, string> | undefined = includeUnsubscribe
      ? {
          'List-Unsubscribe': `<${buildOneClickUnsubscribeUrl(normalizedEmail, unsubscribeScope ?? 'marketing')}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      : undefined;
    if (includeUnsubscribe) {
      html = html.replace(/\{\{unsubscribe_url\}\}/gi, buildUnsubscribeUrl(normalizedEmail, unsubscribeScope ?? 'marketing'));
    } else {
      html = html.replace(/\{\{unsubscribe_url\}\}/gi, '');
    }
    const client = getResend();
    const result = await withTimeout(
      client.emails.send({
        from,
        to: [input.toEmail],
        subject: input.subject,
        html,
        headers,
      }),
      SEND_TIMEOUT_MS,
      `sendEmail ${input.toEmail}`
    );
    resendId = (result.data as { id?: string } | null)?.id ?? null;
    status   = resendId ? 'sent' : 'failed';
    if (!resendId) {
      const message = (result as { error?: { message?: string } }).error?.message ?? 'Resend nao retornou um id de envio';
      console.error('[resend] Erro ao enviar email:', message);
      input.onError?.(message);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[resend] Erro ao enviar email:', err);
    input.onError?.(message);
  }

  if (!input.skipRecord) {
    await prisma.emailSent.create({
      data: {
        leadEmail:             input.leadEmail,
        templateId:            input.templateId            ?? null,
        blastId:               input.blastId               ?? null,
        resendId,
        subject:               input.subject,
        fromName,
        fromEmail,
        toEmail:               input.toEmail,
        status,
        htmlBody:              html,
        automationExecutionId: input.automationExecutionId ?? null,
        automationNodeId:      input.automationNodeId      ?? null,
        sentAt:                new Date(),
      },
    });
  }

  return status === 'sent';
}

export function renderTemplate(
  template: string,
  lead: { email?: string | null; name?: string | null; company?: string | null; phone?: string | null; jobTitle?: string | null }
): string {
  return template
    .replace(/\{\{name\}\}/gi,     lead.name     ?? '')
    .replace(/\{\{email\}\}/gi,    lead.email    ?? '')
    .replace(/\{\{company\}\}/gi,  lead.company  ?? '')
    .replace(/\{\{phone\}\}/gi,    lead.phone    ?? '')
    .replace(/\{\{jobTitle\}\}/gi, lead.jobTitle ?? '');
}
