import { LeadStatus } from '@prisma/client';
import type { AIAgentRuntimeContext } from './ai-agent-context.service';

export type AIProvider = 'gemini' | 'openai' | 'fallback';

export type AIPrequalificationResult = {
  fit: 'qualified' | 'nurture' | 'disqualified';
  score: number;
  confidence: number;
  pain: string;
  persona: string;
  urgency: string;
  summary: string;
  decisionReason: string;
  recommendedNextStep: string;
  recommendedActions: Array<{
    type: string;
    reason: string;
    payload?: Record<string, unknown>;
  }>;
  tags: string[];
  source: AIProvider;
  model: string;
  reason?: string;
  conversationState: string;
  leadUpdates: Record<string, unknown>;
  openQuestions: string[];
  replyMessage?: string;
  promptSnapshot?: unknown;
};

export type AIPrequalificationInput = {
  lead: {
    email: string;
    name: string | null;
    company: string | null;
    jobTitle: string | null;
    status: LeadStatus;
    score: number;
    tags: string[];
  };
  transcript: string;
  goal: string;
  criteria: string;
  provider?: string;
  model?: string;
  agentContext?: AIAgentRuntimeContext;
};

export async function runAIPrequalification(
  input: AIPrequalificationInput
): Promise<AIPrequalificationResult> {
  const provider = resolveProvider(input.provider);

  if (provider === 'gemini') {
    return runGeminiPrequalification(input);
  }

  if (provider === 'openai') {
    return runOpenAIPrequalification(input);
  }

  return fallbackAIPrequalification(input, 'Nenhum provedor de IA configurado');
}

function resolveProvider(requestedProvider?: string): AIProvider {
  const requested = String(requestedProvider ?? '').trim().toLowerCase();
  if (requested === 'gemini' || requested === 'google') return 'gemini';
  if (requested === 'openai') return 'openai';

  const configured = String(process.env.AI_PROVIDER ?? '').trim().toLowerCase();
  if (configured === 'gemini' || configured === 'google') return 'gemini';
  if (configured === 'openai') return 'openai';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'fallback';
}

async function runGeminiPrequalification(input: AIPrequalificationInput): Promise<AIPrequalificationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackAIPrequalification(input, 'GEMINI_API_KEY nao configurada');

  const model = resolveModel('gemini', input.model, process.env.GEMINI_MODEL, 'gemini-2.5-flash');
  const prompt = buildPrequalificationPrompt(input);
  const promptText = JSON.stringify(prompt);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini API ${response.status}: ${text.slice(0, 300)}`);
    }

    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('') ?? '{}';
    return normalizeAIPrequalificationResult(JSON.parse(content), 'gemini', model, prompt);
  } catch (error) {
    return fallbackAIPrequalification(input, error instanceof Error ? error.message : 'Falha ao chamar Gemini');
  }
}

async function runOpenAIPrequalification(input: AIPrequalificationInput): Promise<AIPrequalificationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackAIPrequalification(input, 'OPENAI_API_KEY nao configurada');

  const model = resolveModel('openai', input.model, process.env.OPENAI_MODEL, 'gpt-4o-mini');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'Voce e um analista de pre-qualificacao inbound B2B.',
              'Responda somente JSON valido.',
              'Classifique fit como qualified, nurture ou disqualified.',
              'Use score de 0 a 100 e crie tags curtas em snake_case.',
            ].join(' '),
          },
          { role: 'user', content: JSON.stringify(buildPrequalificationPrompt(input)) },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API ${response.status}: ${text.slice(0, 300)}`);
    }

    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content ?? '{}';
    return normalizeAIPrequalificationResult(JSON.parse(content), 'openai', model, buildPrequalificationPrompt(input));
  } catch (error) {
    return fallbackAIPrequalification(input, error instanceof Error ? error.message : 'Falha ao chamar OpenAI');
  }
}

