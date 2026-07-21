import { prisma } from '../../config/database';
import { getMetricDef, isDateBucket, MetricDef, DateBucket } from './metrics-catalog';
import { ReportFilterCondition, conditionToWhereValue, sanitizeConditionsForMetric } from './report-filter-ops';

export const DATE_PRESETS = ['last_7_days', 'last_30_days', 'this_month', 'last_month', 'this_quarter', 'last_quarter'] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export interface RunMetricQueryParams {
  metricKey: string;
  groupBy?: string | null;
  filters?: ReportFilterCondition[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  datePreset?: string | null;
}

export interface MetricQueryResult {
  rows: Array<{ dimension: string; value: number }>;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

export function validateGroupBy(def: MetricDef, groupBy: string | null | undefined): string | null {
  if (!groupBy) return null;
  if (!def.groupableDimensions.includes(groupBy)) {
    throw new Error(`Agrupamento "${groupBy}" não é suportado pela métrica "${def.key}"`);
  }
  return groupBy;
}

// Aplica uma lista de condicoes (campo+operador+valor) direto num objeto
// where flat — usado por toda fonte exceto campanhas, que tem o caso especial
// de "platform" morar numa relacao (Campaign), nao na propria tabela.
export function applyConditions(where: Record<string, unknown>, conditions: ReportFilterCondition[]): void {
  for (const c of conditions) {
    const rhs = conditionToWhereValue(c.field, c.operator, c.value);
    if (rhs !== undefined) where[c.field] = rhs;
  }
}

// Recalcula o período toda vez que a métrica é consultada — "mês passado"
// aponta sempre pro mês anterior ao atual, nunca uma data congelada.
export function resolveDatePreset(preset: string, now: Date = new Date()): { dateFrom: string; dateTo: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (preset as DatePreset) {
    case 'last_7_days': {
      const to = new Date(now);
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { dateFrom: fmt(from), dateTo: fmt(to) };
    }
    case 'last_30_days': {
      const to = new Date(now);
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { dateFrom: fmt(from), dateTo: fmt(to) };
    }
    case 'this_month':
      return { dateFrom: fmt(new Date(y, m, 1)), dateTo: fmt(new Date(y, m + 1, 0)) };
    case 'last_month':
      return { dateFrom: fmt(new Date(y, m - 1, 1)), dateTo: fmt(new Date(y, m, 0)) };
    case 'this_quarter': {
      const q = Math.floor(m / 3);
      return { dateFrom: fmt(new Date(y, q * 3, 1)), dateTo: fmt(new Date(y, q * 3 + 3, 0)) };
    }
    case 'last_quarter': {
      const q = Math.floor(m / 3) - 1;
      return { dateFrom: fmt(new Date(y, q * 3, 1)), dateTo: fmt(new Date(y, q * 3 + 3, 0)) };
    }
    default:
      throw new Error(`Preset de data desconhecido: ${preset}`);
  }
}

export function dateRangeFilter(dateFrom?: string | null, dateTo?: string | null) {
  if (!dateFrom && !dateTo) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (dateFrom) range.gte = new Date(dateFrom + 'T00:00:00');
  if (dateTo) range.lte = new Date(dateTo + 'T23:59:59');
  return range;
}

// ISO-ish week label: "2026-W29". Usa sempre getUTC* (nunca getFullYear/
// getMonth/getDate locais) — misturar os dois faria essa label depender do
// fuso horário local do processo Node, e o drill-down (report-drilldown.service.ts)
// precisa inverter essa label de volta pro intervalo de datas exato.
function isoWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function bucketDateLabel(date: Date, bucket: DateBucket): string {
  if (bucket === 'date_day') return date.toISOString().slice(0, 10);
  if (bucket === 'date_month') return date.toISOString().slice(0, 7);
  return isoWeekLabel(date);
}

// Extracts the grouping label from a flattened row. `row` must already contain
// every groupable dimension as a direct property (relations pre-flattened by
// the caller).
function dimensionValue(row: Record<string, unknown>, groupBy: string | null, dateField: string | null): string {
  if (!groupBy) return 'total';
  if (isDateBucket(groupBy)) {
    const raw = dateField ? row[dateField] : null;
    if (!raw) return 'Sem data';
    return bucketDateLabel(new Date(raw as string | Date), groupBy);
  }
  const val = row[groupBy];
  if (val == null || val === '') return 'Não informado';
  if (Array.isArray(val)) return val.length ? val.join(', ') : 'Não informado';
  return String(val);
}

// Aggregates flattened rows into { dimension, value } buckets.
function aggregate(
  rows: Array<Record<string, unknown>>,
  def: MetricDef,
  groupBy: string | null
): MetricQueryResult {
  const buckets = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const dim = dimensionValue(row, groupBy, def.dateField);
    const raw = def.aggregation === 'count' ? 0 : Number(row[def.valueField!] ?? 0);
    const b = buckets.get(dim) ?? { sum: 0, count: 0 };
    b.sum += raw;
    b.count += 1;
    buckets.set(dim, b);
  }
  const rowsOut = Array.from(buckets.entries()).map(([dimension, b]) => ({
    dimension,
    value: def.aggregation === 'count' ? b.count : def.aggregation === 'avg' ? (b.count > 0 ? b.sum / b.count : 0) : b.sum,
  }));
  rowsOut.sort((a, b) => a.dimension.localeCompare(b.dimension));
  return { rows: rowsOut };
}

// ─── Per-source handlers ──────────────────────────────────────────────────────

async function queryLeads(def: MetricDef, groupBy: string | null, conditions: ReportFilterCondition[], dateFrom?: string | null, dateTo?: string | null): Promise<MetricQueryResult> {
  if (def.key === 'leads.count') {
    const where: Record<string, unknown> = { deletedAt: null };
    applyConditions(where, conditions);
    if (dateFrom || dateTo) where.firstSeenAt = dateRangeFilter(dateFrom, dateTo);
    const rows = await prisma.lead.findMany({
      where,
      select: { status: true, firstSource: true, firstMedium: true, assignedTo: true, firstSeenAt: true },
    });
    return aggregate(rows, def, groupBy);
  }

  if (def.key === 'leads.status_transitions') {
    const where: Record<string, unknown> = {};
    applyConditions(where, conditions);
    if (dateFrom || dateTo) where.changedAt = dateRangeFilter(dateFrom, dateTo);
    const rows = await prisma.leadStatusHistory.findMany({
      where,
      select: { toStatus: true, changedAt: true },
    });
    return aggregate(rows, def, groupBy);
  }

  // leads.forecast_mrr / leads.forecast_setup — live Pipedrive snapshot, not date-bound
  const where: Record<string, unknown> = {
    deletedAt: null,
    pipedriveDealId: { not: null },
    pipedriveDealStatus: 'open',
  };
  applyConditions(where, conditions);
  const rows = await prisma.lead.findMany({
    where,
    select: { pipedriveDealValue: true, pipedriveSetupValue: true, pipedriveStageName: true, pipedrivePipelineId: true },
  });
  return aggregate(rows, def, groupBy);
}

async function queryRevenue(def: MetricDef, groupBy: string | null, conditions: ReportFilterCondition[], dateFrom?: string | null, dateTo?: string | null): Promise<MetricQueryResult> {
  const where: Record<string, unknown> = {};
  applyConditions(where, conditions);
  if (dateFrom || dateTo) where.date = dateRangeFilter(dateFrom, dateTo);
  const rows = await prisma.revenueEntry.findMany({
    where,
    select: { mrrValue: true, setupValue: true, origin: true, closedBy: true, originType: true, date: true },
  });
  return aggregate(rows, def, groupBy);
}

async function queryCampaigns(def: MetricDef, groupBy: string | null, conditions: ReportFilterCondition[], dateFrom?: string | null, dateTo?: string | null): Promise<MetricQueryResult> {
  const where: Record<string, unknown> = {};
  let campaignWhere: Record<string, unknown> | undefined;
  for (const c of conditions) {
    const rhs = conditionToWhereValue(c.field, c.operator, c.value);
    if (rhs === undefined) continue;
    if (c.field === 'platform') campaignWhere = { ...(campaignWhere ?? {}), platform: rhs };
    else where[c.field] = rhs;
  }
  if (dateFrom || dateTo) where.date = dateRangeFilter(dateFrom, dateTo);
  if (campaignWhere) where.campaign = campaignWhere;

  const rows = await prisma.campaignMetrics.findMany({
    where,
    select: {
      spend: true, impressions: true, clicks: true, leads: true, conversions: true,
      date: true, campaignId: true,
      campaign: { select: { platform: true } },
    },
  });
  const flat = rows.map(r => ({ ...r, platform: r.campaign?.platform ?? null }));
  return aggregate(flat, def, groupBy);
}

async function queryGa4(def: MetricDef, groupBy: string | null, conditions: ReportFilterCondition[]): Promise<MetricQueryResult> {
  const where: Record<string, unknown> = {};
  applyConditions(where, conditions);
  const rows = await prisma.landingPage.findMany({
    where,
    select: { sessions: true, views: true, conversions: true, bounceRate: true, path: true, name: true },
  });
  return aggregate(rows, def, groupBy);
}

async function queryEmail(def: MetricDef, groupBy: string | null, conditions: ReportFilterCondition[], dateFrom?: string | null, dateTo?: string | null): Promise<MetricQueryResult> {
  const where: Record<string, unknown> = {};
  applyConditions(where, conditions);
  if (dateFrom || dateTo) where.date = dateRangeFilter(dateFrom, dateTo);
  const rows = await prisma.emailCampaign.findMany({
    where,
    select: { sends: true, opens: true, clicks: true, bounce: true, unsubscribes: true, source: true, date: true },
  });
  return aggregate(rows, def, groupBy);
}

// ─── Entry point ───────────────────────────────────────────────────────────────

export async function runMetricQuery(params: RunMetricQueryParams): Promise<MetricQueryResult> {
  const def = getMetricDef(params.metricKey);
  const groupBy = validateGroupBy(def, params.groupBy);
  const conditions = sanitizeConditionsForMetric(def, params.filters);

  let dateFrom = params.dateFrom;
  let dateTo = params.dateTo;
  if (params.datePreset && params.datePreset !== 'custom') {
    const resolved = resolveDatePreset(params.datePreset);
    dateFrom = resolved.dateFrom;
    dateTo = resolved.dateTo;
  }
  dateFrom = def.dateField ? dateFrom : null;
  dateTo = def.dateField ? dateTo : null;

  switch (def.source) {
    case 'leads':     return queryLeads(def, groupBy, conditions, dateFrom, dateTo);
    case 'revenue':   return queryRevenue(def, groupBy, conditions, dateFrom, dateTo);
    case 'campaigns': return queryCampaigns(def, groupBy, conditions, dateFrom, dateTo);
    case 'ga4':       return queryGa4(def, groupBy, conditions);
    case 'email':     return queryEmail(def, groupBy, conditions, dateFrom, dateTo);
    default:          throw new Error(`Fonte de dados desconhecida: ${def.source}`);
  }
}
