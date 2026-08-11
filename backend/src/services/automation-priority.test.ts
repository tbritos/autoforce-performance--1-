import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decideNurtureEnrollment,
  deriveEntryMode,
  normalizeAutomationPriority,
  normalizeAutomationType,
  normalizeQueueTtlHours,
  priorityLabel,
  suggestedPriorityForEntry,
} from './automation-priority.utils';

test('nutricao inicia quando o lead esta livre', () => {
  assert.equal(decideNurtureEnrollment(null, { priority: 80, canInterruptLowerPriority: true }), 'start');
});

test('conversao prioritaria interrompe nutricao menos importante', () => {
  assert.equal(decideNurtureEnrollment({ priority: 30 }, { priority: 80, canInterruptLowerPriority: true }), 'preempt');
});

test('prioridade igual ou menor aguarda na fila', () => {
  assert.equal(decideNurtureEnrollment({ priority: 80 }, { priority: 80, canInterruptLowerPriority: true }), 'queue');
  assert.equal(decideNurtureEnrollment({ priority: 80 }, { priority: 30, canInterruptLowerPriority: true }), 'queue');
  assert.equal(decideNurtureEnrollment({ priority: 30 }, { priority: 80, canInterruptLowerPriority: false }), 'queue');
});

test('entrada por segmento e reconhecida como publico da base', () => {
  assert.equal(deriveEntryMode([{ type: 'trigger', config: { event: 'segment_entered' } }]), 'AUDIENCE');
  assert.equal(deriveEntryMode([{ type: 'trigger', config: { event: 'conversion_received' } }]), 'TRIGGER');
});

test('conversao especifica recebe sugestao de prioridade alta', () => {
  assert.equal(suggestedPriorityForEntry([{ type: 'trigger', config: { event: 'conversion_received' } }]), 75);
  assert.equal(suggestedPriorityForEntry([{ type: 'trigger', config: { event: 'segment_entered' } }]), 50);
});

test('classificacao, prioridade e validade sao normalizadas', () => {
  assert.equal(normalizeAutomationType('NURTURE'), 'NURTURE');
  assert.equal(normalizeAutomationType('qualquer'), 'UNCLASSIFIED');
  assert.equal(normalizeAutomationPriority(150), 100);
  assert.equal(normalizeAutomationPriority(0), 1);
  assert.equal(normalizeQueueTtlHours(99999), 2160);
  assert.equal(normalizeQueueTtlHours(null), null);
  assert.equal(normalizeQueueTtlHours(0), null);
  assert.equal(priorityLabel(95), 'critical');
  assert.equal(priorityLabel(75), 'high');
  assert.equal(priorityLabel(50), 'normal');
  assert.equal(priorityLabel(20), 'low');
});
