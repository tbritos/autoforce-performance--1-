import {
  LaraMarketingStage,
  normalizeAIScoreForFit,
} from './lara-runtime.utils';

const RESEARCH_STAGE_PROXIMITY_MS = 15 * 60 * 1000;
const TERMINAL_STAGES = new Set<LaraMarketingStage>([
  'REUNIAO_AGENDADA',
  'TRANSFERIDO_HUMANO',
]);

type HistoricalLaraLead = {
  marketingStage: LaraMarketingStage;
  marketingStageSource: string | null;
  marketingStageChangedAt: Date | null;
  researchedAt: Date | null;
  researchIcpSignal: string | null;
  aiScore: number | null;
  tags: string[];
  aiHandoff: boolean;
};

export type HistoricalLaraRepairPlan = {
  stage?: LaraMarketingStage;
  aiScore?: number;
  reasons: string[];
};

function wasStageChangedNearResearch(lead: HistoricalLaraLead): boolean {
  if (
    lead.marketingStageSource !== 'ai'
    || !lead.marketingStageChangedAt
    || !lead.researchedAt
  ) {
    return false;
  }

  return Math.abs(
    lead.marketingStageChangedAt.getTime() - lead.researchedAt.getTime(),
  ) <= RESEARCH_STAGE_PROXIMITY_MS;
}

function wasStageSetByLegacyResearch(lead: HistoricalLaraLead): boolean {
  return lead.marketingStage === 'QUALIFICACAO'
    && lead.researchIcpSignal === 'nurture'
    && lead.aiScore === null
    && wasStageChangedNearResearch(lead);
}

function baselineResearchScore(signal: string | null): number | undefined {
  if (signal === 'qualified') return normalizeAIScoreForFit(signal, 70);
  if (signal === 'nurture') return normalizeAIScoreForFit(signal, 40);
  if (signal === 'disqualified') return normalizeAIScoreForFit(signal, 20);
  return undefined;
}

export function planHistoricalLaraRepair(
  lead: HistoricalLaraLead,
): HistoricalLaraRepairPlan {
  const plan: HistoricalLaraRepairPlan = { reasons: [] };

  if (lead.aiScore === null) {
    const baseline = baselineResearchScore(lead.researchIcpSignal);
    if (baseline !== undefined) {
      plan.aiScore = baseline;
      plan.reasons.push(`score base recuperado da pesquisa (${lead.researchIcpSignal})`);
    }
  }

  // Drag-and-drop manual e sempre soberano. Score ausente ainda pode ser
  // preenchido, mas o reparador nunca muda a coluna escolhida por uma pessoa.
  if (lead.marketingStageSource === 'manual' || TERMINAL_STAGES.has(lead.marketingStage)) {
    return plan;
  }

  if (lead.tags.includes('reuniao_agendada')) {
    plan.stage = 'REUNIAO_AGENDADA';
    plan.reasons.push('tag confirma reuniao agendada');
    return plan;
  }

  if (lead.aiHandoff || lead.tags.includes('transferido-para-humano')) {
    plan.stage = 'TRANSFERIDO_HUMANO';
    plan.reasons.push('estado confirma atendimento humano');
    return plan;
  }

  // A tag so corrige uma coluna anterior quando a mudanca aconteceu junto da
  // pesquisa antiga. Nao tira um lead de Aguardando follow-up nem desfaz uma
  // classificacao posterior da conversa apenas porque a tag continua nele.
  if (
    lead.tags.includes('link_agendamento_enviado')
    && ['NOVO', 'QUALIFICACAO', 'NUTRICAO', 'SEM_INTERESSE'].includes(lead.marketingStage)
    && wasStageChangedNearResearch(lead)
  ) {
    plan.stage = 'AGENDA_ENVIADA';
    plan.reasons.push('tag confirma convite de agenda enviado');
    return plan;
  }

  if (wasStageSetByLegacyResearch(lead)) {
    plan.stage = 'NUTRICAO';
    plan.reasons.push('pesquisa antiga marcou nurture como qualificacao');
  }

  return plan;
}
