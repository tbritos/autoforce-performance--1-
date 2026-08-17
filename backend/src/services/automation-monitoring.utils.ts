export type MonitoringNode = {
  id: string;
  type: string;
  label?: string;
  config?: Record<string, unknown>;
};

export type MonitoringEdge = {
  source: string;
  target: string;
};

export type StageStatusRow = {
  currentNodeId: string | null;
  status: string;
  count: number;
};

export type StageReachedRow = {
  nodeId: string | null;
  count: number;
};

export type ExitLead = {
  status: string;
  score: number;
  tags: string[];
  isHot: boolean;
  firstSource: string | null;
  company: string | null;
  jobTitle: string | null;
  phone: string | null;
  assignedTo: string | null;
};

export type ExitConditions = {
  logic: 'AND' | 'OR';
  conditions: Array<{ field: string; operator: string; value: string }>;
};

const NODE_LABELS: Record<string, string> = {
  trigger: 'Entrada',
  wait: 'Espera',
  whatsapp_wait_reply: 'Aguardar resposta',
  email_wait_event: 'Aguardar evento de e-mail',
  condition: 'Condição',
  ai_prequalify: 'Inteligência artificial',
  internal_action: 'Ação interna',
  rd_conversion: 'RD Station',
  whatsapp_message: 'WhatsApp',
  pipedrive_action: 'Pipedrive',
  send_email: 'E-mail',
};

function nodeDetail(node: MonitoringNode): string {
  const config = node.config ?? {};
  if (node.type === 'send_email') return String(config.templateName ?? config.subject ?? 'E-mail do fluxo');
  if (node.type === 'whatsapp_message') return String(config.templateName ?? 'Template de WhatsApp');
  if (node.type === 'wait') {
    const amount = String(config.amount ?? '1');
    const units: Record<string, string> = { minutes: 'min', hours: 'h', days: 'dias', weeks: 'sem.' };
    return `${amount} ${units[String(config.unit)] ?? String(config.unit ?? 'h')}`;
  }
  if (node.type === 'trigger') return String(config.event === 'segment_entered' ? 'Entrou na segmentação' : config.event ?? 'Gatilho');
  return String(node.label ?? NODE_LABELS[node.type] ?? node.type);
}

export function orderMonitoringNodes(nodes: MonitoringNode[], edges: MonitoringEdge[]): MonitoringNode[] {
  if (!nodes.length) return [];
  const byId = new Map(nodes.map(node => [node.id, node]));
  const incoming = new Map(nodes.map(node => [node.id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const trigger = nodes.find(node => node.type === 'trigger');
  const roots = nodes.filter(node => (incoming.get(node.id) ?? 0) === 0);
  const queue = [...(trigger ? [trigger.id] : []), ...roots.map(node => node.id).filter(id => id !== trigger?.id)];
  const visited = new Set<string>();
  const ordered: MonitoringNode[] = [];

  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (node) ordered.push(node);
    for (const target of outgoing.get(id) ?? []) queue.push(target);
  }
  for (const node of nodes) if (!visited.has(node.id)) ordered.push(node);
  return ordered;
}

export function buildStageMetrics(
  nodes: MonitoringNode[],
  edges: MonitoringEdge[],
  statusRows: StageStatusRow[],
  reachedRows: StageReachedRow[],
) {
  const byNode = new Map<string, Record<string, number>>();
  for (const row of statusRows) {
    if (!row.currentNodeId) continue;
    const statuses = byNode.get(row.currentNodeId) ?? {};
    statuses[row.status] = (statuses[row.status] ?? 0) + row.count;
    byNode.set(row.currentNodeId, statuses);
  }
  const reached = new Map(reachedRows.filter(row => row.nodeId).map(row => [row.nodeId as string, row.count]));

  return orderMonitoringNodes(nodes, edges).map((node, index) => {
    const statuses = byNode.get(node.id) ?? {};
    return {
      nodeId: node.id,
      order: index + 1,
      type: node.type,
      label: NODE_LABELS[node.type] ?? node.label ?? node.type,
      detail: nodeDetail(node),
      reached: reached.get(node.id) ?? 0,
      running: statuses.running ?? 0,
      waiting: statuses.waiting ?? 0,
      queued: statuses.queued ?? 0,
      completed: statuses.completed ?? 0,
      failed: statuses.failed ?? 0,
      cancelled: statuses.cancelled ?? 0,
      current: (statuses.running ?? 0) + (statuses.waiting ?? 0),
    };
  });
}

function matchesExitRule(lead: ExitLead, rule: ExitConditions['conditions'][number]): boolean {
  const expected = String(rule.value ?? '');
  if (rule.field === 'tag') {
    return rule.operator === 'has_tag'
      ? lead.tags.includes(expected)
      : rule.operator === 'not_has_tag'
        ? !lead.tags.includes(expected)
        : false;
  }

  let actual: string | number | null = null;
  switch (rule.field) {
    case 'status': actual = lead.status; break;
    case 'score': actual = lead.score; break;
    case 'source': actual = lead.firstSource; break;
    case 'company': actual = lead.company; break;
    case 'jobTitle': actual = lead.jobTitle; break;
    case 'phone': actual = lead.phone ? '1' : null; break;
    case 'is_hot': return lead.isHot === (expected === 'true');
    case 'assigned_to': actual = lead.assignedTo; break;
    default: return false;
  }
  if (actual === null) return false;

  switch (rule.operator) {
    case '=': return String(actual) === expected;
    case '!=': return String(actual) !== expected;
    case '>': return Number(actual) > Number(expected);
    case '<': return Number(actual) < Number(expected);
    case '>=': return Number(actual) >= Number(expected);
    case '<=': return Number(actual) <= Number(expected);
    case 'contains': return String(actual).toLowerCase().includes(expected.toLowerCase());
    default: return false;
  }
}

export function matchesExitConditions(lead: ExitLead, exit: ExitConditions | null | undefined): boolean {
  if (!exit?.conditions?.length) return false;
  const results = exit.conditions.map(rule => matchesExitRule(lead, rule));
  return exit.logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

export function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}
