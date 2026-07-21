import { prisma } from '../../config/database';
import { getMetricDef, isDateBucket, MetricDef, DateBucket } from './metrics-catalog';
import { validateGroupBy, dateRangeFilter, resolveDatePreset, applyConditions } from './report-query.service';
import { ReportFilterCondition, NUMERIC_FILTER_FIELDS, conditionToWhereValue, sanitizeConditionsForMetric } from './report-filter-ops';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

export interface RunDrillDownParams {
  metricKey: string;
  groupBy?: string | null;
  // Rótulo do "pedaço" clicado no gráfico (ex: "SQL", "2026-W29", "Não informado").
  // null/undefined = clique no total (card de KPI) — sem filtro extra.
  dimension?: string | null;
  filters?: ReportFilterCondition[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  datePreset?: string | null;
  page?: number;
  pageSize?: number;
}

export type DrillDownEntity = 'lead' | 'revenue_entry' | 'campaign_metric' | 'email_campaign' | null;

export interface DrillDownResult {
  supported: boolean;
  reason?: string;
  entity: DrillDownEntity;
  total: number;
  page: number;
  pageSize: number;
  rows: Array<Record<string, unknown>>;
}

function paginate(page?: number, pageSize?: number) {
  const safePage = Math.max(1, page ?? 1);
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSize ?? DEFAULT_PAGE_SIZE));
  return { skip: (safePage - 1) * safePageSize, take: safePageSize, page: safePage, pageSize: safePageSize };
}

function resolveDates(def: MetricDef, params: RunDrillDownParams): { dateFrom?: string | null; dateTo?: string | null } {
  let dateFrom = params.dateFrom;
  let dateTo = params.dateTo;
  if (params.datePreset && params.datePreset !== 'custom') {
    const resolved = resolveDatePreset(params.datePreset);
    dateFrom = resolved.dateFrom;
    dateTo = resolved.dateTo;
  }
  return { dateFrom: def.dateField ? dateFrom : null, dateTo: def.dateField ? dateTo : null };
}

// Inverte um rótulo de dia/semana/mês de volta pro intervalo de datas que ele
// representa. Espelha bucketDateLabel/isoWeekLabel de report-query.service.ts
// (mesma base em UTC, senão o clique num "pedaço" do gráfico não bate com os
// registros que realmente formaram aquele número).
function dateBucketToRange(bucket: DateBucket, label: string): { gte: Date; lte: Date } {
  if (bucket === 'date_day') {
    return { gte: new Date(`${label}T00:00:00.000Z`), lte: new Date(`${label}T23:59:59.999Z`) };
  }
  if (bucket === 'date_month') {
    const [y, m] = label.split('-').map(Number);
    return {
      gte: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)),
      lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
    };
  }
  // date_week: "YYYY-Wnn" — acha a quinta-feira da semana ISO (mesmo algoritmo
  // de isoWeekLabel, ao contrário) e devolve segunda 00:00 a domingo 23:59.
  const [yearStr, weekStr] = label.split('-W');
  const isoYear = Number(yearStr);
  const weekNum = Number(weekStr);
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const thursday = new Date(firstThursday);
  thursday.setUTCDate(firstThursday.getUTCDate() + (weekNum - 1) * 7);
  const monday = new Date(thursday);
  monday.setUTCDate(thursday.getUTCDate() - 3);
  const sunday = new Date(thursday);
  sunday.setUTCDate(thursday.getUTCDate() + 3);
  return {
    gte: new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 0, 0, 0, 0)),
    lte: new Date(Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate(), 23, 59, 59, 999)),
  };
}

// Aplica, num objeto `where` já com os filtros base, o filtro extra do
// "pedaço" clicado — igualdade simples, IS NULL pros sentinelas "Não
// informado"/"Sem data", ou o intervalo de datas do bucket clicado (que
// substitui o período do widget nesse campo, já que o bucket é um subconjunto
// dele). Uso genérico — não serve pra dimensões que vivem numa relação (ex:
// "platform" de campanhas, que mora em Campaign, não em CampaignMetrics).
function applyDimensionAndDate(
  where: Record<string, unknown>,
  def: MetricDef,
  groupBy: string | null,
  dimension: string | null | undefined,
  dateFrom: string | null | undefined,
  dateTo: string | null | undefined
): void {
  const bucketClicked = !!groupBy && isDateBucket(groupBy) && dimension != null;
  if (def.dateField) {
    if (bucketClicked) {
      where[def.dateField] = dimension === 'Sem data' ? null : dateBucketToRange(groupBy as DateBucket, dimension as string);
    } else if (dateFrom || dateTo) {
      where[def.dateField] = dateRangeFilter(dateFrom, dateTo);
    }
  }
  if (groupBy && dimension != null && !isDateBucket(groupBy)) {
    where[groupBy] = dimension === 'Não informado' ? null : (NUMERIC_FILTER_FIELDS.has(groupBy) ? Number(dimension) : dimension);
  }
}

