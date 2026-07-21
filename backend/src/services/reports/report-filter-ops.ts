import { MetricDef, MetricSource } from './metrics-catalog';

export type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'is_set' | 'is_not_set';

export interface ReportFilterCondition {
  id: string;
  source: MetricSource;
  field: string;
  operator: FilterOperator;
  value: string;
}

// Campos onde "contém" não faz sentido: status/toStatus são enums no banco
// (Prisma rejeita `contains` num enum), pipedrivePipelineId/pipedriveStageId
// são numéricos (Int).
export const ENUM_FILTER_FIELDS = new Set(['status', 'toStatus']);
export const NUMERIC_FILTER_FIELDS = new Set(['pipedrivePipelineId', 'pipedriveStageId']);

export function allowedOperatorsFor(field: string): FilterOperator[] {
  const ALL: FilterOperator[] = ['equals', 'not_equals', 'contains', 'is_set', 'is_not_set'];
  return (ENUM_FILTER_FIELDS.has(field) || NUMERIC_FILTER_FIELDS.has(field))
    ? ALL.filter(o => o !== 'contains')
    : ALL;
}

// RHS pra `where[field] = <isso>` — undefined = condição inválida, quem chama
// deve descartar (nao escrever nada nesse campo do where).
export function conditionToWhereValue(field: string, operator: FilterOperator, value: string): unknown {
  if (operator === 'is_set') return { not: null };
  if (operator === 'is_not_set') return null;

  const numeric = NUMERIC_FILTER_FIELDS.has(field);
  const coerced: unknown = numeric ? Number(value) : value;
  if (numeric && Number.isNaN(coerced as number)) return undefined;

  if (operator === 'equals') return coerced;
  if (operator === 'not_equals') return { not: coerced };
  if (operator === 'contains') {
    if (numeric || ENUM_FILTER_FIELDS.has(field)) return undefined;
    return { contains: value, mode: 'insensitive' as const };
  }
  return undefined;
}

// Substitui o antigo validateFilters — mesma filosofia permissiva (filtro que
// nao se aplica a metrica e ignorado, nao vira erro), agora tambem descarta
// combinacao de operador invalida pro campo e condicoes sem valor (exceto
// is_set/is_not_set, que dispensam valor).
export function sanitizeConditionsForMetric(
  def: MetricDef,
  conditions: ReportFilterCondition[] | null | undefined
): ReportFilterCondition[] {
  if (!conditions) return [];
  return conditions.filter(c => {
    if (!c.field || c.source !== def.source) return false;
    if (!def.filterableDimensions.includes(c.field)) return false;
    if (!allowedOperatorsFor(c.field).includes(c.operator)) return false;
    if (c.operator !== 'is_set' && c.operator !== 'is_not_set' && !c.value) return false;
    return true;
  });
}
