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
      deletedAt: null,
      AND: [
        { NOT: { status: { in: ['CLIENT'] } } },
        { NOT: { tags: { has: 'nao-nutrir' } } },
      ],
    }],
  });
});

test('exclusão de segmentação preserva leads com campos opcionais vazios', async () => {
  const saved = new Map<string, SegmentRules>([
    ['empresas-bloqueadas', rules([
      { id: 'empresa-a', field: 'company', operator: 'contains', value: 'Empresa A' },
      { id: 'empresa-b', field: 'company', operator: 'equals', value: 'Empresa B' },
    ], 'OR')],
  ]);

  const where = await SegmentService.buildWhere(rules([
    { id: 'excluir-empresas', field: 'segment', operator: 'not_in_segment', value: 'empresas-bloqueadas' },
  ]), [], { loadRules: async id => saved.get(id) ?? null });

  assert.deepEqual(where, {
    deletedAt: null,
    AND: [{
      deletedAt: null,
      AND: [
        {
          OR: [
            { company: null },
            { NOT: { company: { contains: 'Empresa A', mode: 'insensitive' } } },
          ],
        },
        {
          OR: [
            { company: null },
            { NOT: { company: 'Empresa B' } },
          ],
        },
      ],
    }],
  });
});

test('excluir uma segmentação sem regras não retorna nenhum lead', async () => {
  const saved = new Map<string, SegmentRules>([
    ['todos-os-leads', rules([])],
  ]);

  const where = await SegmentService.buildWhere(rules([
    { id: 'excluir-todos', field: 'segment', operator: 'not_in_segment', value: 'todos-os-leads' },
  ]), [], { loadRules: async id => saved.get(id) ?? null });

  assert.deepEqual(where, {
    deletedAt: null,
    AND: [{
      deletedAt: null,
      id: { in: [] },
    }],
  });
});

test('negação de segmentação com lógica AND aplica De Morgan corretamente', async () => {
  const saved = new Map<string, SegmentRules>([
    ['clientes-google', rules([
      { id: 'cliente', field: 'status', operator: 'in', value: ['CLIENT'] },
      { id: 'google', field: 'firstSource', operator: 'equals', value: 'Google' },
    ])],
  ]);

  const where = await SegmentService.buildWhere(rules([
    { id: 'excluir-clientes-google', field: 'segment', operator: 'not_in_segment', value: 'clientes-google' },
  ]), [], { loadRules: async id => saved.get(id) ?? null });

  assert.deepEqual(where, {
    deletedAt: null,
    AND: [{
      deletedAt: null,
      OR: [
        { NOT: { status: { in: ['CLIENT'] } } },
        {
          OR: [
            { firstSource: null },
            { NOT: { firstSource: 'Google' } },
          ],
        },
      ],
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
