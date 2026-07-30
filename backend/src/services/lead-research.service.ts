import { prisma } from '../config/database';
import { normalizeEmail } from './lead-hub.service';
import { fetchAndSummarizeSite, OVERALL_SITE_FETCH_TIMEOUT_MS } from './website-verification.service';
import {
  isResearchRetryDue,
  LARA_NEW_LEADS_ACTIVE_SINCE,
  marketingStageForResearchFit,
  normalizeAIScoreForFit,
  pendingResearchFailureData,
  withAbortableTimeout,
} from './lara-runtime.utils';

// Pesquisa automatica de informacao (coluna "Novo" do CRM Lara) — dispara
// quando um lead novo chega por qualquer origem (campanha, WhatsApp, RD,
// importacao etc.), busca dados publicos sobre a empresa/pessoa (web, CNPJ e
// o site — descoberto sozinha se nao estiver preenchido) e decide, sem mandar
// mensagem, se o lead avanca pra Qualificacao, Nutricao ou Sem Interesse.
// Unifica o que antes era duas features separadas: esta pesquisa e a
// verificacao de site que existia em website-verification.service.ts (agora
// so um utilitario de busca segura — ver esse arquivo).

const LOCK_TTL_MS = 90_000;
export const MAX_RESEARCH_ATTEMPTS = 3;
const OVERALL_TIMEOUT_MS = 50_000;
const TAVILY_TIMEOUT_MS = 8_000;
const BRASIL_API_TIMEOUT_MS = 5_000;
const SITE_RESEARCH_TIMEOUT_MS = 20_000;
const RESEARCH_AI_TIMEOUT_MS = 12_000;
const RESEARCH_QUEUE_CONCURRENCY = 3;

const pendingResearchQueue: string[] = [];
const queuedResearchEmails = new Set<string>();
let activeResearchWorkers = 0;

function drainResearchQueue(): void {
  while (
    activeResearchWorkers < RESEARCH_QUEUE_CONCURRENCY
    && pendingResearchQueue.length > 0
  ) {
    const email = pendingResearchQueue.shift();
    if (!email) continue;

    activeResearchWorkers++;
    void researchLead(email)
      .catch(err => {
        console.error(
          `[LeadResearch] falha na pesquisa enfileirada de ${email}:`,
          err instanceof Error ? err.message : err,
        );
      })
      .finally(() => {
        activeResearchWorkers--;
        queuedResearchEmails.delete(email);
        drainResearchQueue();
      });
  }
}

function enqueueLeadResearch(email: string): void {
  if (queuedResearchEmails.has(email)) return;
  queuedResearchEmails.add(email);
  pendingResearchQueue.push(email);
  queueMicrotask(drainResearchQueue);
}

// ─── Fonte 1: busca na web (Tavily) ────────────────────────────────────────────

interface WebSearchResult {
  text: string | null;
  results: Array<{ title?: string; url?: string; content?: string }>;
}

async function searchWeb(query: string, parentSignal: AbortSignal): Promise<WebSearchResult> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return { text: null, results: [] };

  try {
    const res = await withAbortableTimeout(
      signal => fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          max_results: 5,
          include_answer: true,
        }),
        signal,
      }),
      TAVILY_TIMEOUT_MS,
      'busca Tavily',
      parentSignal,
    );
    if (!res.ok) {
      console.warn(`[LeadResearch] Tavily respondeu ${res.status} pra query "${query}"`);
      return { text: null, results: [] };
    }
    const data = await res.json() as {
      answer?: string;
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    const results = data.results ?? [];
    const parts: string[] = [];
    if (data.answer) parts.push(`Resumo: ${data.answer}`);
    for (const r of results.slice(0, 5)) {
      if (r.title || r.content) parts.push(`- ${r.title ?? ''}: ${(r.content ?? '').slice(0, 300)} (${r.url ?? ''})`);
    }
    return { text: parts.length > 0 ? parts.join('\n') : null, results };
  } catch (err) {
    if (parentSignal.aborted) throw err;
    console.warn('[LeadResearch] falha na busca web (Tavily):', err instanceof Error ? err.message : err);
    return { text: null, results: [] };
  }
}

// ─── Fonte 2: CNPJ / dados oficiais da empresa (BrasilAPI, gratuita) ──────────

function extractCnpj(text: string): string | null {
  const match = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, '');
  return digits.length === 14 ? digits : null;
}

