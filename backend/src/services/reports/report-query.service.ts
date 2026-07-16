import { prisma } from '../../config/database';
import { getMetricDef, isDateBucket, MetricDef, DateBucket } from './metrics-catalog';

export interface RunMetricQueryParams {
  metricKey: string;
  groupBy?: string | null;
  filters?: Record<string, string> | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface MetricQueryResult {
  rows: Array<{ dimension: string; value: number }>;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function validateGroupBy(def: MetricDef, groupBy: string | null | undefined): string | null {
  if (!groupBy) return null;
  if (!def.groupableDimensions.includes(groupBy)) {
    throw new Error(`Agrupamento "${groupBy}" não é suportado pela métrica "${def.key}"`);
  }
  return groupBy;
}

function validateFilters(def: MetricDef, filters: Record<string, string> | null | undefined): Record<string, string> {
  if (!filters) return {};
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v == null || v === '') continue;
    if (!def.filterableDimensions.includes(k)) {
      throw new Error(`Filtro "${k}" não é suportado pela métrica "${def.key}"`);
    }
    clean[k] = v;
  }
  return clean;
}

function dateRangeFilter(dateFrom?: string | null, dateTo?: string | null) {
  if (!dateFrom && !dateTo) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (dateFrom) range.gte = new Date(dateFrom + 'T00:00:00');
  if (dateTo) range.lte = new Date(dateTo + 'T23:59:59');
  return range;
}

// ISO-ish week label: "2026-W29"
function isoWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
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

async function queryLeads(def: MetricDef, groupBy: string | null, filters: Record<string, string>, dateFrom?: string | null, dateTo?: string | null): Promise<MetricQueryResult> {
  if (def.key === 'leads.count') {
    const where: Record<string, unknown> = { deletedAt: null, ...filters };
    if (dateFrom || dateTo) where.firstSeenAt = dateRangeFilter(dateFrom, dateTo);
    const rows = await prisma.lead.findMany({
      where,
      select: { status: true, firstSource: true, firstMedium: true, assignedTo: true, firstSeenAt: true },
    });
    return aggregate(rows, def, groupBy);
  }

  if (def.key === 'leads.status_transitions') {
    const where: Record<string, unknown> = { ...filters };
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
    ...filters,
  };
  const rows = await prisma.lead.findMany({
    where,
    select: { pipedriveDealValue: true, pipedriveSetupValue: true, pipedriveStageName: true, pipedrivePipelineId: true },
  });
  return aggregate(rows, def, groupBy);
}

async function queryRevenue(def: MetricDef, groupBy: string | null, filters: Record<string, string>, dateFrom?: string | null, dateTo?: string | null): Promise<MetricQueryResult> {
  const where: Record<string, unknown> = { ...filters };
  if (dateFrom || dateTo) where.date = dateRangeFilter(dateFrom, dateTo);
  const rows = await prisma.revenueEntry.findMany({
    where,
    select: { mrrValue: true, setupValue: true, origin: true, closedBy: true, originType: true, date: true },
  });
  return aggregate(rows, def, groupBy);
}

async function queryCampaigns(def: MetricDef, groupBy: string | null, filters: Record<string, string>, dateFrom?: string | null, dateTo?: string | null): Promise<MetricQueryResult> {
  const { platform, ...campaignScalarFilters } = filters;
  const where: Record<string, unknown> = { ...campaignScalarFilters };
  if (dateFrom || dateTo) where.date = dateRangeFilter(dateFrom, dateTo);
  if (platform) where.campaign = { platform };

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

async function queryGa4(def: MetricDef, groupBy: string | null, filters: Record<string, string>): Promise<MetricQueryResult> {
  const where: Record<string, unknown> = { ...filters };
  const rows = await prisma.landingPage.findMany({
    where,
    select: { sessions: true, views: true, conversions: true, bounceRate: true, path: true, name: true },
  });
  return aggregate(rows, def, groupBy);
}

async function queryEmail(def: MetricDef, groupBy: string | null, filters: Record<string, string>, dateFrom?: string | null, dateTo?: string | null): Promise<MetricQueryResult> {
  const where: Record<string, unknown> = { ...filters };
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
  const filters = validateFilters(def, params.filters);
  const dateFrom = def.dateField ? params.dateFrom : null;
  const dateTo = def.dateField ? params.dateTo : null;

  switch (def.source) {
    case 'leads':     return queryLeads(def, groupBy, filters, dateFrom, dateTo);
    case 'revenue':   return queryRevenue(def, groupBy, filters, dateFrom, dateTo);
    case 'campaigns': return queryCampaigns(def, groupBy, filters, dateFrom, dateTo);
    case 'ga4':       return queryGa4(def, groupBy, filters);
    case 'email':     return queryEmail(def, groupBy, filters, dateFrom, dateTo);
    default:          throw new Error(`Fonte de dados desconhecida: ${def.source}`);
  }
}
