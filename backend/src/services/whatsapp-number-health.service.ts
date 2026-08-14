import { prisma } from '../config/database';
import { classifyWhatsAppError } from './whatsapp.service';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface WhatsAppHealthMessageRow {
  id: string;
  leadId: string | null;
  leadEmail: string | null;
  phone: string;
  status: string;
  templateName: string | null;
  errorCode: number | null;
  errorTitle: string | null;
  errorMessage: string | null;
  phoneNumberId: string | null;
  automationJourneyId: string | null;
  whatsAppBlastId: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
}

type HealthMetrics = {
  totalTemplates: number;
  accepted: number;
  delivered: number;
  read: number;
  failed: number;
  waitingDelivery: number;
  uniqueRecipients: number;
  affectedRecipients: number;
  acceptanceRate: number;
  deliveryRate: number;
  readRate: number;
  errorRate: number;
};

const percent = (part: number, total: number): number => total > 0
  ? Math.round((part / total) * 10_000) / 100
  : 0;

const isFailed = (row: WhatsAppHealthMessageRow): boolean => row.status === 'failed' || row.failedAt !== null;
const isRead = (row: WhatsAppHealthMessageRow): boolean => row.status === 'read' || row.readAt !== null;
const isDelivered = (row: WhatsAppHealthMessageRow): boolean => (
  row.status === 'delivered' || isRead(row) || row.deliveredAt !== null
);

function metricsFor(rows: WhatsAppHealthMessageRow[]): HealthMetrics {
  const failedRows = rows.filter(isFailed);
  const accepted = rows.length - failedRows.length;
  const delivered = rows.filter(isDelivered).length;
  const read = rows.filter(isRead).length;
  return {
    totalTemplates: rows.length,
    accepted,
    delivered,
    read,
    failed: failedRows.length,
    waitingDelivery: Math.max(0, accepted - delivered),
    uniqueRecipients: new Set(rows.map(row => row.phone).filter(Boolean)).size,
    affectedRecipients: new Set(failedRows.map(row => row.phone).filter(Boolean)).size,
    acceptanceRate: percent(accepted, rows.length),
    deliveryRate: percent(delivered, accepted),
    readRate: percent(read, delivered),
    errorRate: percent(failedRows.length, rows.length),
  };
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function calendarPeriod(now: Date, days: number) {
  const from = new Date(now);
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  const previousFrom = new Date(from);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - days);
  return { from, previousFrom };
}

function resolvedPhoneNumberId(row: WhatsAppHealthMessageRow, defaultPhoneNumberId: string | null): string | null {
  return row.phoneNumberId ?? defaultPhoneNumberId;
}

export function summarizeWhatsAppHealthRows(
  rows: WhatsAppHealthMessageRow[],
  options: {
    now: Date;
    days: number;
    defaultPhoneNumberId: string | null;
    selectedPhoneNumberId?: string | null;
  },
) {
  const to = options.now;
  const { from, previousFrom } = calendarPeriod(to, options.days);
  const selected = options.selectedPhoneNumberId?.trim() || null;
  const scoped = selected
    ? rows.filter(row => resolvedPhoneNumberId(row, options.defaultPhoneNumberId) === selected)
    : rows;
  const currentRows = scoped.filter(row => row.createdAt >= from && row.createdAt <= to);
  const previousRows = scoped.filter(row => row.createdAt >= previousFrom && row.createdAt < from);
  const metrics = metricsFor(currentRows);
  const previousMetrics = metricsFor(previousRows);

  const dailyMap = new Map<string, { date: string; total: number; delivered: number; read: number; failed: number }>();
  for (let offset = 0; offset < options.days; offset += 1) {
    const day = new Date(from.getTime() + offset * DAY_MS);
    const key = dateKey(day);
    dailyMap.set(key, { date: key, total: 0, delivered: 0, read: 0, failed: 0 });
  }
  for (const row of currentRows) {
    const day = dailyMap.get(dateKey(row.createdAt));
    if (!day) continue;
    day.total += 1;
    if (isDelivered(row)) day.delivered += 1;
    if (isRead(row)) day.read += 1;
    if (isFailed(row)) day.failed += 1;
  }

  const errorMap = new Map<string, {
    code: number | null;
    title: string;
    message: string;
    count: number;
    lastOccurredAt: Date;
    classification: 'permanent' | 'transient';
  }>();
  for (const row of currentRows.filter(isFailed)) {
    const title = row.errorTitle?.trim() || 'Falha no envio';
    const message = row.errorMessage?.trim() || 'A Meta não informou detalhes adicionais.';
    const key = row.errorCode !== null ? `code:${row.errorCode}` : `message:${message.toLowerCase()}`;
    const occurredAt = row.failedAt ?? row.createdAt;
    const classification = classifyWhatsAppError({ code: row.errorCode, message })?.classification ?? 'transient';
    const existing = errorMap.get(key);
    if (existing) {
      existing.count += 1;
      if (occurredAt > existing.lastOccurredAt) {
        existing.lastOccurredAt = occurredAt;
        existing.title = title;
        existing.message = message;
      }
    } else {
      errorMap.set(key, { code: row.errorCode, title, message, count: 1, lastOccurredAt: occurredAt, classification });
    }
  }
  const errors = [...errorMap.values()]
    .sort((a, b) => b.count - a.count || b.lastOccurredAt.getTime() - a.lastOccurredAt.getTime())
    .map(error => ({ ...error, percentage: percent(error.count, metrics.failed) }));

  const numberMap = new Map<string, WhatsAppHealthMessageRow[]>();
  for (const row of currentRows) {
    const id = resolvedPhoneNumberId(row, options.defaultPhoneNumberId) ?? 'unknown';
    const numberRows = numberMap.get(id) ?? [];
    numberRows.push(row);
    numberMap.set(id, numberRows);
  }

  const errorRateDelta = Math.round((metrics.errorRate - previousMetrics.errorRate) * 100) / 100;
  const healthLevel = metrics.totalTemplates === 0
    ? 'no_data'
    : metrics.errorRate > 5
      ? 'critical'
      : metrics.errorRate > 2
        ? 'attention'
        : 'healthy';

  return {
    period: { days: options.days, from, to },
    selectedPhoneNumberId: selected,
    health: {
      level: healthLevel as 'no_data' | 'healthy' | 'attention' | 'critical',
      label: healthLevel === 'healthy' ? 'Saudável' : healthLevel === 'attention' ? 'Atenção' : healthLevel === 'critical' ? 'Crítica' : 'Sem dados',
    },
    metrics,
    comparison: {
      previousTotalTemplates: previousMetrics.totalTemplates,
      previousErrorRate: previousMetrics.errorRate,
      errorRateDelta,
    },
    daily: [...dailyMap.values()],
    errors,
    byNumber: [...numberMap.entries()].map(([phoneNumberId, numberRows]) => ({
      phoneNumberId,
      ...metricsFor(numberRows),
    })).sort((a, b) => b.totalTemplates - a.totalTemplates),
    currentRows,
  };
}