async function lookupCnpj(cnpj: string, parentSignal: AbortSignal): Promise<string | null> {
  try {
    const res = await withAbortableTimeout(
      signal => fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal }),
      BRASIL_API_TIMEOUT_MS,
      'consulta BrasilAPI',
      parentSignal,
    );
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const razaoSocial = data.razao_social ?? data.nome_fantasia;
    const situacao = data.descricao_situacao_cadastral;
    const atividade = (data.cnae_fiscal_descricao as string | undefined) ?? '';
    const porte = data.descricao_porte ?? '';
    return `Dados oficiais (CNPJ ${cnpj}): razão social "${razaoSocial}", situação cadastral "${situacao}", atividade principal "${atividade}", porte "${porte}".`;
  } catch (err) {
    if (parentSignal.aborted) throw err;
    console.warn(`[LeadResearch] falha ao consultar CNPJ ${cnpj} na BrasilAPI:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Fonte 3: descoberta + verificação do site ────────────────────────────────
// Ordem de prioridade (para no primeiro candidato que carregar de verdade):
// (1) site ja conhecido no cadastro; (2) dominio do email, se nao for um
// provedor pessoal generico (o dominio corporativo costuma SER o site);
// (3) um resultado da busca Tavily que nao seja rede social/diretorio/vaga.

const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'yahoo.com', 'yahoo.com.br', 'icloud.com', 'me.com', 'aol.com', 'protonmail.com',
  'bol.com.br', 'uol.com.br', 'terra.com.br', 'ig.com.br', 'globo.com', 'globomail.com',
  'r7.com', 'zipmail.com.br', 'oi.com.br', 'click21.com.br', 'superig.com.br',
]);

function candidateSiteFromEmail(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) return null;
  return `https://${domain}`;
}

// Domínios que aparecem com frequência em buscas por nome de empresa mas
// quase nunca SÃO o site oficial dela — não é uma lista exaustiva, só o
// suficiente pra não desperdiçar a tentativa de visita nesses casos óbvios.
const NON_OFFICIAL_SITE_DOMAINS = [
  'linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'youtube.com',
  'reclameaqui.com.br', 'glassdoor.com', 'glassdoor.com.br', 'indeed.com', 'catho.com.br',
  'google.com', 'wikipedia.org', 'econodata.com.br', 'empresascnpj.com', 'cnpj.biz',
  'consultasocio.com', 'apontador.com.br', 'guiamais.com.br', 'telelistas.net', 'casadados.com.br',
];

function candidateSiteFromSearchResults(results: Array<{ url?: string }>): string | null {
  for (const r of results) {
    if (!r.url) continue;
    let hostname: string;
    try {
      hostname = new URL(r.url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      continue;
    }
    if (NON_OFFICIAL_SITE_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))) continue;
    return `https://${hostname}`;
  }
  return null;
}

// No máximo 2 visitas de site (Chromium) simultâneas em todo o processo —
// mesmo espírito do limite que existia em website-verification.service.ts,
// carregado pra cá porque agora a pesquisa roda a cada lead novo (bem mais
// frequente que só quando a IA aprendia o site numa conversa ao vivo).
const MAX_CONCURRENT_SITE_FETCHES = 2;
let inFlightSiteFetches = 0;

