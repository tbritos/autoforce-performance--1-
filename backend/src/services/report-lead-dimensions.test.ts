import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyLeadDimensionSlice,
  applyLeadReportConditions,
  NO_CONVERSION_LABEL,
  NO_TAG_LABEL,
} from './reports/lead-report-dimensions';

const condition = (field: string, operator: 'equals' | 'not_equals' | 'contains' | 'is_set' | 'is_not_set', value = '') => ({
  id: `${field}-${operator}`,
  source: 'leads' as const,
  field,
  operator,
  value,
});

test('traduz filtros de etiqueta e conversão para relações Prisma sem sobrescrever condições', () => {
  const where: Record<string, unknown> = { deletedAt: null };
  applyLeadReportConditions(where, [
    condition('tag', 'equals', 'Google Ads'),
    condition('conversionSource', 'equals', 'Ebook Máquina de Vendas'),
    condition('status', 'equals', 'MQL'),
  ]);

  assert.deepEqual(where, {
    deletedAt: null,
    AND: [
      { tags: { has: 'Google Ads' } },
      { conversions: { some: { source: 'Ebook Máquina de Vendas' } } },
      { status: 'MQL' },
    ],
  });
});

test('permite filtrar leads sem etiqueta e sem conversão', () => {
  const where: Record<string, unknown> = {};
  applyLeadReportConditions(where, [
    condition('tag', 'is_not_set'),
    condition('conversionSource', 'is_not_set'),
  ]);

  assert.deepEqual(where, {
    AND: [
      { tags: { isEmpty: true } },
      { conversions: { none: {} } },
    ],
  });
});

test('converte a barra clicada em filtro de etiqueta ou conversão', () => {
  const tagged: Record<string, unknown> = {};
  applyLeadDimensionSlice(tagged, 'tag', 'Importação');
  assert.deepEqual(tagged, { AND: [{ tags: { has: 'Importação' } }] });

  const untagged: Record<string, unknown> = {};
  applyLeadDimensionSlice(untagged, 'tag', NO_TAG_LABEL);
  assert.deepEqual(untagged, { AND: [{ tags: { isEmpty: true } }] });

  const converted: Record<string, unknown> = {};
  applyLeadDimensionSlice(converted, 'conversionSource', 'WhatsApp');
  assert.deepEqual(converted, { AND: [{ conversions: { some: { source: 'WhatsApp' } } }] });

  const unconverted: Record<string, unknown> = {};
  applyLeadDimensionSlice(unconverted, 'conversionSource', NO_CONVERSION_LABEL);
  assert.deepEqual(unconverted, { AND: [{ conversions: { none: {} } }] });
});