function buildPrequalificationPrompt(input: AIPrequalificationInput): Record<string, unknown> {
  const agent = input.agentContext?.agent;
  return {
    role: 'agente_pre_qualificacao_inbound_autoforce',
    instrucoes_de_resposta: [
      'Retorne somente JSON valido, sem markdown, sem comentarios externos.',
      'Nao invente informacoes ausentes. Quando nao houver evidencia, deixe campos vazios e use nurture.',
      'Toda decisao deve citar evidencias observadas na conversa ou nos dados do lead.',
      'Use tags curtas em snake_case.',
      'Nao prometa preco, desconto, prazo, resultado garantido ou condicoes comerciais.',
      'Nao execute ferramentas externas. Apenas recomende acoes estruturadas para o orquestrador validar.',
    ],
    agente_configurado: agent ? {
      id: agent.id,
      nome: agent.name,
      objetivo: agent.objective,
      contexto_empresa: agent.companyContext,
      contexto_vendas: agent.salesContext,
      icp: agent.icp,
      criterios_qualificacao: agent.qualificationCriteria,
      criterios_desqualificacao: agent.disqualificationCriteria,
      tom_de_voz: agent.toneOfVoice,
      regras_de_seguranca: agent.safetyRules,
      perguntas_de_descoberta: agent.discoveryQuestions,
      regras_de_handoff: agent.handoffRules,
      schema_saida_customizado: agent.outputSchema,
    } : null,
    contexto_autoforce_padrao: AUTOFORCE_CONTEXT,
    contexto_vendas_padrao: SALES_CONTEXT,
    memoria_persistente_do_lead: input.agentContext?.memory ?? null,
    base_de_conhecimento_relevante: input.agentContext?.knowledge ?? [],
    contexto_da_jornada: {
      objetivo_do_bloco: input.goal,
      criterios_configurados: input.criteria,
      estrategia: [
        'Entender a dor principal antes de empurrar reuniao.',
        'Diferenciar curiosidade de intencao comercial real.',
        'Priorizar leads com cargo decisor/influenciador, dor clara, urgencia e abertura para diagnostico.',
        'Quando faltarem dados, recomendar nutricao ou pergunta de descoberta.',
      ],
    },
    contexto_do_lead: input.lead,
    conversa_whatsapp: input.transcript || '(sem historico de conversa)',
    taxonomia: {
      fit: {
        qualified: 'tem dor clara, perfil aderente e sinal de intencao ou urgencia para conversa comercial',
        nurture: 'tem algum interesse, mas falta dor, urgencia, autoridade, contexto ou momento',
        disqualified: 'sem aderencia, pedido fora do escopo, contato invalido ou sinal explicito de desinteresse',
      },
      score: {
        '0_39': 'baixo fit ou informacao insuficiente',
        '40_69': 'nutricao e descoberta',
        '70_100': 'pronto para MQL ou acao comercial',
      },
      urgencia: ['baixa', 'media', 'alta'],
      acoes_recomendadas_permitidas: [
        'apply_tag',
        'create_rd_conversion',
        'send_whatsapp_followup',
        'create_pipedrive_deal',
        'handoff_to_human',
        'stop_sequence',
        'ask_discovery_question',
      ],
    },
    formato_obrigatorio_de_saida: {
      fit: 'qualified | nurture | disqualified',
      score: 'number 0-100',
      confidence: 'number 0-1',
      pain: 'principal dor percebida',
      persona: 'persona ou perfil',
      urgency: 'baixa | media | alta',
      summary: 'resumo objetivo da conversa',
      decision_reason: 'motivo da decisao com evidencias',
      recommended_next_step: 'proxima acao recomendada',
      recommended_actions: [
        {
          type: 'apply_tag | create_rd_conversion | send_whatsapp_followup | create_pipedrive_deal | handoff_to_human | stop_sequence | ask_discovery_question',
          reason: 'por que essa acao faz sentido',
          payload: {},
        },
      ],
      tags: ['tag_exemplo'],
      conversation_state: 'estado atual da conversa',
      lead_updates: {
        campo: 'valor extraido ou atualizado',
      },
      open_questions: ['perguntas importantes ainda sem resposta'],
      reply_message: 'Mensagem de texto a enviar ao lead pelo WhatsApp em resposta à conversa. Português, tom consultivo, máximo 400 caracteres. Null ou vazio se nenhuma resposta for necessária.',
    },
  };
}

const AUTOFORCE_CONTEXT = {
  empresa: 'AutoForce',
  posicionamento: 'empresa de tecnologia e marketing para o mercado automotivo',
  objetivo_comercial: 'ajudar concessionarias, grupos automotivos e operacoes do setor a gerar, organizar, nutrir e converter demanda digital',
  publico_ideal: [
    'concessionarias',
    'grupos automotivos',
    'revendas',
    'gestores de marketing',
    'gestores comerciais',
    'diretores',
    'CEOs',
    'heads de marketing ou vendas',
  ],
  dores_que_costumam_indicar_fit: [
    'baixa geracao de leads qualificados',
    'dificuldade de acompanhar origem e performance dos leads',
    'baixo aproveitamento comercial dos leads',
    'falta de integracao entre marketing, CRM, WhatsApp, RD Station e Pipedrive',
    'necessidade de automatizar nutricao inbound',
    'dificuldade em medir funil, campanhas, analytics e receita',
  ],
  sinais_de_baixo_fit: [
    'lead sem relacao com mercado automotivo ou operacao B2B',
    'pedido de suporte que nao tem relacao com compra/diagnostico',
    'contato sem telefone/email valido',
    'desinteresse explicito',
  ],
};

