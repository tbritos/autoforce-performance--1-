export type LaraMarketingStage =
  | 'NOVO'
  | 'QUALIFICACAO'
  | 'NUTRICAO'
  | 'AGUARDANDO_FOLLOWUP'
  | 'AGENDA_ENVIADA'
  | 'REUNIAO_AGENDADA'
  | 'SEM_INTERESSE'
  | 'TRANSFERIDO_HUMANO';

export type LaraMarketingStageSource = 'ai' | 'system' | 'manual' | 'research';
export type LaraResearchFit = 'qualified' | 'nurture' | 'disqualified';

const TERMINAL_AUTOMATION_STAGES: LaraMarketingStage[] = [
  'REUNIAO_AGENDADA',
  'TRANSFERIDO_HUMANO',
];

// Pesquisa publica e uma evidencia auxiliar e pode chegar de forma
// assincrona. Ela nao deve vencer estados que comprovam uma interacao mais
// recente com o lead (silencio ja tratado, convite enviado, reuniao ou
// atendimento humano).
const RESEARCH_PROTECTED_STAGES: LaraMarketingStage[] = [
  'AGUARDANDO_FOLLOWUP',
  'AGENDA_ENVIADA',
  ...TERMINAL_AUTOMATION_STAGES,
];

const DEFAULT_AI_REQUEST_TIMEOUT_MS = 45_000;
const MIN_AI_REQUEST_TIMEOUT_MS = 5_000;
const MAX_AI_REQUEST_TIMEOUT_MS = 120_000;
const RESEARCH_RETRY_BACKOFF_MS = [0, 5 * 60 * 1000, 30 * 60 * 1000];

// A partir deste corte, todo lead novo pode entrar no CRM/pesquisa da Lara,
// independentemente de tag ou origem (inclusive importacao e RD). O corte
// evita que a liberacao reprocesse automaticamente toda a base historica.
export const LARA_NEW_LEADS_ACTIVE_SINCE = new Date('2026-07-30T03:00:00.000Z');

export async function withAbortableTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string,
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort();
  if (parentSignal?.aborted) controller.abort();
  else parentSignal?.addEventListener('abort', abortFromParent, { once: true });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error(`Timeout (${timeoutMs}ms): ${label}`));
    }, timeoutMs);
  });

  try {
    if (parentSignal?.aborted) throw new Error(`Operacao cancelada: ${label}`);
    return await Promise.race([operation(controller.signal), timeout]);
  } catch (error) {
    if (timedOut) throw new Error(`Timeout (${timeoutMs}ms): ${label}`);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    parentSignal?.removeEventListener('abort', abortFromParent);
  }
}

export function resolveAIRequestTimeout(rawValue: string | undefined): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  const value = Number.isFinite(parsed) ? parsed : DEFAULT_AI_REQUEST_TIMEOUT_MS;
  return Math.min(MAX_AI_REQUEST_TIMEOUT_MS, Math.max(MIN_AI_REQUEST_TIMEOUT_MS, value));
}

export async function fetchWithAIRequestTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = resolveAIRequestTimeout(process.env.AI_REQUEST_TIMEOUT_MS),
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Timeout da IA apos ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function shouldScheduleAIReply(agentNumber: boolean, aiProcessedAt: Date | null): boolean {
  return agentNumber && aiProcessedAt === null;
}

export function clampAIScore(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function normalizeAIScoreForFit(fit: LaraResearchFit, value: unknown): number {
  const score = clampAIScore(value);
  if (fit === 'qualified') return Math.max(70, score);
  if (fit === 'disqualified') return Math.min(39, score);
  return Math.min(69, score);
}

export function shouldPersistAIAnalysis(source: string): boolean {
  return source !== 'fallback';
}

export function marketingStageForResearchFit(fit: LaraResearchFit): LaraMarketingStage {
  if (fit === 'qualified') return 'QUALIFICACAO';
  if (fit === 'nurture') return 'NUTRICAO';
  return 'SEM_INTERESSE';
}

export function marketingStageForAIConversation(
  fit: LaraResearchFit,
  qualificationStage?: 'qualificacao' | 'nutricao',
): LaraMarketingStage | null {
  if (fit === 'disqualified') return 'SEM_INTERESSE';
  if (fit === 'nurture') {
    return qualificationStage === 'nutricao' ? 'NUTRICAO' : 'QUALIFICACAO';
  }
  return null;
}

export function resolveAIHotState(input: {
  fit: string;
  score: number;
  pain?: string;
  urgency?: string;
  isHot?: boolean;
}): boolean {
  if (input.fit === 'disqualified') return false;
  return input.isHot === true
    || input.score >= 70
    || input.fit === 'qualified'
    || Boolean(input.pain && ['alta', 'urgente'].includes(String(input.urgency).toLowerCase()));
}

export function protectedMarketingStagesForSource(
  source: LaraMarketingStageSource,
): LaraMarketingStage[] {
  if (source === 'manual') return [];
  if (source === 'research') return [...RESEARCH_PROTECTED_STAGES];
  return [...TERMINAL_AUTOMATION_STAGES];
}

export function researchRetryDelayMs(completedAttempts: number): number {
  return RESEARCH_RETRY_BACKOFF_MS[completedAttempts] ?? 2 * 60 * 60 * 1000;
}

export function pendingResearchFailureData(): {
  researchedAt: null;
  researchAttempts: { increment: 1 };
} {
  return {
    researchedAt: null,
    researchAttempts: { increment: 1 },
  };
}

export function isResearchRetryDue(
  completedAttempts: number,
  firstSeenAt: Date,
  researchStartedAt: Date | null,
  nowMs = Date.now(),
): boolean {
  const reference = completedAttempts > 0 && researchStartedAt
    ? researchStartedAt
    : firstSeenAt;
  return nowMs - reference.getTime() >= researchRetryDelayMs(completedAttempts);
}

export function resolveHandoffReturnStage(
  previousStage: LaraMarketingStage | null,
): LaraMarketingStage {
  if (!previousStage || previousStage === 'TRANSFERIDO_HUMANO') {
    return 'QUALIFICACAO';
  }
  return previousStage;
}

export function isHumanHandoffStage(stage: LaraMarketingStage): boolean {
  return stage === 'TRANSFERIDO_HUMANO';
}

export function countSentFollowUp(currentCount: number, didSend: boolean): number {
  return didSend ? currentCount + 1 : currentCount;
}

export function kanbanCardQueryLimit(
  includeAll: boolean,
  defaultLimit = 50,
): { take?: number } {
  return includeAll ? {} : { take: defaultLimit };
}
