import { prisma } from '../config/database';
import { SegmentService, SegmentRules } from './segment.service';

type AutomationNode = { id: string; type: string; config?: Record<string, string> };

// Segmentos sao dinamicos (regras, nao lista fixa) — nao existe um evento nativo de
// "entrou no segmento". Este avaliador roda periodicamente (ver sync-scheduler.service.ts),
// recalcula quem satisfaz as regras de cada segmento usado como gatilho e compara com o
// ultimo estado conhecido (SegmentTriggerMembership) para detectar quem entrou/saiu.
export async function evaluateSegmentTriggers(): Promise<void> {
  const journeys = await prisma.automationJourney.findMany({ where: { isActive: true }, select: { nodes: true } });

  const segmentIds = new Set<string>();
  for (const journey of journeys) {
    const nodes = (journey.nodes as unknown as AutomationNode[]) ?? [];
    for (const node of nodes) {
      if (node.type === 'trigger' && node.config?.event === 'segment_entered' && node.config.eventValue) {
        segmentIds.add(node.config.eventValue);
      }
    }
  }
  if (!segmentIds.size) return;

  const { fireTrigger } = await import('./automation-engine.service');

  for (const segmentId of segmentIds) {
    try {
      const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
      if (!segment) continue;

      const rules = segment.rules as unknown as SegmentRules;
      const where = { ...SegmentService.buildWhere(rules), status: { not: 'DISQUALIFIED' as const } };
      const currentLeads = await prisma.lead.findMany({ where, select: { email: true } });
      const currentEmails = new Set(currentLeads.map(l => l.email));

      const previousMembers = await prisma.segmentTriggerMembership.findMany({
        where: { segmentId },
        select: { leadEmail: true },
      });
      const previousEmails = new Set(previousMembers.map(m => m.leadEmail));

      const entered = [...currentEmails].filter(email => !previousEmails.has(email));
      const left = [...previousEmails].filter(email => !currentEmails.has(email));

      if (left.length) {
        await prisma.segmentTriggerMembership.deleteMany({ where: { segmentId, leadEmail: { in: left } } });
      }

      for (const leadEmail of entered) {
        await prisma.segmentTriggerMembership.create({ data: { segmentId, leadEmail } }).catch(() => {});
        fireTrigger('segment_entered', leadEmail, { segmentId }).catch(err =>
          console.error(`[segment-trigger] fireTrigger falhou para ${leadEmail}:`, err)
        );
      }
    } catch (err) {
      console.error(`[segment-trigger] falha ao avaliar segmento ${segmentId}:`, err);
    }
  }
}
