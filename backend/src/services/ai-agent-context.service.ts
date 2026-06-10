import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import type { AIPrequalificationResult } from './ai-provider.service';

export type AIAgentRuntimeContext = {
  agent: {
    id: string;
    name: string;
    objective: string;
    companyContext: string;
    salesContext: string;
    icp: unknown;
    qualificationCriteria: unknown;
    disqualificationCriteria: unknown;
    toneOfVoice: string[];
    safetyRules: string[];
    discoveryQuestions: string[];
    handoffRules: unknown;
    outputSchema: unknown;
    defaultProvider: string | null;
    defaultModel: string | null;
  };
  memory: {
    summary: string | null;
    knownFacts: unknown;
    pains: string[];
    objections: string[];
    interests: string[];
    lastIntent: string | null;
    lastConversationState: string | null;
    nextBestAction: string | null;
    openQuestions: string[];
    lastMessageAt: Date | null;
  } | null;
  knowledge: Array<{
    title: string;
    category: string;
    content: string;
    tags: string[];
    priority: number;
  }>;
};

type LoadContextInput = {
  agentId?: string;
  leadEmail: string;
  channel?: string;
  knowledgeCategories?: string[];
  knowledgeTags?: string[];
};

type PersistContextInput = {
  agentId: string;
  leadEmail: string;
  channel: string;
  journeyId?: string;
  executionId?: string;
  nodeId?: string;
  provider: string;
  model: string;
  promptSnapshot: unknown;
  result: AIPrequalificationResult;
  error?: string;
  lastMessageAt?: Date | null;
};

const DEFAULT_AGENT = {
  name: 'SDR Inbound AutoForce',
  description: 'Agente padrao para pre-qualificacao inbound da AutoForce.',
  objective: 'Pre-qualificar leads inbound, entender dor e momento, e decidir se deve nutrir, virar MQL ou ir para atendimento humano.',
  companyContext: [
    'A AutoForce e uma empresa de tecnologia e marketing para o mercado automotivo.',
    'Ajuda concessionarias, grupos automotivos e operacoes do setor a gerar, organizar, nutrir e converter demanda digital.',
    'O sistema conecta leads, campanhas, analytics, RD Station, WhatsApp e Pipedrive para dar visibilidade do funil e acelerar vendas.',
  ].join('\n'),
  salesContext: [
    'A pre-qualificacao deve diagnosticar antes de vender.',
    'Leads com dor clara de marketing/vendas/funil, cargo decisor ou influenciador, empresa aderente e abertura para diagnostico podem virar MQL.',
    'Leads com interesse inicial, mas sem dor, urgencia ou autoridade, devem continuar em nutricao.',
    'Nao prometer preco, desconto, prazo ou resultado garantido.',
  ].join('\n'),
  icp: {
    segments: ['concessionarias', 'grupos automotivos', 'revendas', 'operacoes automotivas B2B'],
    roles: ['CEO', 'Diretor', 'Head', 'Gerente de Marketing', 'Gerente Comercial', 'Coordenador'],
    pains: ['baixa conversao de leads', 'falta de visibilidade do funil', 'baixo aproveitamento comercial', 'marketing e vendas desconectados'],
  },
  qualificationCriteria: {
    mql: ['dor clara', 'fit automotivo', 'cargo decisor ou influenciador', 'urgencia ou abertura para diagnostico'],
    nurture: ['interesse inicial sem dor clara', 'sem momento definido', 'precisa educacao antes da abordagem comercial'],
  },
  disqualificationCriteria: {
    examples: ['fora do mercado automotivo', 'desinteresse explicito', 'pedido fora do escopo', 'contato invalido'],
  },
  toneOfVoice: ['consultivo', 'objetivo', 'humano', 'sem pressao excessiva'],
  safetyRules: [
    'Nao inventar informacoes.',
    'Nao prometer resultado garantido.',
    'Nao informar preco ou desconto sem autorizacao.',
    'Encaminhar para humano quando houver duvida sensivel ou pedido comercial especifico.',
  ],
  discoveryQuestions: [
    'Qual e o maior gargalo hoje: gerar leads, qualificar leads ou converter em vendas?',
    'Como voces acompanham a origem e o andamento dos leads hoje?',
    'Existe uma meta ou projeto ativo para melhorar esse funil nos proximos meses?',
  ],
  handoffRules: {
    handoffWhen: ['pedido de reuniao', 'pedido de preco', 'lead qualificado com urgencia alta', 'duvida comercial especifica'],
  },
  outputSchema: {
    fit: 'qualified | nurture | disqualified',
    score: '0-100',
    confidence: '0-1',
    recommended_actions: 'array',
  },
};

