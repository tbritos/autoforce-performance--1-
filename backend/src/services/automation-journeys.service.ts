import { prisma } from '../config/database';

export interface JourneyNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  config?: Record<string, unknown>;
}

export interface JourneyEdge {
  id: string;
  source: string;
  target: string;
}

export interface AutomationJourneyInput {
  name: string;
  description?: string | null;
  status?: string;
  nodes?: JourneyNode[];
  edges?: JourneyEdge[];
  triggerType?: string | null;
  isActive?: boolean;
}

const validStatus = (status?: string) => {
  if (!status) return 'DRAFT';
  const normalized = status.toUpperCase();
  return ['DRAFT', 'ACTIVE', 'PAUSED'].includes(normalized) ? normalized : 'DRAFT';
};

export class AutomationJourneysService {
  static async list() {
    return (prisma as any).automationJourney.findMany({
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  static async create(input: AutomationJourneyInput) {
    if (!input.name?.trim()) throw new Error('name is required');

    const status = validStatus(input.status);
    return (prisma as any).automationJourney.create({
      data: {
        name: input.name.trim(),
        description: input.description || null,
        status,
        isActive: input.isActive ?? status === 'ACTIVE',
        triggerType: input.triggerType || null,
        nodes: input.nodes ?? [],
        edges: input.edges ?? [],
      },
    });
  }

  static async update(id: string, input: Partial<AutomationJourneyInput>) {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description || null;
    if (input.status !== undefined) {
      const status = validStatus(input.status);
      data.status = status;
      data.isActive = status === 'ACTIVE';
    }
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.triggerType !== undefined) data.triggerType = input.triggerType || null;
    if (input.nodes !== undefined) data.nodes = input.nodes;
    if (input.edges !== undefined) data.edges = input.edges;

    return (prisma as any).automationJourney.update({ where: { id }, data });
  }

  static async remove(id: string) {
    return (prisma as any).automationJourney.delete({ where: { id } });
  }
}