const SALES_CONTEXT = {
  objetivo_da_pre_qualificacao: 'identificar se o lead deve continuar em nutricao, virar MQL ou ser encaminhado para atendimento humano/comercial',
  criterios_fortes_para_mql: [
    'dor clara relacionada a marketing, vendas, funil, leads ou automacao',
    'cargo decisor ou influenciador',
    'empresa com potencial aderente ao mercado automotivo',
    'urgencia, projeto ativo ou abertura para diagnostico',
    'resposta positiva a convite de conversa ou reuniao',
  ],
  criterios_para_nutricao: [
    'interesse inicial sem dor clara',
    'cargo operacional sem contexto de decisao',
    'lead consumindo conteudo, mas sem sinal comercial',
    'necessidade de descobrir maturidade, dor ou momento',
  ],
  tom_de_voz: [
    'consultivo',
    'objetivo',
    'humano',
    'sem pressao excessiva',
    'focado em diagnosticar antes de vender',
  ],
};

const ALLOWED_MODELS: Record<Exclude<AIProvider, 'fallback'>, ReadonlySet<string>> = {
  gemini: new Set([
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ]),
  openai: new Set([
    'gpt-4o-mini',
    'gpt-4o',
    'gpt-4.1-mini',
    'gpt-4.1',
  ]),
};

function resolveModel(
  provider: Exclude<AIProvider, 'fallback'>,
  requestedModel: string | undefined,
  envModel: string | undefined,
  fallbackModel: string
): string {
  const allowed = ALLOWED_MODELS[provider];
  const requested = String(requestedModel ?? '').trim();
  if (requested && allowed.has(requested)) return requested;

  const configured = String(envModel ?? '').trim();
  if (configured && allowed.has(configured)) return configured;

  return fallbackModel;
}

function fallbackAIPrequalification(
  input: Pick<AIPrequalificationInput, 'lead' | 'transcript'>,
  reason: string
): AIPrequalificationResult {
  const lastLines = input.transcript.split('\n').slice(-6).join(' | ');
  return {
    fit: 'nurture',
    score: Math.max(input.lead.score, 30),
    confidence: 0,
    pain: '',
    persona: '',
    urgency: 'media',
    summary: lastLines ? `Analise pendente. Ultimas mensagens: ${lastLines}` : `Analise pendente: ${reason}`,
    decisionReason: reason,
    recommendedNextStep: 'Revisar conversa manualmente ou configurar AI_PROVIDER/GEMINI_API_KEY.',
    recommendedActions: [
      {
        type: 'handoff_to_human',
        reason: 'A IA nao conseguiu analisar com seguranca.',
        payload: { reason },
      },
    ],
    tags: ['ia_pendente'],
    source: 'fallback',
    model: 'fallback',
    reason,
    conversationState: 'needs_human_review',
    leadUpdates: {},
    openQuestions: [],
    replyMessage: undefined,
  };
}

function normalizeAIPrequalificationResult(
  raw: unknown,
  source: Exclude<AIProvider, 'fallback'>,
  model: string,
  promptSnapshot: unknown
): AIPrequalificationResult {
  const data = isRecord(raw) ? raw : {};
  const fitRaw = String(data.fit ?? 'nurture').toLowerCase();
  const fit: AIPrequalificationResult['fit'] =
    fitRaw === 'qualified' || fitRaw === 'disqualified' ? fitRaw : 'nurture';
  const score = Math.max(0, Math.min(100, Number(data.score ?? 0) || 0));
  const confidence = Math.max(0, Math.min(1, Number(data.confidence ?? 0) || 0));
  const tags = Array.isArray(data.tags)
    ? data.tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 12)
    : [];
  const recommendedActions = Array.isArray(data.recommended_actions)
    ? data.recommended_actions
        .filter(isRecord)
        .slice(0, 8)
        .map(action => ({
          type: String(action.type ?? ''),
          reason: String(action.reason ?? ''),
          payload: isRecord(action.payload) ? action.payload : undefined,
        }))
        .filter(action => action.type)
    : [];
  const openQuestions = Array.isArray(data.open_questions)
    ? data.open_questions.map(question => String(question).trim()).filter(Boolean).slice(0, 12)
    : [];

  return {
    fit,
    score,
    confidence,
    pain: String(data.pain ?? ''),
    persona: String(data.persona ?? ''),
    urgency: String(data.urgency ?? ''),
    summary: String(data.summary ?? ''),
    decisionReason: String(data.decision_reason ?? data.decisionReason ?? ''),
    recommendedNextStep: String(data.recommended_next_step ?? data.recommendedNextStep ?? ''),
    recommendedActions,
    tags,
    source,
    model,
    conversationState: String(data.conversation_state ?? data.conversationState ?? fit),
    leadUpdates: isRecord(data.lead_updates) ? data.lead_updates : {},
    openQuestions,
    replyMessage: data.reply_message ? String(data.reply_message).trim().slice(0, 1024) : undefined,
    promptSnapshot,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
