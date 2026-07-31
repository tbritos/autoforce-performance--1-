import { prisma } from '../config/database';
import { countSentFollowUp, FOLLOWUP_RESOLVED_TAG } from './lara-runtime.utils';

// So faz follow-up de lead com status LEAD — assim que o status vira MQL,
// SQL, SCHEDULED, DEMO, PROPOSAL, OPPORTUNITY, CLIENT (ou LOST/DISQUALIFIED),
// o time comercial ja assumiu o contato (ou o negocio ja encerrou), entao a
// IA nao deve mais entrar em contato. Whitelist em vez de blacklist — mais
// seguro do que manter uma lista crescente de status a excluir.
const ELIGIBLE_STATUS = 'LEAD' as const;
const EXCLUDED_TAGS = ['reuniao_agendada', 'followup_desinteresse', FOLLOWUP_RESOLVED_TAG];

// SEM_INTERESSE tambem cobre o caso em que a IA confirmou, numa mensagem ao
// vivo, que o lead esta fora do ICP automotivo (fit=disqualified) — ver o
// mapeamento fit->marketingStage em executeAIAndReply. Sem essa exclusao, um
// lead ja confirmado fora do ICP continuaria recebendo follow-up.
const EXCLUDED_MARKETING_STAGES = ['SEM_INTERESSE', 'CONVERSA_RESOLVIDA'] as const;

const DEFAULT_DELAY_HOURS = 24;
const DEFAULT_MAX_ATTEMPTS = 2;

// Corte deliberado: leads que JA estavam em silencio antes dessa data (ex: os
// ~261 acumulados em AGUARDANDO_FOLLOWUP quando essa politica entrou) nunca
// pediram pra receber follow-up automatico por template — mandar mensagem
// paga em massa pra essa fila existente seria gasto desnecessario. So quem
// ficar em silencio a PARTIR de agora entra no fluxo. Isso nao exclui um
// lead pra sempre: assim que ele voltar a mandar mensagem, a nova janela de
// silencio (a proxima "ultima mensagem") ja e depois do corte, e ele volta a
// ser elegivel normalmente — ver o filtro por m.createdAt abaixo.
export const FOLLOWUP_ACTIVE_SINCE = new Date('2026-07-29T00:00:00Z');

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
    .filter(m => m.direction === 'outbound' && m.createdAt <= cutoff && m.createdAt >= FOLLOWUP_ACTIVE_SINCE)
    .map(m => m.leadId);

  if (silentLeadIds.length === 0) return { sent: 0, evaluated: 0 };

  const eligibleLeads = await prisma.lead.findMany({
    where: {
      id: { in: silentLeadIds },
      deletedAt: null,
      aiHandoff: false,
      status: ELIGIBLE_STATUS,
      followUpCount: { lt: maxAttempts },
      marketingStage: { notIn: [...EXCLUDED_MARKETING_STAGES] },
      NOT: EXCLUDED_TAGS.map(tag => ({ tags: { has: tag } })),
      phone: { not: null },
      // Numero classificado como invalido/nao-WhatsApp por uma falha real de
      // envio (ver classifyWhatsAppError em whatsapp.service.ts) — continuar
      // tentando so gastaria template a toa. Autocurativo: some sozinho se o
      // lead responder ou um envio sair com sucesso depois.
      whatsappInvalidAt: null,
      // Lead pediu pra ser recontatado numa data especifica (ex: "so no mes
      // que vem") — ver acao schedule_followup em applyRecommendedActions.
      // Sem essa data ou ja passada dela, segue elegivel normalmente.
      OR: [{ followUpNotBeforeDate: null }, { followUpNotBeforeDate: { lte: new Date() } }],
    },
    select: { id: true, email: true, phone: true },
  });

  const { sendFollowUpMessage } = await import('./ai-whatsapp-reply.service');
  let sent = 0;
  for (const lead of eligibleLeads) {
    if (!lead.phone) continue;
    try {
      // A avaliacao de silencio, sozinha, nao muda a etapa do CRM. O lead so
      // entra em AGUARDANDO_FOLLOWUP depois que a Lara confirmar que existe
      // uma pendencia real e o envio realmente sair.
      const didSend = await sendFollowUpMessage(lead.phone);
      sent = countSentFollowUp(sent, didSend);
    } catch (err) {
      console.error(`[AI-Followup] erro ao processar lead ${lead.id}:`, err);
    }
  }

  return { sent, evaluated: eligibleLeads.length };
}
