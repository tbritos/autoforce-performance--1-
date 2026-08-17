import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

export type ScoringOperator = 'equals' | 'not_equals' | 'contains' | 'is_set' | 'is_not_set' | 'gte' | 'lte';

export interface ScoringCondition {
  id: string;
  field: string;
  operator: ScoringOperator;
  value: string;
}

export interface ScoringRules {
  logic: 'AND' | 'OR';
  conditions: ScoringCondition[];
}

// Campos padrao do Lead avaliaveis por uma regra de score — os demais campos
// possiveis vem de LeadCustomFieldDef (customFields, dinamico por tenant).
const STANDARD_FIELDS = new Set([
  'company', 'jobTitle', 'city', 'state', 'status', 'phone', 'siteUrl',
  'firstSource', 'firstMedium', 'firstCampaign', 'firstLandingPage',
  'assignedTo', 'tags', 'researchIcpSignal', 'researchBusinessType',
  'aiScore', 'conversionCount',
]);

export const RECOMMENDED_SCORE_THRESHOLD = 70;

const condition = (id: string, field: string, operator: ScoringOperator, value = ''): ScoringCondition => ({
  id, field, operator, value,
});

// Modelo inicial da AutoForce. Os pesos deixam dados cadastrais e engajamento
// como reforco: sem evidencia real de ICP eles nao bastam para chegar ao corte.
export const RECOMMENDED_SCORING_RULES: Array<{
  name: string;
  logic: 'AND' | 'OR';
  conditions: ScoringCondition[];
  points: number;
  isActive: boolean;
}> = [
  {
    name: 'ICP confirmado pela pesquisa', logic: 'AND', points: 50, isActive: true,
    conditions: [condition('icp-qualified', 'researchIcpSignal', 'equals', 'qualified')],
  },
  {
    name: 'Potencial em nutrição', logic: 'AND', points: 20, isActive: true,
    conditions: [condition('icp-nurture', 'researchIcpSignal', 'equals', 'nurture')],
  },
  {
    name: 'Cargo com poder de decisão', logic: 'OR', points: 20, isActive: true,
    conditions: [
      'sócio', 'socio', 'proprietário', 'proprietario', 'dono', 'diretor', 'head',
      'gerente', 'coordenador', 'gestor', 'ceo', 'cmo', 'fundador', 'presidente',
    ].map((value, index) => condition(`decision-${index}`, 'jobTitle', 'contains', value)),
  },
  {
    name: 'Telefone disponível', logic: 'AND', points: 10, isActive: true,
    conditions: [condition('phone-set', 'phone', 'is_set')],
  },
  {
    name: 'Empresa identificada', logic: 'AND', points: 5, isActive: true,
    conditions: [condition('company-set', 'company', 'is_set')],
  },
  {
    name: 'Site da empresa identificado', logic: 'AND', points: 5, isActive: true,
    conditions: [condition('site-set', 'siteUrl', 'is_set')],
  },
  {
    name: 'Recorrência de conversão', logic: 'AND', points: 10, isActive: true,
    conditions: [condition('conversion-recurring', 'conversionCount', 'gte', '2')],
  },
  {
    name: 'Origem em mídia paga', logic: 'OR', points: 5, isActive: true,
    conditions: ['cpc', 'paid', 'paid_social'].map((value, index) =>
      condition(`paid-${index}`, 'firstMedium', 'equals', value)),
  },
  {
    name: 'Fora do ICP', logic: 'AND', points: -100, isActive: true,
    conditions: [condition('icp-disqualified', 'researchIcpSignal', 'equals', 'disqualified')],
  },
  {
    name: 'Cargo sem poder de decisão', logic: 'OR', points: -40, isActive: true,
    conditions: [
      'consultor de vendas', 'consultora de vendas', 'consultor comercial',
      'consultora comercial', 'vendedor', 'vendedora', 'estagiário', 'estagiaria',
    ].map((value, index) => condition(`non-decision-${index}`, 'jobTitle', 'contains', value)),
  },
];

