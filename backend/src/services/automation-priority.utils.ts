export type AutomationType = 'UNCLASSIFIED' | 'NURTURE' | 'STANDALONE';
export type AutomationEntryMode = 'TRIGGER' | 'AUDIENCE';
export type EnrollmentDecision = 'start' | 'queue' | 'preempt';

export function normalizeAutomationType(value: unknown): AutomationType {
  return value === 'NURTURE' || value === 'STANDALONE' ? value : 'UNCLASSIFIED';
}

export function normalizeAutomationPriority(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(100, Math.max(1, Math.round(parsed)));
}

export function normalizeQueueTtlHours(value: unknown): number | null {
  if (value === null || value === 0 || value === '0' || value === 'unlimited') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 168;
  return Math.min(24 * 90, Math.max(1, Math.round(parsed)));
}

export function deriveEntryMode(nodes: unknown): AutomationEntryMode {
  if (!Array.isArray(nodes)) return 'TRIGGER';
  const trigger = nodes.find(node => node && typeof node === 'object' && (node as { type?: string }).type === 'trigger') as { config?: { event?: string } } | undefined;
  return trigger?.config?.event === 'segment_entered' ? 'AUDIENCE' : 'TRIGGER';
}

export function suggestedPriorityForEntry(nodes: unknown): number {
  if (!Array.isArray(nodes)) return 50;
  const trigger = nodes.find(node => node && typeof node === 'object' && (node as { type?: string }).type === 'trigger') as { config?: { event?: string } } | undefined;
  return trigger?.config?.event === 'conversion_received' ? 75 : 50;
}

export function decideNurtureEnrollment(
  active: { priority: number } | null,
  incoming: { priority: number; canInterruptLowerPriority: boolean }
): EnrollmentDecision {
  if (!active) return 'start';
  if (incoming.canInterruptLowerPriority && incoming.priority > active.priority) return 'preempt';
  return 'queue';
}

export function priorityLabel(priority: number): 'critical' | 'high' | 'normal' | 'low' {
  if (priority >= 90) return 'critical';
  if (priority >= 70) return 'high';
  if (priority >= 40) return 'normal';
  return 'low';
}
