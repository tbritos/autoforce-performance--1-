import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canApplyPipedriveDealToLead,
  pipedriveForecastLeadWhere,
} from './pipedrive-link.utils';

test('negocio ja vinculado nao e substituido por outro negocio da mesma pessoa', () => {
  assert.equal(canApplyPipedriveDealToLead(null, '4916'), true);
  assert.equal(canApplyPipedriveDealToLead('4916', '4916'), true);
  assert.equal(canApplyPipedriveDealToLead('4916', '5574'), false);
});

test('Forecast aceita somente pipelines comerciais, leads em negociacao e MRR positivo', () => {
  const where = pipedriveForecastLeadWhere() as any;
  assert.deepEqual(where.pipedrivePipelineId, { in: [2, 5] });
  assert.equal(where.pipedriveDealStatus, 'open');
  assert.deepEqual(where.pipedriveDealValue, { gt: 0 });
  assert.equal(where.status.in.includes('CLIENT'), false);
  assert.equal(where.status.in.includes('LOST'), false);
  assert.equal(where.status.in.includes('SQL'), true);
});