type LeadForScoring = {
  id: string;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  city: string | null;
  state: string | null;
  status: string;
  firstSource: string | null;
  firstMedium: string | null;
  firstCampaign: string | null;
  firstLandingPage: string | null;
  assignedTo: string | null;
  tags: string[];
  siteUrl: string | null;
  researchIcpSignal: string | null;
  researchBusinessType: string | null;
  aiScore: number | null;
  _count: { conversions: number };
  customFields: unknown;
};

function getFieldValue(lead: LeadForScoring, field: string): string | string[] | number | null {
  if (field === 'conversionCount') return lead._count.conversions;
  if (STANDARD_FIELDS.has(field)) {
    return (lead as unknown as Record<string, string | string[] | number | null>)[field] ?? null;
  }
  const custom = (lead.customFields ?? {}) as Record<string, unknown>;
  const value = custom[field];
  return value == null ? null : String(value);
}

function isEmpty(value: string | string[] | number | null): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return value === '';
}

export function matchesCondition(lead: LeadForScoring, condition: ScoringCondition): boolean {
  const raw = getFieldValue(lead, condition.field);

  if (condition.operator === 'is_set') return !isEmpty(raw);
  if (condition.operator === 'is_not_set') return isEmpty(raw);

  if (condition.operator === 'gte' || condition.operator === 'lte') {
    const actual = Number(raw);
    const target = Number(condition.value);
    if (!Number.isFinite(actual) || !Number.isFinite(target)) return false;
    return condition.operator === 'gte' ? actual >= target : actual <= target;
  }

  const target = (condition.value ?? '').toLowerCase();

  if (Array.isArray(raw)) {
    const hasExact = raw.some(v => String(v).toLowerCase() === target);
    const hasPartial = raw.some(v => String(v).toLowerCase().includes(target));
    if (condition.operator === 'equals') return hasExact;
    if (condition.operator === 'not_equals') return !hasExact;
    if (condition.operator === 'contains') return hasPartial;
    return false;
  }

  const str = String(raw ?? '').toLowerCase();
  if (condition.operator === 'equals') return str === target;
  if (condition.operator === 'not_equals') return str !== target;
  if (condition.operator === 'contains') return str.includes(target);
  return false;
}

export function evaluateRules(lead: LeadForScoring, rules: Array<{ id: string; logic: string; conditions: unknown; points: number }>): number {
  let total = 0;
  for (const rule of rules) {
    const parsed = rule.conditions as ScoringCondition[];
    if (!Array.isArray(parsed) || parsed.length === 0) continue;
    const results = parsed.map(c => matchesCondition(lead, c));
    const matched = rule.logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
    if (matched) total += rule.points;
  }
  return Math.max(0, Math.min(100, total));
}

const LEAD_SELECT_FOR_SCORING = {
  id: true, score: true, phone: true, company: true, jobTitle: true, city: true, state: true, status: true,
  firstSource: true, firstMedium: true, firstCampaign: true, firstLandingPage: true,
  assignedTo: true, tags: true, siteUrl: true, researchIcpSignal: true,
  researchBusinessType: true, aiScore: true, customFields: true,
  _count: { select: { conversions: true } },
} as const;

function scoringBands(scores: number[]) {
  return {
    qualified: scores.filter(score => score >= RECOMMENDED_SCORE_THRESHOLD).length,
    nurture: scores.filter(score => score >= 40 && score < RECOMMENDED_SCORE_THRESHOLD).length,
    low: scores.filter(score => score < 40).length,
  };
}

