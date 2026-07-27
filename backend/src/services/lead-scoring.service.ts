import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

export type ScoringOperator = 'equals' | 'not_equals' | 'contains' | 'is_set' | 'is_not_set';

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
  'company', 'jobTitle', 'city', 'state', 'status',
  'firstSource', 'firstMedium', 'firstCampaign', 'firstLandingPage',
  'assignedTo', 'tags',
]);

type LeadForScoring = {
  id: string;
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
  customFields: unknown;
};

function getFieldValue(lead: LeadForScoring, field: string): string | string[] | null {
  if (STANDARD_FIELDS.has(field)) {
    return (lead as unknown as Record<string, string | string[] | null>)[field] ?? null;
  }
  const custom = (lead.customFields ?? {}) as Record<string, unknown>;
  const value = custom[field];
  return value == null ? null : String(value);
}

function isEmpty(value: string | string[] | null): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  return value === '';
}

export function matchesCondition(lead: LeadForScoring, condition: ScoringCondition): boolean {
  const raw = getFieldValue(lead, condition.field);

  if (condition.operator === 'is_set') return !isEmpty(raw);
  if (condition.operator === 'is_not_set') return isEmpty(raw);

  const target = (condition.value ?? '').toLowerCase();

  if (Array.isArray(raw)) {
    const hasExact = raw.some(v => String(v).toLowerCase() === target);
    const hasPartial = raw.some(v => String(v).toLowerCase().includes(target));
    if (condition.operator === 'equals') return hasExact;
    if (condition.operator === 'not_equals') return !hasExact;
    if (condition.operator === 'contains') return hasPartial;
    return false;
  }

  const str = (raw ?? '').toLowerCase();
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
  return total;
}

const LEAD_SELECT_FOR_SCORING = {
  id: true, company: true, jobTitle: true, city: true, state: true, status: true,
  firstSource: true, firstMedium: true, firstCampaign: true, firstLandingPage: true,
  assignedTo: true, tags: true, customFields: true,
} as const;

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
    if (total !== 0) {
      await prisma.lead.update({ where: { id: leadId }, data: { score: { increment: total } } });
    }
    return total;
  }

  // Backfill sob demanda (botao "Aplicar aos leads existentes") — roda as
  // regras ativas contra todo lead nao deletado. Rodar de novo soma pontos de
  // novo, mesmo comportamento ja aceito hoje na acao "somar score" das regras
  // de classificacao (LeadClassificationRule).
  static async applyScoringRulesToExistingLeads(): Promise<{ updated: number; evaluated: number }> {
    const rules = await LeadScoringService.activeRules();
    if (rules.length === 0) return { updated: 0, evaluated: 0 };

    const leads = await prisma.lead.findMany({ where: { deletedAt: null }, select: LEAD_SELECT_FOR_SCORING });
    let updated = 0;
    for (const lead of leads) {
      const total = evaluateRules(lead, rules);
      if (total !== 0) {
        await prisma.lead.update({ where: { id: lead.id }, data: { score: { increment: total } } });
        updated++;
      }
    }
    return { updated, evaluated: leads.length };
  }
}
