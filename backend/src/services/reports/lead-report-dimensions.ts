import { ReportFilterCondition, conditionToWhereValue } from './report-filter-ops';

export const LEAD_TAG_DIMENSION = 'tag';
export const LEAD_CONVERSION_DIMENSION = 'conversionSource';
export const NO_TAG_LABEL = 'Sem etiqueta';
export const NO_CONVERSION_LABEL = 'Sem conversão';

export function isLeadMultiValueDimension(field: string | null | undefined): boolean {
  return field === LEAD_TAG_DIMENSION || field === LEAD_CONVERSION_DIMENSION;
}

function appendAnd(where: Record<string, unknown>, clause: Record<string, unknown>): void {
  const current = where.AND;
  const clauses = Array.isArray(current) ? current : current ? [current] : [];
  where.AND = [...clauses, clause];
}

function tagFilter(condition: ReportFilterCondition): Record<string, unknown> | null {
  if (condition.operator === 'is_set') return { tags: { isEmpty: false } };
  if (condition.operator === 'is_not_set') return { tags: { isEmpty: true } };
  if (condition.operator === 'equals') return { tags: { has: condition.value } };
  if (condition.operator === 'not_equals') return { NOT: { tags: { has: condition.value } } };
  return null;
}

function conversionFilter(condition: ReportFilterCondition): Record<string, unknown> | null {
  if (condition.operator === 'is_set') return { conversions: { some: {} } };
  if (condition.operator === 'is_not_set') return { conversions: { none: {} } };
  if (condition.operator === 'equals') return { conversions: { some: { source: condition.value } } };
  if (condition.operator === 'not_equals') return { conversions: { none: { source: condition.value } } };
  if (condition.operator === 'contains') {
    return { conversions: { some: { source: { contains: condition.value, mode: 'insensitive' } } } };
  }
  return null;
}

// Etiquetas são um array no Lead e conversões vivem numa relação. Este helper
// transforma os dois campos virtuais do construtor de relatórios em filtros
// Prisma reais e mantém todas as condições combinadas com AND.
export function applyLeadReportConditions(
  where: Record<string, unknown>,
  conditions: ReportFilterCondition[],
): void {
  for (const condition of conditions) {
    let clause: Record<string, unknown> | null = null;
    if (condition.field === LEAD_TAG_DIMENSION) clause = tagFilter(condition);
    else if (condition.field === LEAD_CONVERSION_DIMENSION) clause = conversionFilter(condition);
    else {
      const rhs = conditionToWhereValue(condition.field, condition.operator, condition.value);
      if (rhs !== undefined) clause = { [condition.field]: rhs };
    }
    if (clause) appendAnd(where, clause);
  }
}

export function applyLeadDimensionSlice(
  where: Record<string, unknown>,
  groupBy: string | null,
  dimension: string | null | undefined,
): void {
  if (!groupBy || dimension == null) return;
  if (groupBy === LEAD_TAG_DIMENSION) {
    appendAnd(where, dimension === NO_TAG_LABEL
      ? { tags: { isEmpty: true } }
      : { tags: { has: dimension } });
  }
  if (groupBy === LEAD_CONVERSION_DIMENSION) {
    appendAnd(where, dimension === NO_CONVERSION_LABEL
      ? { conversions: { none: {} } }
      : { conversions: { some: { source: dimension } } });
  }
}