export async function loadAIAgentContext(input: LoadContextInput): Promise<AIAgentRuntimeContext> {
  const channel = input.channel || 'whatsapp';
  const agent = await resolveAgent(input.agentId);
  const [memory, knowledge] = await Promise.all([
    (prisma as any).aIConversationMemory.findUnique({
      where: { agentId_leadEmail_channel: { agentId: agent.id, leadEmail: input.leadEmail, channel } },
    }),
    listKnowledge(agent.id, input.knowledgeCategories, input.knowledgeTags),
  ]);

  return {
    agent: {
      id: agent.id,
      name: agent.name,
      objective: agent.objective,
      companyContext: agent.companyContext,
      salesContext: agent.salesContext,
      icp: agent.icp,
      qualificationCriteria: agent.qualificationCriteria,
      disqualificationCriteria: agent.disqualificationCriteria,
      toneOfVoice: agent.toneOfVoice ?? [],
      safetyRules: agent.safetyRules ?? [],
      discoveryQuestions: agent.discoveryQuestions ?? [],
      handoffRules: agent.handoffRules,
      outputSchema: agent.outputSchema,
      defaultProvider: agent.defaultProvider,
      defaultModel: agent.defaultModel,
    },
    memory: memory ? {
      summary: memory.summary,
      knownFacts: memory.knownFacts,
      pains: memory.pains ?? [],
      objections: memory.objections ?? [],
      interests: memory.interests ?? [],
      lastIntent: memory.lastIntent,
      lastConversationState: memory.lastConversationState,
      nextBestAction: memory.nextBestAction,
      openQuestions: memory.openQuestions ?? [],
      lastMessageAt: memory.lastMessageAt,
    } : null,
    knowledge: knowledge.map((item: any) => ({
      title: item.title,
      category: item.category,
      content: item.content,
      tags: item.tags ?? [],
      priority: item.priority,
    })),
  };
}

export async function persistAIAgentDecision(input: PersistContextInput): Promise<void> {
  const result = input.result;
  const knownFacts = {
    pain: result.pain,
    persona: result.persona,
    urgency: result.urgency,
    fit: result.fit,
    score: result.score,
    confidence: result.confidence,
    leadUpdates: result.leadUpdates as Prisma.JsonObject,
  } satisfies Prisma.JsonObject;

  await (prisma as any).aIConversationMemory.upsert({
    where: {
      agentId_leadEmail_channel: {
        agentId: input.agentId,
        leadEmail: input.leadEmail,
        channel: input.channel,
      },
    },
    create: {
      agentId: input.agentId,
      leadEmail: input.leadEmail,
      channel: input.channel,
      summary: result.summary || null,
      knownFacts,
      pains: result.pain ? [result.pain] : [],
      objections: [],
      interests: result.tags.filter(tag => tag.startsWith('interesse_') || tag.startsWith('dor_')),
      lastIntent: result.fit,
      lastConversationState: result.conversationState || result.fit,
      nextBestAction: result.recommendedNextStep || null,
      openQuestions: result.openQuestions,
      lastMessageAt: input.lastMessageAt ?? null,
    },
    update: {
      summary: result.summary || undefined,
      knownFacts,
      pains: result.pain ? { set: [result.pain] } : undefined,
      interests: { set: result.tags.filter(tag => tag.startsWith('interesse_') || tag.startsWith('dor_')) },
      lastIntent: result.fit,
      lastConversationState: result.conversationState || result.fit,
      nextBestAction: result.recommendedNextStep || null,
      openQuestions: { set: result.openQuestions },
      lastMessageAt: input.lastMessageAt ?? undefined,
    },
  });

  await (prisma as any).aIInteractionLog.create({
    data: {
      agentId: input.agentId,
      leadEmail: input.leadEmail,
      journeyId: input.journeyId || null,
      executionId: input.executionId || null,
      nodeId: input.nodeId || null,
      channel: input.channel,
      provider: input.provider,
      model: input.model,
      promptSnapshot: input.promptSnapshot as Prisma.JsonObject,
      response: result as unknown as Prisma.JsonObject,
      decision: result.fit,
      confidence: result.confidence,
      recommendedActions: result.recommendedActions as unknown as Prisma.JsonArray,
      error: input.error || result.reason || null,
    },
  });
}

async function resolveAgent(agentId?: string): Promise<any> {
  if (agentId) {
    const agent = await (prisma as any).aIAgent.findFirst({ where: { id: agentId, isActive: true } });
    if (agent) return agent;
  }

  const existing = await (prisma as any).aIAgent.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;

  return (prisma as any).aIAgent.create({ data: DEFAULT_AGENT });
}

async function listKnowledge(
  agentId: string,
  categories?: string[],
  tags?: string[]
): Promise<any[]> {
  const where: Record<string, unknown> = {
    isActive: true,
    OR: [{ agentId }, { agentId: null }],
  };

  const cleanCategories = (categories ?? []).map(item => item.trim()).filter(Boolean);
  if (cleanCategories.length > 0) where.category = { in: cleanCategories };

  const cleanTags = (tags ?? []).map(item => item.trim()).filter(Boolean);
  if (cleanTags.length > 0) where.tags = { hasSome: cleanTags };

  return (prisma as any).aIKnowledgeItem.findMany({
    where,
    orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
    take: 12,
  });
}
