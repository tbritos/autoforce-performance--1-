import { prisma } from '../config/database';

type WebhookIngestResult = {
  received: number;
  processed: number;
  skipped: number;
};

const parseDate = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const pickString = (row: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const extractConversionInfo = (row: Record<string, any>) => {
  const lastConversion = row?.last_conversion || row?.lastConversion || row?.last_conversion_event;
  const content = lastConversion?.content || lastConversion?.conversion || lastConversion;
  const identifier = pickString(content || {}, [
    'conversion_identifier',
    'identifier',
    'conversion_id',
    'id',
    'slug',
    'conversion_name',
    'name',
  ]);
  const name = pickString(content || {}, ['conversion_name', 'name', 'title', 'identifier', 'slug']);
  return {
    identifier,
    name,
  };
};

const buildLeadFromRow = (
  row: Record<string, any>,
  fallbackSource = 'webhook'
) => {
  const leadData =
    (row?.lead && typeof row.lead === 'object' ? row.lead : undefined) ||
    (row?.contact && typeof row.contact === 'object' ? row.contact : undefined) ||
    (row?.contact_data && typeof row.contact_data === 'object' ? row.contact_data : undefined) ||
    row;

  const email =
    pickString(leadData, ['email']) ||
    pickString(row, ['email']);

  const phone =
    pickString(leadData, ['phone', 'mobile_phone', 'personal_phone', 'whatsapp']) ||
    pickString(row, ['phone', 'mobile_phone', 'personal_phone', 'whatsapp']);

  const company =
    pickString(leadData, ['company', 'company_name', 'organization']) ||
    pickString(row, ['company', 'company_name', 'organization']);

  const externalId =
    pickString(leadData, ['external_id', 'uuid', 'contact_uuid', 'id', 'lead_id']) ||
    pickString(row, ['external_id', 'uuid', 'contact_uuid', 'id', 'lead_id']) ||
    (email ? `email:${email.toLowerCase()}` : undefined);

  if (!externalId) {
    return null;
  }

  const conversion = extractConversionInfo({
    ...row,
    last_conversion: row?.last_conversion || leadData?.last_conversion,
  });

  const firstName = pickString(leadData, ['first_name']);
  const lastName = pickString(leadData, ['last_name']);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const name =
    pickString(leadData, ['name']) ||
    pickString(row, ['name']) ||
    (fullName.length > 0 ? fullName : undefined);

  const lastConversionDate = parseDate(
    pickString(row, [
      'last_conversion_date',
      'last_conversion_datetime',
      'conversion_date',
      'created_at',
      'updated_at',
      'event_timestamp',
      'timestamp',
    ]) ||
      pickString(leadData, [
        'last_conversion_date',
        'last_conversion_datetime',
        'created_at',
        'updated_at',
      ])
  );

  const source =
    pickString(row, ['source']) ||
    pickString(leadData, ['source']) ||
    fallbackSource;

  return {
    externalId,
    name,
    email,
    phone,
    company,
    conversionIdentifier: conversion.identifier,
    conversionName: conversion.name,
    lastConversionDate,
    source,
  };
};

const extractWebhookLeadRows = (payload: any): Record<string, any>[] => {
  if (!payload) return [];

  const rows: Record<string, any>[] = [];
  const append = (value: any) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      rows.push(value);
    }
  };

  if (Array.isArray(payload)) {
    payload.forEach(append);
    return rows;
  }

  if (typeof payload !== 'object') {
    return rows;
  }

  const arrayFields = ['leads', 'contacts', 'records', 'items', 'events'];
  for (const key of arrayFields) {
    const arr = payload[key];
    if (Array.isArray(arr)) {
      arr.forEach(append);
    }
  }

  append(payload.lead);
  append(payload.contact);
  append(payload);

  return rows;
};

export class WebhookLeadsService {
  static async listLeads(filters?: { startDate?: string; endDate?: string }) {
    const where: any = {};
    if (filters?.startDate || filters?.endDate) {
      where.lastConversionDate = {};
      if (filters.startDate) {
        where.lastConversionDate.gte = new Date(`${filters.startDate}T00:00:00`);
      }
      if (filters.endDate) {
        where.lastConversionDate.lte = new Date(`${filters.endDate}T23:59:59`);
      }
    }

    return prisma.webhookLead.findMany({
      where,
      orderBy: { lastConversionDate: 'desc' },
    });
  }

  static async ingestWebhook(payload: any): Promise<WebhookIngestResult> {
    const rows = extractWebhookLeadRows(payload);
    let processed = 0;
    let skipped = 0;

    for (const row of rows) {
      const parsed = buildLeadFromRow(
        row,
        pickString(payload || {}, ['source']) || 'webhook'
      );

      if (!parsed) {
        skipped += 1;
        continue;
      }

      await prisma.webhookLead.upsert({
        where: { externalId: parsed.externalId },
        update: {
          name: parsed.name,
          email: parsed.email,
          phone: parsed.phone,
          company: parsed.company,
          conversionIdentifier: parsed.conversionIdentifier,
          conversionName: parsed.conversionName,
          lastConversionDate: parsed.lastConversionDate,
          source: parsed.source,
        },
        create: {
          externalId: parsed.externalId,
          name: parsed.name,
          email: parsed.email,
          phone: parsed.phone,
          company: parsed.company,
          conversionIdentifier: parsed.conversionIdentifier,
          conversionName: parsed.conversionName,
          lastConversionDate: parsed.lastConversionDate,
          source: parsed.source,
        },
      });

      processed += 1;
    }

    return {
      received: rows.length,
      processed,
      skipped,
    };
  }
}
