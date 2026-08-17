import { prisma } from '../config/database';
import { SegmentService, SegmentRules } from './segment.service';

type AutomationNode = { id: string; type: string; config?: Record<string, string> };

// Segmentos sao dinamicos (regras, nao lista fixa) — nao existe um evento nativo de
// "entrou no segmento". Este avaliador roda periodicamente (ver sync-scheduler.service.ts),
// recalcula quem satisfaz as regras de cada segmento usado como gatilho e compara com o
// ultimo estado conhecido (SegmentTriggerMembership) para detectar quem entrou/saiu.
//
// O rastreio e por (segmento, journey): cada automacao que usa o mesmo segmento como
// gatilho tem seu proprio historico de "quem ja processei", entao uma automacao criada
// depois processa normalmente quem ja estava no segmento antes dela existir.
export async function evaluateSegmentTriggers(): Promise<void> {
  const journeys = await prisma.automationJourney.findMany({ where: { isActive: true }, select: { id: true, nodes: true } });

  // Agrupa journeys por segmentId usado como gatilho, para calcular a lista de leads
  // do segmento uma unica vez mesmo que varias automacoes compartilhem o mesmo segmento.
  const journeysBySegment = new Map<string, string[]>();
  for (const journey of journeys) {
    const nodes = (journey.nodes as unknown as AutomationNode[]) ?? [];
    for (const node of nodes) {
      if (node.type === 'trigger' && node.config?.event === 'segment_entered' && node.config.eventValue) {
        const segmentId = node.config.eventValue;
        const list = journeysBySegment.get(segmentId) ?? [];
        list.push(journey.id);
        journeysBySegment.set(segmentId, list);
      }
    }
  }
  if (!journeysBySegment.size) return;

  const { fireTriggerForJourney } = await import('./automation-engine.service');

  for (const [segmentId, journeyIds] of journeysBySegment) {
    try {
      const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
      if (!segment) continue;

      const rules = segment.rules as unknown as SegmentRules;
      const where = { ...await SegmentService.buildWhere(rules, [segment.id]), status: { not: 'DISQUALIFIED' as const } };
      const currentLeads = await prisma.lead.findMany({ where, select: { email: true } });
      const currentEmails = new Set(currentLeads.map(l => l.email));

      for (const journeyId of journeyIds) {
        const previousMembers = await prisma.segmentTriggerMembership.findMany({
          where: { segmentId, journeyId },
          select: { leadEmail: true },
        });
        const previousEmails = new Set(previousMembers.map(m => m.leadEmail));

        const entered = [...currentEmails].filter(email => !previousEmails.has(email));
        const left = [...previousEmails].filter(email => !currentEmails.has(email));

        if (left.length) {
          await prisma.segmentTriggerMembership.deleteMany({ where: { segmentId, journeyId, leadEmail: { in: left } } });
        }

        for (const leadEmail of entered) {
          await prisma.segmentTriggerMembership.create({ data: { segmentId, journeyId, leadEmail } }).catch(() => {});
          fireTriggerForJourney(journeyId, leadEmail, { segmentId }).catch(err =>
            console.error(`[segment-trigger] fireTriggerForJourney falhou para ${leadEmail}:`, err)
          );
        }
      }
    } catch (err) {
      console.error(`[segment-trigger] falha ao avaliar segmento ${segmentId}:`, err);
    }
  }
}

// Limpa o rastreamento de uma journey especifica, forcando o proximo ciclo a tratar
// todo mundo que bate com o segmento agora como entrada nova — usado para reprocessar
// manualmente (ex: apos corrigir um bug num bloco da automacao).
export async function resetSegmentTriggerForJourney(journeyId: string): Promise<number> {
  const result = await prisma.segmentTriggerMembership.deleteMany({ where: { journeyId } });
  return result.count;
}
