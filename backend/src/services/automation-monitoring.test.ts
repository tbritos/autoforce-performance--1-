import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStageMetrics,
  matchesExitConditions,
  orderMonitoringNodes,
  percentage,
} from './automation-monitoring.utils';

const nodes = [
  { id: 'email-1', type: 'send_email', config: { templateName: 'Email 1' } },
  { id: 'trigger', type: 'trigger', config: { event: 'segment_entered' } },
  { id: 'wait-1', type: 'wait', config: { amount: '3', unit: 'days' } },
  { id: 'whatsapp-1', type: 'whatsapp_message', config: { templateName: 'wpp_1' } },
];

const edges = [
  { source: 'trigger', target: 'email-1' },
  { source: 'email-1', target: 'wait-1' },
  { source: 'wait-1', target: 'whatsapp-1' },
];

test('ordena as fases a partir da entrada mesmo quando os nós foram salvos fora de ordem', () => {
  assert.deepEqual(orderMonitoringNodes(nodes, edges).map(node => node.id), [
    'trigger', 'email-1', 'wait-1', 'whatsapp-1',
  ]);
});

test('resume pessoas atuais, na fila e que já alcançaram cada fase', () => {
  const metrics = buildStageMetrics(nodes, edges, [
    { currentNodeId: 'trigger', status: 'queued', count: 7 },
    { currentNodeId: 'wait-1', status: 'waiting', count: 5 },
    { currentNodeId: 'wait-1', status: 'running', count: 2 },
    { currentNodeId: 'whatsapp-1', status: 'failed', count: 1 },
  ], [
    { nodeId: 'trigger', count: 15 },
    { nodeId: 'email-1', count: 8 },
    { nodeId: 'wait-1', count: 7 },
    { nodeId: 'whatsapp-1', count: 1 },
  ]);

  assert.equal(metrics[0].queued, 7);
  assert.equal(metrics[1].label, 'E-mail');
  assert.equal(metrics[1].detail, 'Email 1');
  assert.equal(metrics[2].current, 7);
  assert.equal(metrics[2].waiting, 5);
  assert.equal(metrics[3].failed, 1);
  assert.equal(metrics[3].reached, 1);
});

test('aplica as mesmas regras de saída usadas durante a execução do fluxo', () => {
  const lead = {
    status: 'MQL', score: 72, tags: ['ebook'], isHot: true,
    firstSource: 'Google', company: null, jobTitle: null, phone: null, assignedTo: null,
  };
  assert.equal(matchesExitConditions(lead, {
    logic: 'OR',
    conditions: [
      { field: 'status', operator: '=', value: 'MQL' },
      { field: 'score', operator: '>=', value: '90' },
    ],
  }), true);
  assert.equal(matchesExitConditions(lead, {
    logic: 'AND',
    conditions: [
      { field: 'status', operator: '=', value: 'MQL' },
      { field: 'score', operator: '>=', value: '90' },
    ],
  }), false);
});

test('calcula taxas sem divisão por zero e com uma casa decimal', () => {
  assert.equal(percentage(37, 80), 46.3);
  assert.equal(percentage(10, 0), 0);
});
