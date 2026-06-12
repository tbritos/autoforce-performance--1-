import { Resend } from 'resend';
import { prisma } from '../config/database';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY não configurada');
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export interface SendEmailInput {
  leadEmail: string;
  toEmail: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
  templateId?: string;
  automationExecutionId?: string;
  automationNodeId?: string;
  skipRecord?: boolean;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const fromName  = input.fromName  || process.env.RESEND_FROM_NAME  || 'AutoForce';
  const fromEmail = input.fromEmail || process.env.RESEND_FROM_EMAIL || 'noreply@updates.autoforce.com';
  const from      = `${fromName} <${fromEmail}>`;

  let resendId: string | null = null;
  let status = 'failed';

  try {
    const client = getResend();
    const result = await client.emails.send({
      from,
      to: [input.toEmail],
      subject: input.subject,
      html: input.html,
    });
    resendId = (result.data as { id?: string } | null)?.id ?? null;
    status   = resendId ? 'sent' : 'failed';
  } catch (err) {
    console.error('[resend] Erro ao enviar email:', err);
  }

  if (!input.skipRecord) {
    await prisma.emailSent.create({
      data: {
        leadEmail:             input.leadEmail,
        templateId:            input.templateId            ?? null,
        resendId,
        subject:               input.subject,
        fromName,
        fromEmail,
        toEmail:               input.toEmail,
        status,
        automationExecutionId: input.automationExecutionId ?? null,
        automationNodeId:      input.automationNodeId      ?? null,
        sentAt:                new Date(),
      },
    });
  }
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
