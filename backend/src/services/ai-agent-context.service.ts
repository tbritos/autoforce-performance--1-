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
    fallbackModels: string[];
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
  // Resultado da "Pesquisa de informacao" (ver lead-research.service.ts) —
  // busca na web, CNPJ e verificacao do site do lead (Playwright), tudo
  // combinado num so resumo — evidencia levantada de forma independente,
  // separada do que o lead simplesmente afirma na conversa. null ate a
  // pesquisa terminar com algum resultado.
  research: {
    siteUrl: string | null;
    researchedAt: Date | null;
    summary: string;
    icpSignal: string | null;
  } | null;
};

type LoadContextInput = {
  agentId?: string;
  leadEmail?: string;
  channel?: string;
  knowledgeCategories?: string[];
  knowledgeTags?: string[];
  skipMemory?: boolean;
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
  objective: 'Pre-qualificar leads inbound de concessionarias, grupos automotivos, revendas e montadoras — agencias de marketing/publicidade e empresas fora do varejo/distribuicao automotiva NAO fazem parte do ICP, mesmo que atendam o setor automotivo. Entender a dor principal do lead, conectar essa dor ao produto AutoForce mais adequado, e coletar progressivamente as informacoes de qualificacao (empresa, segmento, site atual, CRM, unidades) usando o que ja e conhecido no sistema antes de perguntar. Avancar para demonstracao apenas quando tiver empresa + segmento (dentro do ICP) + dor mapeada com profundidade real.',
  companyContext: [
    'A AutoForce e uma empresa de tecnologia e marketing especializada no setor automotivo.',
    'Ajuda concessionarias, grupos automotivos e revendas a gerar, organizar, nutrir e converter demanda digital.',
    'Produtos principais: Autodromo (site/CMS de alta performance), AutoPilot (CRM + IA conversacional), NitroAds (assessoria de midia de performance).',
    'O sistema conecta leads, campanhas, analytics, RD Station, WhatsApp e Pipedrive para dar visibilidade do funil e acelerar vendas.',
  ].join('\n'),
  salesContext: [
    'A pre-qualificacao deve diagnosticar antes de vender. Entenda a dor antes de apresentar solucao.',
    'Use o que ja sabe sobre o lead (empresa, cargo, campanha de origem) para contextualizar as perguntas — nunca peca informacao que ja esta no sistema.',
    'Para considerar um lead qualificado (SQL), o agente precisa saber: empresa identificada, segmento definido, dor principal mapeada, abertura para conhecer a solucao.',
    'Leads com interesse inicial mas sem dor clara continuam em nutricao. Consultores de vendas, consultores comerciais e vendedores ficam fora do ICP por nao terem poder de decisao.',
    'Nao prometer preco, desconto, prazo ou resultado garantido.',
  ].join('\n'),
  icp: {
    segments: ['concessionarias oficiais de marca', 'grupos automotivos (multiplas unidades)', 'revendas de veiculos com pelo menos 50 veiculos em estoque', 'montadoras'],
    roles: ['CEO', 'Socio', 'Diretor', 'Head', 'Gerente de Marketing', 'Gerente Comercial', 'Coordenador de Marketing'],
    pains: [
      'site sem geracao de leads ou dependente de agencia para qualquer mudanca',
      'demora no atendimento dos leads (mais de 5 minutos para responder)',
      'nao sabe quantos leads chegam e somem sem resposta',
      'CRM sem adesao da equipe ou sem CRM nenhum',
      'baixa conversao de lead em venda',
      'sem visibilidade de qual campanha gerou qual venda',
      'marketing e vendas operando desconectados',
      'atendimento inconsistente entre lojas ou vendedores',
    ],
    fornecedores_site_concorrentes: ['DealerSpace', 'Autoconf', 'Autoveiculo', 'Webmotors', 'Revenda Mais', 'agencia propria', 'WordPress generico', 'sem site profissional'],
    fornecedores_crm_concorrentes: ['Syonet', 'AlpesOne', 'Motorleads', 'Microwork', 'Autocerto', 'Followize', 'Salesforce', 'planilha Excel', 'sem CRM'],
  },
  qualificationCriteria: {
    sql: [
      'empresa identificada',
      'segmento definido dentro do ICP (concessionaria / grupo automotivo / montadora / revenda com pelo menos 50 veiculos em estoque)',
      'dor principal mapeada com clareza — area do problema + causa raiz ou estado atual, nao so uma palavra vaga',
      'cargo decisor ou influenciador confirmado',
      'abertura para conhecer a solucao demonstrada',
    ],
    nurture: ['interesse inicial sem dor clara', 'sem momento definido', 'precisa de educacao antes da abordagem comercial'],
  },
  disqualificationCriteria: {
    examples: ['fora do mercado automotivo', 'agencia de marketing/publicidade (mesmo que atenda o setor automotivo)', 'fornecedor de tecnologia ou consultoria', 'revenda de veiculos com menos de 50 veiculos em estoque', 'consultor(a) de vendas, consultor(a) comercial ou vendedor(a), por nao possuir poder de decisao', 'desinteresse explicito', 'pedido fora do escopo', 'contato invalido'],
  },
  toneOfVoice: ['consultivo', 'objetivo', 'humano', 'sem pressao excessiva'],
  safetyRules: [
    'Nao inventar informacoes.',
    'Nao prometer resultado garantido.',
    'Nao informar preco ou desconto sem autorizacao.',
    'Encaminhar para humano quando houver duvida sensivel ou pedido comercial especifico.',
  ],
  discoveryQuestions: [
    'Qual plataforma ou empresa cuida do site de voces hoje?',
    'Voces usam algum CRM para gestao dos leads? Qual?',
    'Quantas lojas ou unidades a operacao possui?',
    'Fazem parte de algum grupo automotivo ou sao uma operacao independente?',
    'Qual marca (ou marcas) voces representam?',
    'Tem alguem de marketing interno ou e tudo via agencia?',
    'Qual e o maior gargalo hoje: gerar leads, qualificar ou converter em vendas?',
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
  const [memory, knowledge, researchLead] = await Promise.all([
    (input.skipMemory || !input.leadEmail)
      ? Promise.resolve(null)
      : (prisma as any).aIConversationMemory.findUnique({
          where: { agentId_leadEmail_channel: { agentId: agent.id, leadEmail: input.leadEmail, channel } },
        }),
    listKnowledge(agent.id, input.knowledgeCategories, input.knowledgeTags),
    !input.leadEmail
      ? Promise.resolve(null)
      : prisma.lead.findUnique({
          where: { email: input.leadEmail },
          select: { siteUrl: true, researchedAt: true, researchSummary: true, researchIcpSignal: true },
        }),
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
      fallbackModels: agent.fallbackModels ?? [],
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
    research: researchLead?.researchSummary ? {
      siteUrl: researchLead.siteUrl,
      researchedAt: researchLead.researchedAt,
      summary: researchLead.researchSummary,
      icpSignal: researchLead.researchIcpSignal,
    } : null,
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
  const baseWhere: Record<string, unknown> = {
    isActive: true,
    OR: [{ agentId }, { agentId: null }],
  };

  const cleanCategories = (categories ?? []).map(item => item.trim()).filter(Boolean);
  const cleanTags = (tags ?? []).map(item => item.trim()).filter(Boolean);

  const where = { ...baseWhere };
  if (cleanCategories.length > 0 || cleanTags.length > 0) {
    where.AND = [{
      OR: [
        ...(cleanCategories.length > 0 ? [{ category: { in: cleanCategories } }] : []),
        ...(cleanTags.length > 0 ? [{ tags: { hasSome: cleanTags } }] : []),
      ],
    }];
  }

  let items = await (prisma as any).aIKnowledgeItem.findMany({
    where,
    orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
    take: 40,
  });

  if (items.length === 0 && (cleanCategories.length > 0 || cleanTags.length > 0)) {
    items = await (prisma as any).aIKnowledgeItem.findMany({
      where: baseWhere,
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
      take: 12,
    });
  }

  const scored: Array<{ item: any; score: number }> = items.map((item: any) => {
    const itemTags = Array.isArray(item.tags) ? item.tags.map((tag: unknown) => String(tag).toLowerCase()) : [];
    const tagScore = cleanTags.reduce((total, tag) => total + (itemTags.includes(tag.toLowerCase()) ? 4 : 0), 0);
    const categoryScore = cleanCategories.includes(String(item.category)) ? 2 : 0;
    const priorityScore = Math.max(0, 100 - Number(item.priority ?? 100)) / 100;
    return { item, score: tagScore + categoryScore + priorityScore };
  });

  return scored
    .sort((a: { item: any; score: number }, b: { item: any; score: number }) =>
      b.score - a.score || Number(a.item.priority ?? 100) - Number(b.item.priority ?? 100)
    )
    .slice(0, 6)
    .map((entry: { item: any; score: number }) => entry.item);
}
