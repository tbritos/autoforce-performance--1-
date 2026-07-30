import { prisma } from '../config/database';
import { normalizeEmail } from './lead-hub.service';

export type LeadActivitySource = 'ai' | 'system' | 'manual' | 'research';

// Registro de decisoes relevantes que o agente de IA (ou o sistema) toma
// sobre um lead — aparece na aba "Linha do Tempo" do perfil. Deliberadamente
// separado de AIInteractionLog (registra toda troca de mensagem, nao so
// decisoes) pra nao poluir essa timeline com uma linha por mensagem trocada.
// Nunca lanca erro pra fora — uma falha ao registrar atividade nao pode
// quebrar o fluxo principal (envio de mensagem, mudanca de estagio etc.).
export async function logLeadActivity(
  leadEmailRaw: string,
  type: string,
  message: string,
  reason?: string | null,
  source: LeadActivitySource = 'ai'
): Promise<void> {
  try {
    const leadEmail = normalizeEmail(leadEmailRaw);
    await prisma.leadActivity.create({
      data: { leadEmail, type, message, reason: reason ?? null, source },
    });
  } catch (err) {
    console.error(`[LeadActivity] falha ao registrar atividade (${type}) para ${leadEmailRaw}:`, err);
  }
}
