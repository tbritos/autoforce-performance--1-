import { prisma } from '../../config/database';
import { listMetrics, MetricSource } from './metrics-catalog';

export interface FieldValueOption {
  value: string;
  label: string;
}

// Rótulos reais dos 10 status do enum LeadStatus (schema.prisma) — mesmos
// usados em ForecastView/FunnelView. Lista fixa, sem consulta ao banco: é um
// enum fechado, não um conjunto de valores que aparecem/desaparecem com o uso.
const LEAD_STATUS_OPTIONS: FieldValueOption[] = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'MQL', label: 'MQL' },
  { value: 'SQL', label: 'SQL' },
  { value: 'SCHEDULED', label: 'Agendado' },
  { value: 'DEMO', label: 'Demo' },
  { value: 'PROPOSAL', label: 'Proposta' },
  { value: 'OPPORTUNITY', label: 'Oportunidade' },
  { value: 'CLIENT', label: 'Cliente' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'DISQUALIFIED', label: 'Desqualificado' },
];

function isFieldFilterableForSource(source: MetricSource, field: string): boolean {
  return listMetrics().some(m => m.source === source && m.filterableDimensions.includes(field));
}

// distinct + findMany genérico — usado por todo campo que não tem lista fixa
// nem precisa de rótulo diferente do valor.
async function distinctStringValues(
  model: { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> },
  field: string,
  extraWhere: Record<string, unknown> = {}
): Promise<FieldValueOption[]> {
  const rows = await model.findMany({
    where: { [field]: { not: null }, ...extraWhere },
    select: { [field]: true },
    distinct: [field],
    orderBy: { [field]: 'asc' },
    take: 300,
  });
  return rows
    .map(r => r[field])
    .filter((v): v is string | number => v != null && v !== '')
    .map(v => ({ value: String(v), label: String(v) }));
}

export async function getFieldValueOptions(source: string, field: string): Promise<FieldValueOption[] | null> {
  if (!isFieldFilterableForSource(source as MetricSource, field)) return null;

  if (source === 'leads') {
    if (field === 'status' || field === 'toStatus') return LEAD_STATUS_OPTIONS;
    if (field === 'firstSource' || field === 'firstMedium' || field === 'assignedTo') {
      return distinctStringValues(prisma.lead as never, field, { deletedAt: null });
    }
    if (field === 'pipedrivePipelineId' || field === 'pipedriveStageId') {
      return distinctStringValues(prisma.lead as never, field, { deletedAt: null });
    }
    if (field === 'tag') {
      const leads = await prisma.lead.findMany({
        where: { deletedAt: null, tags: { isEmpty: false } },
        select: { tags: true },
        take: 1000,
      });
      return Array.from(new Set(leads.flatMap(lead => lead.tags).map(tag => tag.trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .slice(0, 300)
        .map(tag => ({ value: tag, label: tag }));
    }
    if (field === 'conversionSource') {
      const conversions = await prisma.leadConversion.findMany({
        where: { source: { not: '' }, lead: { deletedAt: null } },
        select: { source: true },
        distinct: ['source'],
        orderBy: { source: 'asc' },
        take: 300,
      });
      return conversions.map(conversion => ({ value: conversion.source, label: conversion.source }));
    }
    return [];
  }

  if (source === 'revenue') {
    return distinctStringValues(prisma.revenueEntry as never, field);
  }

  if (source === 'campaigns') {
    if (field === 'platform') {
      return distinctStringValues(prisma.campaign as never, field, { deletedAt: null });
    }
    if (field === 'campaignId') {
      const rows = await prisma.campaign.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 300,
      });
      return rows.map(r => ({ value: r.id, label: r.name }));
    }
    return [];
  }

  if (source === 'ga4') {
    return distinctStringValues(prisma.landingPage as never, field);
  }

  if (source === 'email') {
    return distinctStringValues(prisma.emailCampaign as never, field);
  }

  return [];
}
