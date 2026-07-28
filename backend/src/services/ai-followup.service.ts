import { prisma } from '../config/database';
import { LeadStatus } from '@prisma/client';

// Leads nesses status/condicoes nunca recebem follow-up automatico: conversa
// ja terminou (CLIENT/LOST/DISQUALIFIED), reuniao ja marcada (SCHEDULED ou
// tag reuniao_agendada — ver meeting-scheduler.service.ts), um humano
// assumiu a conversa (aiHandoff), ou a propria IA ja decidiu que esse lead
// sinalizou desinteresse (tag followup_desinteresse — ver executeAIAndReply
// em ai-whatsapp-reply.service.ts).
const EXCLUDED_STATUSES: LeadStatus[] = ['CLIENT', 'LOST', 'DISQUALIFIED', 'SCHEDULED'];
const EXCLUDED_TAGS = ['reuniao_agendada', 'followup_desinteresse'];

// SEM_INTERESSE tambem cobre o caso em que a IA confirmou, numa mensagem ao
// vivo, que o lead esta fora do ICP automotivo (fit=disqualified) — ver o
// mapeamento fit->marketingStage em executeAIAndReply. Sem essa exclusao, um
// lead ja confirmado fora do ICP continuaria recebendo follow-up.
const EXCLUDED_MARKETING_STAGES = ['SEM_INTERESSE'] as const;

const DEFAULT_DELAY_HOURS = 24;
const DEFAULT_MAX_ATTEMPTS = 2;

interface LastMessageRow {
  leadId: string;
  direction: string;
  createdAt: Date;
}

// Roda periodicamente (ver sync-scheduler.service.ts). Encontra leads em
// silencio ha mais tempo que o configurado no agente ativo e manda um
// follow-up gerado pela IA pra cada um.
export async function sendFollowUpsForSilentLeads(): Promise<{ sent: number; evaluated: number }> {
  const agent = await (prisma as any).aIAgent.findFirst({
    where: { isActive: true },
    select: { followUpDelayHours: true, followUpMaxAttempts: true },
  });
  const delayHours = agent?.followUpDelayHours ?? DEFAULT_DELAY_HOURS;
  const maxAttempts = agent?.followUpMaxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (delayHours <= 0 || maxAttempts <= 0) return { sent: 0, evaluated: 0 };

  const cutoff = new Date(Date.now() - delayHours * 60 * 60 * 1000);

  // Ultima mensagem (qualquer direcao) de cada lead que tem alguma conversa de
  // WhatsApp — uma query so, em vez de N queries por lead.
  const lastMessages = await prisma.$queryRaw<LastMessageRow[]>`
    SELECT DISTINCT ON ("leadId") "leadId", "direction", "createdAt"
    FROM "WhatsAppMessage"
    WHERE "leadId" IS NOT NULL
    ORDER BY "leadId", "createdAt" DESC
  `;

  const silentLeadIds = lastMessages
    .filter(m => m.direction === 'outbound' && m.createdAt <= cutoff)
    .map(m => m.leadId);

  if (silentLeadIds.length === 0) return { sent: 0, evaluated: 0 };

  const eligibleLeads = await prisma.lead.findMany({
    where: {
      id: { in: silentLeadIds },
      deletedAt: null,
      aiHandoff: false,
      status: { notIn: EXCLUDED_STATUSES },
      followUpCount: { lt: maxAttempts },
      marketingStage: { notIn: [...EXCLUDED_MARKETING_STAGES] },
      NOT: EXCLUDED_TAGS.map(tag => ({ tags: { has: tag } })),
      phone: { not: null },
    },
    select: { id: true, email: true, phone: true },
  });

  const { sendFollowUpMessage } = await import('./ai-whatsapp-reply.service');
  const { setMarketingStage } = await import('./lead-marketing-stage.service');
  let sent = 0;
  for (const lead of eligibleLeads) {
    if (!lead.phone) continue;
    try {
      // Reavaliacao periodica (CRM Lara) — lead silencioso "esfria" pra essa
      // coluna mesmo sem responder nada. Antes de tentar mandar o follow-up,
      // pra refletir o board mesmo se o envio for pulado (ex: fora da janela
      // de 24h sem template configurado).
      await setMarketingStage(lead.email, 'AGUARDANDO_FOLLOWUP', 'system').catch(() => {});
      await sendFollowUpMessage(lead.phone);
      sent++;
    } catch (err) {
      console.error(`[AI-Followup] erro ao processar lead ${lead.id}:`, err);
    }
  }

  return { sent, evaluated: eligibleLeads.length };
}
