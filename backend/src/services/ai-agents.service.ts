import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(/[\n,]/).map(item => item.trim()).filter(Boolean);
  }
  return [];
};

const optionalJson = (value: unknown): Prisma.InputJsonValue => {
  if (value === undefined || value === null || value === '') return {};
  return value as Prisma.InputJsonValue;
};

export class AIAgentsService {
  static async listAgents() {
    return (prisma as any).aIAgent.findMany({
      where: { isActive: true },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        _count: { select: { knowledgeItems: true, interactions: true, memories: true } },
      },
    });
  }

  static async getAgent(id: string) {
    const agent = await (prisma as any).aIAgent.findFirst({
      where: { id, isActive: true },
      include: {
        knowledgeItems: { where: { isActive: true }, orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }] },
        _count: { select: { interactions: true, memories: true } },
      },
    });
    if (!agent) throw new Error('Agente nao encontrado');
    return agent;
  }

  static async createAgent(input: Record<string, unknown>) {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('name is required');

    return (prisma as any).aIAgent.create({
      data: {
        name,
        description: String(input.description || '').trim() || null,
        objective: String(input.objective || '').trim(),
        companyContext: String(input.companyContext || '').trim(),
        salesContext: String(input.salesContext || '').trim(),
        icp: optionalJson(input.icp),
        qualificationCriteria: optionalJson(input.qualificationCriteria),
        disqualificationCriteria: optionalJson(input.disqualificationCriteria),
        toneOfVoice: toStringArray(input.toneOfVoice),
        safetyRules: toStringArray(input.safetyRules),
        discoveryQuestions: toStringArray(input.discoveryQuestions),
        handoffRules: optionalJson(input.handoffRules),
        outputSchema: optionalJson(input.outputSchema),
        defaultProvider: String(input.defaultProvider || '').trim() || null,
        defaultModel: String(input.defaultModel || '').trim() || null,
        fallbackModels: toStringArray(input.fallbackModels),
        isActive: input.isActive !== false,
      },
    });
  }

  static async updateAgent(id: string, input: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = String(input.name || '').trim();
    if (input.description !== undefined) data.description = String(input.description || '').trim() || null;
    if (input.objective !== undefined) data.objective = String(input.objective || '').trim();
    if (input.companyContext !== undefined) data.companyContext = String(input.companyContext || '').trim();
    if (input.salesContext !== undefined) data.salesContext = String(input.salesContext || '').trim();
    if (input.icp !== undefined) data.icp = optionalJson(input.icp);
    if (input.qualificationCriteria !== undefined) data.qualificationCriteria = optionalJson(input.qualificationCriteria);
    if (input.disqualificationCriteria !== undefined) data.disqualificationCriteria = optionalJson(input.disqualificationCriteria);
    if (input.toneOfVoice !== undefined) data.toneOfVoice = toStringArray(input.toneOfVoice);
    if (input.safetyRules !== undefined) data.safetyRules = toStringArray(input.safetyRules);
    if (input.discoveryQuestions !== undefined) data.discoveryQuestions = toStringArray(input.discoveryQuestions);
    if (input.handoffRules !== undefined) data.handoffRules = optionalJson(input.handoffRules);
    if (input.outputSchema !== undefined) data.outputSchema = optionalJson(input.outputSchema);
    if (input.defaultProvider !== undefined) data.defaultProvider = String(input.defaultProvider || '').trim() || null;
    if (input.defaultModel !== undefined) data.defaultModel = String(input.defaultModel || '').trim() || null;
    if (input.fallbackModels !== undefined) data.fallbackModels = toStringArray(input.fallbackModels);
    if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
    if (input.whatsappPhoneNumberId !== undefined) data.whatsappPhoneNumberId = String(input.whatsappPhoneNumberId || '').trim() || null;
    // Minimo de 6h: o job de follow-up roda a cada 30min e recalcula o
    // "silencio" a partir da ULTIMA mensagem (inclusive um follow-up anterior),
    // entao um valor baixo faz o mesmo lead levar um novo follow-up a cada
    // poucos ciclos, ate bater followUpMaxAttempts — ver ai-followup.service.ts.
    if (input.followUpDelayHours !== undefined) data.followUpDelayHours = Math.max(6, Number(input.followUpDelayHours) || 24);
    if (input.followUpMaxAttempts !== undefined) data.followUpMaxAttempts = Math.max(0, Number(input.followUpMaxAttempts) || 0);
    if (input.followUpTemplateNames !== undefined) {
      data.followUpTemplateNames = Array.isArray(input.followUpTemplateNames)
        ? input.followUpTemplateNames.map(v => String(v || '').trim()).filter(Boolean)
        : [];
    }

    return (prisma as any).aIAgent.update({ where: { id }, data });
  }

  static async removeAgent(id: string) {
    return (prisma as any).aIAgent.update({ where: { id }, data: { isActive: false } });
  }

  static async listKnowledge(filters: { agentId?: string; category?: string; tag?: string }) {
    const where: Record<string, unknown> = { isActive: true };
    if (filters.agentId) where.OR = [{ agentId: filters.agentId }, { agentId: null }];
    if (filters.category) where.category = filters.category;
    if (filters.tag) where.tags = { has: filters.tag };

    return (prisma as any).aIKnowledgeItem.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
    });
  }

  static async createKnowledge(input: Record<string, unknown>) {
    const title = String(input.title || '').trim();
    const content = String(input.content || '').trim();
    if (!title) throw new Error('title is required');
    if (!content) throw new Error('content is required');

    return (prisma as any).aIKnowledgeItem.create({
      data: {
        agentId: String(input.agentId || '').trim() || null,
        title,
        category: String(input.category || 'geral').trim() || 'geral',
        content,
        tags: toStringArray(input.tags),
        priority: Number(input.priority ?? 100),
        metadata: optionalJson(input.metadata),
        isActive: input.isActive !== false,
      },
    });
  }

  static async updateKnowledge(id: string, input: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    if (input.agentId !== undefined) data.agentId = String(input.agentId || '').trim() || null;
    if (input.title !== undefined) data.title = String(input.title || '').trim();
    if (input.category !== undefined) data.category = String(input.category || 'geral').trim() || 'geral';
    if (input.content !== undefined) data.content = String(input.content || '').trim();
    if (input.tags !== undefined) data.tags = toStringArray(input.tags);
    if (input.priority !== undefined) data.priority = Number(input.priority ?? 100);
    if (input.metadata !== undefined) data.metadata = optionalJson(input.metadata);
    if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);

    return (prisma as any).aIKnowledgeItem.update({ where: { id }, data });
  }

  static async removeKnowledge(id: string) {
    return (prisma as any).aIKnowledgeItem.update({ where: { id }, data: { isActive: false } });
  }

  static async listLogs(filters: { agentId?: string; leadEmail?: string; limit?: number }) {
    const where: Record<string, unknown> = {};
    if (filters.agentId) where.agentId = filters.agentId;
    if (filters.leadEmail) where.leadEmail = filters.leadEmail.toLowerCase().trim();
    const limit = Math.min(100, Math.max(1, Number.isFinite(filters.limit) ? Number(filters.limit) : 50));

    return (prisma as any).aIInteractionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { agent: { select: { id: true, name: true } } },
    });
  }

  static async listMemories(filters: { agentId?: string; leadEmail?: string; limit?: number }) {
    const where: Record<string, unknown> = {};
    if (filters.agentId) where.agentId = filters.agentId;
    if (filters.leadEmail) where.leadEmail = filters.leadEmail.toLowerCase().trim();
    const limit = Math.min(100, Math.max(1, Number.isFinite(filters.limit) ? Number(filters.limit) : 50));

    return (prisma as any).aIConversationMemory.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: { agent: { select: { id: true, name: true } } },
    });
  }
}
