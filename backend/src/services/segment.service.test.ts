import assert from 'node:assert/strict';
import test from 'node:test';
import { SegmentRules, SegmentService, SegmentValidationError } from './segment.service';

function rules(conditions: SegmentRules['conditions'], logic: SegmentRules['logic'] = 'AND'): SegmentRules {
  return { logic, conditions };
}

test('segmentação pode excluir dinamicamente todos os membros de outra segmentação', async () => {
  const saved = new Map<string, SegmentRules>([
    ['clientes-bloqueados', rules([
      { id: 'status-cliente', field: 'status', operator: 'in', value: ['CLIENT'] },
      { id: 'tag-bloqueio', field: 'tags', operator: 'contains_tag', value: 'nao-nutrir' },
    ], 'OR')],
  ]);

  const where = await SegmentService.buildWhere(rules([
    { id: 'excluir-clientes', field: 'segment', operator: 'not_in_segment', value: 'clientes-bloqueados' },
  ]), [], { loadRules: async id => saved.get(id) ?? null });

  assert.deepEqual(where, {
    deletedAt: null,
    AND: [{
      NOT: {
        deletedAt: null,
        OR: [
          { status: { in: ['CLIENT'] } },
          { tags: { has: 'nao-nutrir' } },
        ],
      },
    }],
  });
});

test('segmentações compostas podem incluir outra segmentação e preservar suas regras', async () => {
  const saved = new Map<string, SegmentRules>([
    ['leads-google', rules([
      { id: 'fonte-google', field: 'firstSource', operator: 'equals', value: 'Google' },
    ])],
  ]);

  const where = await SegmentService.buildWhere(rules([
    { id: 'incluir-google', field: 'segment', operator: 'in_segment', value: 'leads-google' },
    { id: 'score-minimo', field: 'score', operator: 'gte', value: 50 },
  ]), [], { loadRules: async id => saved.get(id) ?? null });

  assert.deepEqual(where, {
    deletedAt: null,
    AND: [
      { deletedAt: null, AND: [{ firstSource: 'Google' }] },
      { score: { gte: 50 } },
    ],
  });
});

test('referências circulares entre segmentações são rejeitadas', async () => {
  const saved = new Map<string, SegmentRules>([
    ['segmento-a', rules([
      { id: 'a-para-b', field: 'segment', operator: 'in_segment', value: 'segmento-b' },
    ])],
    ['segmento-b', rules([
      { id: 'b-para-a', field: 'segment', operator: 'in_segment', value: 'segmento-a' },
    ])],
  ]);

  await assert.rejects(
    () => SegmentService.buildWhere(saved.get('segmento-a')!, ['segmento-a'], {
      loadRules: async id => saved.get(id) ?? null,
    }),
    (error: unknown) => error instanceof SegmentValidationError && /circular/.test(error.message),
  );
});

test('segmentação removida ou inexistente não é aceita como regra', async () => {
  await assert.rejects(
    () => SegmentService.buildWhere(rules([
      { id: 'inexistente', field: 'segment', operator: 'not_in_segment', value: 'nao-existe' },
    ]), [], { loadRules: async () => null }),
    (error: unknown) => error instanceof SegmentValidationError && /não existe/.test(error.message),
  );
});