async function discoverAndVisitSite(
  email: string,
  existingSiteUrl: string | null,
  searchResults: Array<{ url?: string }>,
  parentSignal: AbortSignal,
): Promise<{ siteUrl: string; summary: string } | null> {
  const candidates = [
    existingSiteUrl,
    candidateSiteFromEmail(email),
    candidateSiteFromSearchResults(searchResults),
  ].filter((c): c is string => !!c);
  if (candidates.length === 0) return null;

  if (inFlightSiteFetches >= MAX_CONCURRENT_SITE_FETCHES) {
    console.log(`[LeadResearch] limite de visitas de site simultâneas atingido — ${email} sem verificação de site nessa rodada`);
    return null;
  }

  inFlightSiteFetches++;
  try {
    return await withAbortableTimeout(
      async signal => {
        for (const candidate of candidates) {
          try {
            const { summary } = await fetchAndSummarizeSite(candidate, signal);
            if (summary) return { siteUrl: candidate, summary };
          } catch (err) {
            if (signal.aborted) throw err;
            console.warn(`[LeadResearch] falha ao visitar candidato de site ${candidate} para ${email}:`, err instanceof Error ? err.message : err);
          }
        }
        return null;
      },
      Math.min(SITE_RESEARCH_TIMEOUT_MS, OVERALL_SITE_FETCH_TIMEOUT_MS),
      `rodada de verificacao de site (${email})`,
      parentSignal,
    );
  } catch (err) {
    if (parentSignal.aborted) throw err;
    console.warn(
      `[LeadResearch] rodada de verificacao de site encerrada para ${email}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  } finally {
    inFlightSiteFetches--;
  }
}

// ─── Decisão de fit a partir da pesquisa (sem conversa nenhuma) ───────────────
// Prompt deliberadamente pequeno e separado do de qualificacao por conversa
// (buildPrequalificationPrompt em ai-provider.service.ts) — aquele pressupoe
// uma conversa em andamento e exige reply_message sempre preenchido, o que
// nao faz sentido aqui (etapa 100% silenciosa, sem nenhum contato). Repete
// a regra central de ICP em texto curto — se a definicao de ICP mudar na
// config do agente, revisar tambem aqui.
async function assessResearchFit(
  lead: { name: string | null; company: string | null; jobTitle: string | null },
  findings: string,
  parentSignal: AbortSignal,
): Promise<{ fit: 'qualified' | 'nurture' | 'disqualified'; score: number; summary: string; reason: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const agent = await (prisma as any).aIAgent.findFirst({
    where: { isActive: true },
    select: { icp: true, qualificationCriteria: true, disqualificationCriteria: true },
  });

  const prompt = {
    instrucao: [
      'Voce esta analisando um lead — a pesquisa pode ter acontecido na entrada dele no sistema OU ser uma atualizacao depois que ele mencionou o site numa conversa. NAO envie nenhuma mensagem, essa etapa e so leitura/analise.',
      'Sua unica tarefa e decidir, a partir de dados publicos pesquisados (busca na web, dados oficiais da empresa, conteudo do site), se esse lead parece se encaixar no ICP da AutoForce.',
      'ICP: concessionaria oficial, grupo automotivo, montadora, ou revenda de veiculos com pelo menos 50 veiculos em estoque. Agencias de marketing/publicidade, fornecedores de tecnologia, consultorias e qualquer empresa que nao seja concessionaria/grupo/revenda/montadora NAO fazem parte do ICP, mesmo que atuem no mercado automotivo.',
      'Use fit="disqualified" SOMENTE quando os dados pesquisados indicarem claramente que a empresa NAO e do ICP (ex: e uma agencia, uma consultoria, um fornecedor de tecnologia). Na duvida ou com dado insuficiente, use "nurture" — nunca desqualifique por falta de informacao.',
      'Gere tambem score Lara de 0 a 100. qualified deve ficar entre 70-100; nurture entre 0-69; disqualified entre 0-39. O sistema validara essa coerencia.',
      'Retorne somente JSON valido: { "fit": "qualified"|"nurture"|"disqualified", "score": 0-100, "summary": "resumo curto do que a pesquisa encontrou sobre a empresa/pessoa", "reason": "motivo direto da decisao de fit" }.',
    ],
    lead: { nome: lead.name, empresa: lead.company, cargo: lead.jobTitle },
    icp_configurado: agent?.icp ?? null,
    criterios_qualificacao: agent?.qualificationCriteria ?? null,
    criterios_desqualificacao: agent?.disqualificationCriteria ?? null,
    dados_pesquisados: findings,
  };

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const res = await withAbortableTimeout(
      signal => fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(prompt) }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
          signal,
        },
      ),
      RESEARCH_AI_TIMEOUT_MS,
      'avaliacao de fit via Gemini',
      parentSignal,
    );
    if (!res.ok) {
      console.warn(`[LeadResearch] Gemini respondeu ${res.status} na avaliacao de fit`);
      return null;
    }
    const payload = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const content = payload.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '{}';
    const parsed = JSON.parse(content);
    const fit: 'qualified' | 'nurture' | 'disqualified' =
      parsed.fit === 'qualified' || parsed.fit === 'disqualified' ? parsed.fit : 'nurture';
    return {
      fit,
      score: normalizeAIScoreForFit(fit, parsed.score),
      summary: typeof parsed.summary === 'string' ? parsed.summary : findings.slice(0, 500),
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'Pesquisa automática de informação',
    };
  } catch (err) {
    if (parentSignal.aborted) throw err;
    console.warn('[LeadResearch] falha ao avaliar fit via Gemini:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Entrada principal ─────────────────────────────────────────────────────────

export async function researchLead(leadEmailRaw: string): Promise<void> {
  const email = normalizeEmail(leadEmailRaw);
  const now = new Date();

  // Trava atomica (UPDATE...WHERE, nao ler-depois-escrever).
  const acquired = await prisma.lead.updateMany({
    where: {
      email,
      OR: [
        { researchInProgress: false },
        { researchStartedAt: { lt: new Date(now.getTime() - LOCK_TTL_MS) } },
      ],
    },
    data: { researchInProgress: true, researchStartedAt: now },
  });
  if (acquired.count === 0) {
    console.log(`[LeadResearch] pesquisa ja em andamento pra ${email} — pulando`);
    return;
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { email },
      select: { name: true, company: true, jobTitle: true, siteUrl: true },
    });
    if (!lead) return;

    await withAbortableTimeout(
      signal => runResearch(email, lead, signal),
      OVERALL_TIMEOUT_MS,
      `pesquisa de lead (${email})`,
    );
  } catch (err) {
    await prisma.lead.update({
      where: { email },
      data: pendingResearchFailureData(),
    }).catch(() => {});
    console.error(`[LeadResearch] falha ao pesquisar ${email}:`, err instanceof Error ? err.message : err);
  } finally {
    await prisma.lead.update({ where: { email }, data: { researchInProgress: false } }).catch(() => {});
  }
}

async function runResearch(
  email: string,
  lead: { name: string | null; company: string | null; jobTitle: string | null; siteUrl: string | null },
  signal: AbortSignal,
): Promise<void> {
  const queryTarget = lead.company || lead.name;
  if (!queryTarget) {
    // Sem empresa nem nome, nao ha o que pesquisar — marca como concluido
    // (sem resultado) pra nao ficar tentando pra sempre.
    await prisma.lead.update({ where: { email }, data: { researchedAt: new Date() } });
    return;
  }

  const webSearch = await searchWeb(`${queryTarget} empresa CNPJ concessionária revenda de veículos`, signal);
  const webFindings = webSearch.text;

  let cnpjFindings: string | null = null;
  const cnpj = webFindings ? extractCnpj(webFindings) : null;
  if (cnpj) cnpjFindings = await lookupCnpj(cnpj, signal);

  const siteResult = await discoverAndVisitSite(email, lead.siteUrl, webSearch.results, signal);
  const siteFindings = siteResult ? `Conteúdo do site (${siteResult.siteUrl}): ${siteResult.summary}` : null;

  const findings = [webFindings, cnpjFindings, siteFindings].filter(Boolean).join('\n\n');

  if (!findings) {
    // Nenhuma fonte configurada ou nenhum resultado encontrado — grava que
    // tentou, sem sinal de ICP (fica em Novo, sem decisao automatica).
    await prisma.lead.update({
      where: { email },
      data: pendingResearchFailureData(),
    });
    console.log(`[LeadResearch] ${email} — nenhuma fonte disponível ou nenhum resultado encontrado`);
    return;
  }

  const assessment = await assessResearchFit(lead, findings, signal);

  if (!assessment) {
    await prisma.lead.update({
      where: { email },
      data: {
        ...pendingResearchFailureData(),
        researchSummary: findings.slice(0, 1800),
        ...(siteResult ? { siteUrl: siteResult.siteUrl } : {}),
      },
    });
    console.log(`[LeadResearch] ${email} — avaliacao inconclusiva; nova tentativa sera agendada`);
    return;
  }

  await prisma.lead.update({
    where: { email },
    data: {
      researchedAt: new Date(),
      researchSummary: assessment.summary,
      researchIcpSignal: assessment.fit,
      ...(siteResult ? { siteUrl: siteResult.siteUrl } : {}),
    },
  });
  // Pesquisa preenche o score somente enquanto a Lara ainda nao avaliou a
  // conversa. Se uma conversa gravar aiScore em paralelo ou antes, ela vence.
  await prisma.lead.updateMany({
    where: { email, aiScore: null },
    data: { aiScore: assessment.score },
  });

  const { setMarketingStage } = await import('./lead-marketing-stage.service');
  const stage = marketingStageForResearchFit(assessment.fit);
  await setMarketingStage(email, stage, 'research', undefined, assessment.reason).catch(() => {});

  console.log(`[LeadResearch] ${email} — pesquisa concluída (fit=${assessment.fit}, site=${siteResult?.siteUrl ?? 'não encontrado'})`);
}

// Chamado nos 3 pontos de criacao de lead (upsertLead, resend inbound,
// whatsapp inbound). So dispara pra lead com telefone (sem WhatsApp nao ha
// canal pra eventualmente confirmar o engajamento). Origem/tag nao excluem
// mais importacao ou RD: todos entram na mesma fila limitada, evitando que
// uma importacao grande abra centenas de pesquisas externas em paralelo.
export async function triggerLeadResearch(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { email: true, phone: true },
  });
  if (!lead || !lead.phone) return;

  enqueueLeadResearch(lead.email);
}

// Chamado quando a IA aprende/atualiza o site do lead DURANTE uma conversa
// ao vivo (enrichLeadFromAI, ai-whatsapp-reply.service.ts). So revisita o
// site e funde o resultado na pesquisa existente — NAO repete a busca
// Tavily/CNPJ, que ja rodou na criacao do lead, pra nao gastar credito de
// API paga de novo so porque o site mudou.
export async function refreshSiteResearch(leadEmailRaw: string, siteUrl: string): Promise<void> {
  const email = normalizeEmail(leadEmailRaw);
  const now = new Date();

  const acquired = await prisma.lead.updateMany({
    where: {
      email,
      OR: [
        { researchInProgress: false },
        { researchStartedAt: { lt: new Date(now.getTime() - LOCK_TTL_MS) } },
      ],
    },
    data: { researchInProgress: true, researchStartedAt: now },
  });
  if (acquired.count === 0) {
    console.log(`[LeadResearch] pesquisa ja em andamento pra ${email} — pulando atualização de site`);
    return;
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { email },
      select: { name: true, company: true, jobTitle: true, researchSummary: true },
    });
    if (!lead) return;

    const { summary } = await withAbortableTimeout(
      signal => fetchAndSummarizeSite(siteUrl, signal),
      OVERALL_SITE_FETCH_TIMEOUT_MS,
      `visita de site (${siteUrl})`,
    );
    const siteFindings = `Conteúdo do site (${siteUrl}): ${summary}`;
    const combinedFindings = [lead.researchSummary, siteFindings].filter(Boolean).join('\n\n');

    const assessment = await withAbortableTimeout(
      signal => assessResearchFit(lead, combinedFindings, signal),
      RESEARCH_AI_TIMEOUT_MS + 1_000,
      `reavaliacao de site (${email})`,
    );

    await prisma.lead.update({
      where: { email },
      data: {
        siteUrl,
        researchedAt: new Date(),
        researchSummary: assessment?.summary ?? combinedFindings.slice(0, 1800),
        // So sobrescreve o sinal de ICP se a reavaliacao realmente rodou —
        // sem chave do Gemini configurada, mantem o sinal anterior em vez
        // de apagar uma decisao boa que ja existia.
        ...(assessment ? { researchIcpSignal: assessment.fit } : {}),
      },
    });
    if (assessment) {
      await prisma.lead.updateMany({
        where: { email, aiScore: null },
        data: { aiScore: assessment.score },
      });
    }

    if (assessment) {
      const { setMarketingStage } = await import('./lead-marketing-stage.service');
      const stage = marketingStageForResearchFit(assessment.fit);
      await setMarketingStage(email, stage, 'research', undefined, assessment.reason).catch(() => {});
    }
    console.log(`[LeadResearch] ${email} — site atualizado durante conversa (fit=${assessment?.fit ?? 'sem decisão'})`);
  } catch (err) {
    console.error(`[LeadResearch] falha ao atualizar pesquisa de site para ${email}:`, err instanceof Error ? err.message : err);
  } finally {
    await prisma.lead.update({ where: { email }, data: { researchInProgress: false } }).catch(() => {});
  }
}

// ─── Varredura periodica (rede de seguranca pra falhas transitorias) ──────────
// So considera quem ainda esta em NOVO (quem ja progrediu nao precisa mais
// de pesquisa) e nunca reprocessa leads antigos (o gatilho real e sempre a
// criacao; isso so cobre quem falhou de forma transitoria logo apos criar).
export async function sweepUnresearchedLeads(limit = 20): Promise<{ checked: number }> {
  const candidates = await prisma.lead.findMany({
    where: {
      marketingStage: 'NOVO',
      phone: { not: null },
      firstSeenAt: { gte: LARA_NEW_LEADS_ACTIVE_SINCE },
      researchedAt: null,
      researchAttempts: { lt: MAX_RESEARCH_ATTEMPTS },
      researchInProgress: false,
    },
    select: { email: true, researchAttempts: true, firstSeenAt: true, researchStartedAt: true },
    take: limit * 3,
    orderBy: { firstSeenAt: 'asc' },
  });

  const now = Date.now();
  const eligible = candidates
    .filter(c => isResearchRetryDue(
      c.researchAttempts,
      c.firstSeenAt,
      c.researchStartedAt,
      now,
    ))
    .slice(0, limit);

  let checked = 0;
  for (const lead of eligible) {
    await researchLead(lead.email);
    checked++;
  }
  return { checked };
}