const LEAD_SELECT = {
  id: true, email: true, name: true, company: true, status: true,
  firstSource: true, firstMedium: true, assignedTo: true, firstSeenAt: true,
  pipedriveStageName: true, pipedriveDealValue: true, pipedriveSetupValue: true,
};

async function drillDownLeads(
  def: MetricDef, groupBy: string | null, dimension: string | null | undefined,
  conditions: ReportFilterCondition[], dateFrom: string | null | undefined, dateTo: string | null | undefined,
  page?: number, pageSize?: number
): Promise<DrillDownResult> {
  const { skip, take, page: p, pageSize: ps } = paginate(page, pageSize);

  if (def.key === 'leads.status_transitions') {
    // groupBy (toStatus) e a data vivem em LeadStatusHistory, não em Lead —
    // busca lá e junta os dados do lead pra exibir.
    const historyWhere: Record<string, unknown> = {};
    applyConditions(historyWhere, conditions);
    applyDimensionAndDate(historyWhere, def, groupBy, dimension, dateFrom, dateTo);
    const [total, histories] = await Promise.all([
      prisma.leadStatusHistory.count({ where: historyWhere }),
      prisma.leadStatusHistory.findMany({ where: historyWhere, orderBy: { changedAt: 'desc' }, skip, take }),
    ]);
    const emails = histories.map(h => h.leadEmail);
    const leads = await prisma.lead.findMany({ where: { email: { in: emails } }, select: LEAD_SELECT });
    const byEmail = new Map(leads.map(l => [l.email, l]));
    const rows = histories.map(h => ({
      ...(byEmail.get(h.leadEmail) ?? { email: h.leadEmail }),
      toStatus: h.toStatus,
      changedAt: h.changedAt,
    }));
    return { supported: true, entity: 'lead', total, page: p, pageSize: ps, rows };
  }

  const where: Record<string, unknown> = def.key === 'leads.count'
    ? { deletedAt: null }
    : { deletedAt: null, pipedriveDealId: { not: null }, pipedriveDealStatus: 'open' }; // forecast_mrr / forecast_setup
  applyConditions(where, conditions);
  applyDimensionAndDate(where, def, groupBy, dimension, dateFrom, dateTo);

  const [total, rows] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({ where, skip, take, orderBy: { firstSeenAt: 'desc' }, select: LEAD_SELECT }),
  ]);
  return { supported: true, entity: 'lead', total, page: p, pageSize: ps, rows };
}

async function drillDownRevenue(
  def: MetricDef, groupBy: string | null, dimension: string | null | undefined,
  conditions: ReportFilterCondition[], dateFrom: string | null | undefined, dateTo: string | null | undefined,
  page?: number, pageSize?: number
): Promise<DrillDownResult> {
  const { skip, take, page: p, pageSize: ps } = paginate(page, pageSize);
  const where: Record<string, unknown> = {};
  applyConditions(where, conditions);
  applyDimensionAndDate(where, def, groupBy, dimension, dateFrom, dateTo);

  const [total, rows] = await Promise.all([
    prisma.revenueEntry.count({ where }),
    prisma.revenueEntry.findMany({
      where, skip, take, orderBy: { date: 'desc' },
      select: {
        id: true, businessName: true, leadEmail: true, mrrValue: true, setupValue: true,
        origin: true, originType: true, closedBy: true, date: true, dealUrl: true,
        lead: { select: { id: true } },
      },
    }),
  ]);
  const flat = rows.map(r => ({
    id: r.id, businessName: r.businessName, leadEmail: r.leadEmail, leadId: r.lead?.id ?? null,
    mrrValue: r.mrrValue, setupValue: r.setupValue, origin: r.origin, originType: r.originType,
    closedBy: r.closedBy, date: r.date, dealUrl: r.dealUrl,
  }));
  return { supported: true, entity: 'revenue_entry', total, page: p, pageSize: ps, rows: flat };
}

