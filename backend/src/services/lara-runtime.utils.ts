export type LaraMarketingStage =
  | 'NOVO'
  | 'QUALIFICACAO'
  | 'NUTRICAO'
  | 'AGUARDANDO_FOLLOWUP'
  | 'AGENDA_ENVIADA'
  | 'REUNIAO_AGENDADA'
  | 'SEM_INTERESSE'
  | 'TRANSFERIDO_HUMANO';

const DEFAULT_AI_REQUEST_TIMEOUT_MS = 45_000;
const MIN_AI_REQUEST_TIMEOUT_MS = 5_000;
const MAX_AI_REQUEST_TIMEOUT_MS = 120_000;

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