export async function getWhatsAppNumberHealth(input: { phoneNumberId?: string; days?: number }) {
  const days = [7, 30, 90].includes(Number(input.days)) ? Number(input.days) : 30;
  const now = new Date();
  const { previousFrom } = calendarPeriod(now, days);
  const defaultPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null;
  const rows = await prisma.whatsAppMessage.findMany({
    where: {
      direction: 'outbound',
      type: 'template',
      createdAt: { gte: previousFrom, lte: now },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      leadId: true,
      leadEmail: true,
      phone: true,
      status: true,
      templateName: true,
      errorCode: true,
      errorTitle: true,
      errorMessage: true,
      phoneNumberId: true,
      automationJourneyId: true,
      whatsAppBlastId: true,
      sentAt: true,
      deliveredAt: true,
      readAt: true,
      failedAt: true,
      createdAt: true,
    },
  });

  const summary = summarizeWhatsAppHealthRows(rows, {
    now,
    days,
    defaultPhoneNumberId,
    selectedPhoneNumberId: input.phoneNumberId,
  });
  const currentRows = summary.currentRows;
  const failures = currentRows.filter(isFailed).slice(0, 30);
  const leadIds = [...new Set(failures.map(row => row.leadId).filter((id): id is string => Boolean(id)))];
  const leads = leadIds.length ? await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, name: true, company: true, email: true },
  }) : [];
  const leadById = new Map(leads.map(lead => [lead.id, lead]));
  const registeredNumbers = await prisma.whatsAppNumber.findMany({
    select: { phoneNumberId: true, label: true, displayPhoneNumber: true },
  });
  const numberById = new Map(registeredNumbers.map(number => [number.phoneNumberId, number]));

  return {
    period: summary.period,
    selectedPhoneNumberId: summary.selectedPhoneNumberId,
    health: summary.health,
    metrics: summary.metrics,
    comparison: summary.comparison,
    daily: summary.daily,
    errors: summary.errors,
    byNumber: summary.byNumber.map(number => {
      const registered = numberById.get(number.phoneNumberId);
      return {
        ...number,
        label: registered?.label ?? null,
        displayPhoneNumber: registered?.displayPhoneNumber ?? null,
      };
    }),
    recentFailures: failures.map(row => {
      const lead = row.leadId ? leadById.get(row.leadId) : undefined;
      const phoneNumberId = resolvedPhoneNumberId(row, defaultPhoneNumberId);
      return {
        id: row.id,
        occurredAt: row.failedAt ?? row.createdAt,
        phone: row.phone,
        phoneNumberId,
        senderLabel: phoneNumberId ? numberById.get(phoneNumberId)?.label ?? null : null,
        leadId: row.leadId,
        leadName: lead?.name ?? null,
        company: lead?.company ?? null,
        leadEmail: lead?.email ?? row.leadEmail,
        templateName: row.templateName,
        errorCode: row.errorCode,
        errorTitle: row.errorTitle,
        errorMessage: row.errorMessage,
        classification: classifyWhatsAppError({ code: row.errorCode, message: row.errorMessage })?.classification ?? 'transient',
        origin: row.whatsAppBlastId ? 'Disparo' : row.automationJourneyId ? 'Automação' : 'Manual/Agente',
      };
    }),
  };
}