async function drillDownCampaigns(
  def: MetricDef, groupBy: string | null, dimension: string | null | undefined,
  conditions: ReportFilterCondition[], dateFrom: string | null | undefined, dateTo: string | null | undefined,
  page?: number, pageSize?: number
): Promise<DrillDownResult> {
  const { skip, take, page: p, pageSize: ps } = paginate(page, pageSize);
  const where: Record<string, unknown> = {};
  let campaignWhere: Record<string, unknown> | undefined;
  for (const c of conditions) {
    const rhs = conditionToWhereValue(c.field, c.operator, c.value);
    if (rhs === undefined) continue;
    if (c.field === 'platform') campaignWhere = { ...(campaignWhere ?? {}), platform: rhs };
    else where[c.field] = rhs;
  }

  // "platform" mora em Campaign (relação), não em CampaignMetrics — tratado à
  // parte; os demais casos (data, campaignId) usam o helper genérico.
  if (groupBy === 'platform' && dimension != null) {
    campaignWhere = { ...(campaignWhere ?? {}), platform: dimension === 'Não informado' ? null : dimension };
  } else {
    applyDimensionAndDate(where, def, groupBy, dimension, dateFrom, dateTo);
  }
  if (groupBy === 'platform' && def.dateField && (dateFrom || dateTo)) {
    where[def.dateField] = dateRangeFilter(dateFrom, dateTo);
  }
  if (campaignWhere) where.campaign = campaignWhere;

  const [total, rows] = await Promise.all([
    prisma.campaignMetrics.count({ where }),
    prisma.campaignMetrics.findMany({
      where, skip, take, orderBy: { date: 'desc' },
      select: {
        id: true, campaignId: true, date: true, spend: true, impressions: true, clicks: true,
        leads: true, conversions: true, campaign: { select: { name: true, platform: true } },
      },
    }),
  ]);
  const flat = rows.map(r => ({
    id: r.id, campaignId: r.campaignId, campaignName: r.campaign?.name ?? null, platform: r.campaign?.platform ?? null,
    date: r.date, spend: r.spend, impressions: r.impressions, clicks: r.clicks, leads: r.leads, conversions: r.conversions,
  }));
  return { supported: true, entity: 'campaign_metric', total, page: p, pageSize: ps, rows: flat };
}

async function drillDownEmail(
  def: MetricDef, groupBy: string | null, dimension: string | null | undefined,
  conditions: ReportFilterCondition[], dateFrom: string | null | undefined, dateTo: string | null | undefined,
  page?: number, pageSize?: number
): Promise<DrillDownResult> {
  const { skip, take, page: p, pageSize: ps } = paginate(page, pageSize);
  const where: Record<string, unknown> = {};
  applyConditions(where, conditions);
  applyDimensionAndDate(where, def, groupBy, dimension, dateFrom, dateTo);

  const [total, rows] = await Promise.all([
    prisma.emailCampaign.count({ where }),
    prisma.emailCampaign.findMany({
      where, skip, take, orderBy: { date: 'desc' },
      select: { id: true, name: true, source: true, date: true, sends: true, opens: true, clicks: true, bounce: true, unsubscribes: true },
    }),
  ]);
  return { supported: true, entity: 'email_campaign', total, page: p, pageSize: ps, rows };
}

function drillDownGa4(page?: number, pageSize?: number): DrillDownResult {
  const { page: p, pageSize: ps } = paginate(page, pageSize);
  return {
    supported: false,
    reason: 'GA4 é um snapshot agregado por página — não existem registros individuais para detalhar.',
    entity: null, total: 0, page: p, pageSize: ps, rows: [],
  };
}

export async function runDrillDownQuery(params: RunDrillDownParams): Promise<DrillDownResult> {
  const def = getMetricDef(params.metricKey);
  const groupBy = validateGroupBy(def, params.groupBy);
  const conditions = sanitizeConditionsForMetric(def, params.filters);
  const { dateFrom, dateTo } = resolveDates(def, params);

  switch (def.source) {
    case 'leads':     return drillDownLeads(def, groupBy, params.dimension, conditions, dateFrom, dateTo, params.page, params.pageSize);
    case 'revenue':   return drillDownRevenue(def, groupBy, params.dimension, conditions, dateFrom, dateTo, params.page, params.pageSize);
    case 'campaigns': return drillDownCampaigns(def, groupBy, params.dimension, conditions, dateFrom, dateTo, params.page, params.pageSize);
    case 'email':     return drillDownEmail(def, groupBy, params.dimension, conditions, dateFrom, dateTo, params.page, params.pageSize);
    case 'ga4':       return drillDownGa4(params.page, params.pageSize);
    default:          throw new Error(`Fonte de dados desconhecida: ${(def as MetricDef).source}`);
  }
}