export class LeadScoringService {
  static async listRules() {
    return prisma.leadScoringRule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  static async getRule(id: string) {
    return prisma.leadScoringRule.findUniqueOrThrow({ where: { id } });
  }

  static async createRule(data: { name: string; logic?: 'AND' | 'OR'; conditions: ScoringCondition[]; points: number; isActive?: boolean }) {
    return prisma.leadScoringRule.create({
      data: {
        name: data.name,
        logic: data.logic ?? 'AND',
        conditions: data.conditions as unknown as Prisma.InputJsonValue,
        points: data.points,
        isActive: data.isActive ?? true,
      },
    });
  }

  static async updateRule(id: string, data: { name?: string; logic?: 'AND' | 'OR'; conditions?: ScoringCondition[]; points?: number; isActive?: boolean }) {
    return prisma.leadScoringRule.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.logic !== undefined ? { logic: data.logic } : {}),
        ...(data.conditions !== undefined ? { conditions: data.conditions as unknown as Prisma.InputJsonValue } : {}),
        ...(data.points !== undefined ? { points: data.points } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  static async deleteRule(id: string) {
    return prisma.leadScoringRule.delete({ where: { id } });
  }

  // Publico pra quem precisa pre-carregar as regras uma vez fora de um loop
  // (ex: importacao de CSV) e repassar em cada chamada de applyScoringRulesToLead.
  static async activeRules() {
    return prisma.leadScoringRule.findMany({ where: { isActive: true } });
  }

  // Chamado logo apos criar um lead novo (ver ganchos em lead-hub.service.ts,
  // whatsapp.service.ts, server.ts). `preloadedRules` evita 1 consulta por
  // lead em loops grandes (ex: importacao de CSV) — quem chama em massa busca
  // as regras uma vez so e repassa.
  static async applyScoringRulesToLead(
    leadId: string,
    preloadedRules?: Array<{ id: string; logic: string; conditions: unknown; points: number }>
  ): Promise<number> {
    const rules = preloadedRules ?? await LeadScoringService.activeRules();
    if (rules.length === 0) return 0;

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: LEAD_SELECT_FOR_SCORING });
    if (!lead) return 0;

    const total = evaluateRules(lead, rules);
    if (lead.score !== total) {
      await prisma.lead.update({ where: { id: leadId }, data: { score: total } });
    }
    return total;
  }

  static async installRecommendedRules() {
    const recommendedNames = RECOMMENDED_SCORING_RULES.map(rule => rule.name);
    const deactivated = await prisma.$transaction(async tx => {
      const result = await tx.leadScoringRule.updateMany({ where: { isActive: true }, data: { isActive: false } });
      await tx.leadScoringRule.deleteMany({ where: { name: { in: recommendedNames } } });
      await tx.leadScoringRule.createMany({
        data: RECOMMENDED_SCORING_RULES.map(rule => ({
          ...rule,
          conditions: rule.conditions as unknown as Prisma.InputJsonValue,
        })),
      });
      return result.count;
    });
    return {
      threshold: RECOMMENDED_SCORE_THRESHOLD,
      deactivated,
      rules: await LeadScoringService.listRules(),
    };
  }

  // Recalculo deterministico: cada lead recebe exatamente a soma atual das
  // regras. Repetir a operacao nunca infla a pontuacao.
  static async applyScoringRulesToExistingLeads(): Promise<{
    updated: number;
    evaluated: number;
    threshold: number;
    bands: { qualified: number; nurture: number; low: number };
  }> {
    const rules = await LeadScoringService.activeRules();
    if (rules.length === 0) {
      return { updated: 0, evaluated: 0, threshold: RECOMMENDED_SCORE_THRESHOLD, bands: { qualified: 0, nurture: 0, low: 0 } };
    }

    const leads = await prisma.lead.findMany({ where: { deletedAt: null }, select: LEAD_SELECT_FOR_SCORING });
    const idsByScore = new Map<number, string[]>();
    const scores: number[] = [];
    let updated = 0;
    for (const lead of leads) {
      const total = evaluateRules(lead, rules);
      scores.push(total);
      if (lead.score !== total) {
        idsByScore.set(total, [...(idsByScore.get(total) ?? []), lead.id]);
        updated++;
      }
    }

    for (const [score, ids] of idsByScore) {
      for (let index = 0; index < ids.length; index += 1_000) {
        await prisma.lead.updateMany({
          where: { id: { in: ids.slice(index, index + 1_000) } },
          data: { score },
        });
      }
    }

    return {
      updated,
      evaluated: leads.length,
      threshold: RECOMMENDED_SCORE_THRESHOLD,
      bands: scoringBands(scores),
    };
  }
}
