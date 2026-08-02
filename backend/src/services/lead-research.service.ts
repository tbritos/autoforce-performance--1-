import { prisma } from '../config/database';
import { normalizeEmail } from './lead-hub.service';
import { fetchAndSummarizeSite, OVERALL_SITE_FETCH_TIMEOUT_MS } from './website-verification.service';
import {
  isResearchRetryDue,
  LARA_NEW_LEADS_ACTIVE_SINCE,
  marketingStageForResearchFit,
  pendingResearchFailureData,
  withAbortableTimeout,
} from './lara-runtime.utils';
import {
  buildLeadResearchNameFallbackQuery,
  buildLeadResearchQuery,
  normalizeResearchAssessment,
  type NormalizedResearchAssessment,
} from './lead-research.utils';
import {
  isNonOfficialWebsiteUrl,
  normalizeWebsiteUrl,
  resolveLeadResearchWebsite,
  type LeadWebsiteSource,
} from './lead-site.utils';

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
const SITE_RESEARCH_TIMEOUT_MS = 26_000;
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

function identityTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  const ignored = new Set(['grupo', 'empresa', 'comercio', 'comercial', 'automoveis', 'veiculos', 'ltda', 'sa']);
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length >= 4 && !ignored.has(token));
}

function candidateSitesFromSearchResults(
  results: Array<{ title?: string; url?: string; content?: string }>,
  company: string | null,
): string[] {
  const companyTokens = identityTokens(company);
  if (companyTokens.length === 0) return [];
  const candidates: string[] = [];

  for (const r of results) {
    if (!r.url) continue;
    let hostname: string;
    try {
      hostname = new URL(r.url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      continue;
    }
    if (isNonOfficialWebsiteUrl(r.url)) continue;
    const context = `${hostname} ${r.title ?? ''} ${r.content ?? ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (!companyTokens.some(token => context.includes(token))) continue;
    const candidate = `https://${hostname}`;
    if (!candidates.includes(candidate)) candidates.push(candidate);
    if (candidates.length >= 3) break;
  }
  return candidates;
}

// No máximo 2 visitas de site (Chromium) simultâneas em todo o processo —
// mesmo espírito do limite que existia em website-verification.service.ts,
// carregado pra cá porque agora a pesquisa roda a cada lead novo (bem mais
// frequente que só quando a IA aprendia o site numa conversa ao vivo).
const MAX_CONCURRENT_SITE_FETCHES = 2;
let inFlightSiteFetches = 0;
const siteFetchWaiters: Array<{
  resolve: () => void;
  reject: (error: Error) => void;
  signal: AbortSignal;
  onAbort: () => void;
}> = [];

async function acquireSiteFetchSlot(signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new Error('Visita de site cancelada');
  if (inFlightSiteFetches < MAX_CONCURRENT_SITE_FETCHES) {
    inFlightSiteFetches++;
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const waiter = {
      resolve,
      reject,
      signal,
      onAbort: () => reject(new Error('Visita de site cancelada enquanto aguardava a fila')),
    };
    signal.addEventListener('abort', waiter.onAbort, { once: true });
    siteFetchWaiters.push(waiter);
  });
}

function releaseSiteFetchSlot(): void {
  while (siteFetchWaiters.length > 0) {
    const waiter = siteFetchWaiters.shift()!;
    waiter.signal.removeEventListener('abort', waiter.onAbort);
    if (waiter.signal.aborted) continue;
    // A vaga e transferida diretamente; inFlight continua igual.
    waiter.resolve();
    return;
  }
  inFlightSiteFetches = Math.max(0, inFlightSiteFetches - 1);
}

interface DiscoveredSite {
  siteUrl: string;
  summary: string;
  visitedUrls: string[];
  source: LeadWebsiteSource;
}

async function discoverAndVisitSite(
  email: string,
  company: string | null,
  existingSiteUrl: string | null,
  existingSiteSource: LeadWebsiteSource | null,
  searchResults: Array<{ title?: string; url?: string; content?: string }>,
  parentSignal: AbortSignal,
): Promise<DiscoveredSite | null> {
  const candidates: Array<{ url: string; source: LeadWebsiteSource }> = [
    ...(existingSiteUrl ? [{ url: existingSiteUrl, source: existingSiteSource ?? 'lead_provided' }] : []),
    ...(candidateSiteFromEmail(email) ? [{ url: candidateSiteFromEmail(email)!, source: 'corporate_email' as const }] : []),
    ...candidateSitesFromSearchResults(searchResults, company).map(url => ({ url, source: 'web_search' as const })),
  ];
  const uniqueCandidates = candidates.filter((candidate, index, all) => {
    const normalized = normalizeWebsiteUrl(candidate.url);
    // Um diretorio informado explicitamente ainda pode ser visitado, mas um
    // diretorio descoberto automaticamente jamais vira o site oficial.
    if (candidate.source !== 'lead_provided' && isNonOfficialWebsiteUrl(normalized)) return false;
    return normalized && all.findIndex(other => normalizeWebsiteUrl(other.url) === normalized) === index;
  });
  if (uniqueCandidates.length === 0) return null;

  await acquireSiteFetchSlot(parentSignal);
  try {
    return await withAbortableTimeout(
      async signal => {
        for (const candidate of uniqueCandidates) {
          try {
            const normalizedUrl = normalizeWebsiteUrl(candidate.url);
            if (!normalizedUrl) continue;
            const { summary, visitedUrls } = await fetchAndSummarizeSite(normalizedUrl, signal);
            if (summary) return {
              siteUrl: visitedUrls[0] ?? normalizedUrl,
              summary,
              visitedUrls,
              source: candidate.source,
            };
          } catch (err) {
            if (signal.aborted) throw err;
            console.warn(`[LeadResearch] falha ao visitar candidato de site ${candidate.url} para ${email}:`, err instanceof Error ? err.message : err);
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
    releaseSiteFetchSlot();
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
  findings: {
    officialSite: string | null;
    cnpj: string | null;
    webSearch: string | null;
    previousResearch?: string | null;
  },
  parentSignal: AbortSignal,
): Promise<NormalizedResearchAssessment | null> {
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
      'Comece identificando O QUE A EMPRESA VENDE OU FAZ. Uma empresa que vende software, BI, CRM, marketing, consultoria ou outros servicos PARA concessionarias e fornecedora, nao concessionaria. Palavras automotivas, logos de clientes, noticias do setor e frases como "para sua concessionaria" nao provam que a propria empresa venda veiculos.',
      'O conteudo do site oficial informado pelo lead e a fonte principal sobre a atividade da empresa. Se nome, cargo, resumo anterior ou resultados genericos da web entrarem em conflito com o site oficial, prefira o site. O nome digitado pelo lead pode ser falso ou sem sentido.',
      'Observe a linha "Origem da descoberta". lead_provided e corporate_email sao sinais fortes do dominio. web_search e apenas um candidato: confirme pelo conteudo que ele representa a empresa pesquisada; se essa correspondencia nao estiver clara, nao o trate como site oficial.',
      'Nao invente CNPJ, estoque, atividade, cargo ou tipo de empresa. Cada afirmacao da decisao deve estar apoiada em evidence. Se nao houver evidencia suficiente para afirmar que a empresa e do ICP, use nurture.',
      'Para vehicle_stock, informe um numero somente quando a quantidade estiver comprovada pelo site (contador de resultados, total de anuncios ou listagem inequivoca). Nunca estime estoque por fotos, marcas, numero de lojas ou frases promocionais.',
      'Uma concessionaria oficial pode ser qualified sem contagem de estoque quando o site comprovar claramente a representacao/venda oficial de uma marca. Uma revenda independente exige estoque comprovado de pelo menos 50 veiculos.',
      'Cada item de evidence deve repetir um fato concreto presente nas fontes recebidas. Nao use conhecimento previo do modelo e nao cite uma fonte que nao esteja preenchida.',
      'Identifique separadamente quem fornece/desenvolve a tecnologia do SITE da empresa. Procure sinais explicitos em rodape, credito "desenvolvido por", "powered by", logo com link externo, meta generator ou texto equivalente. Fornecedores comuns incluem AutoForce, DealerSpace, Autoconf, Autoveiculo, Webmotors, Revenda Mais e WordPress, mas essa lista nao prova nada sozinha.',
      'website_provider e website_provider_evidence devem ser null quando nao existir credito explicito. Nao confunda a propria concessionaria com o fornecedor do site. Nao trate Google Analytics, Tag Manager, Meta, Cloudflare, hospedagem/CDN, redes sociais ou bibliotecas JavaScript como fornecedor do site.',
      'O fornecedor do site nao muda o business_type do lead: uma concessionaria com site feito pela AutoForce ou DealerSpace continua sendo dealership; website_provider e apenas informacao comercial complementar.',
      'REGRA DE CARGO: consultor(a) de vendas, consultor(a) comercial e vendedor(a) NAO fazem parte do ICP, mesmo quando trabalham em uma empresa automotiva elegivel, porque nao possuem poder de decisao. Quando o cargo estiver confirmado como um desses, use fit="disqualified", score de 0 a 39 e nao recomende reuniao.',
      'Use fit="disqualified" SOMENTE quando os dados pesquisados indicarem claramente que a empresa NAO e do ICP (ex: e uma agencia, uma consultoria, um fornecedor de tecnologia). Na duvida ou com dado insuficiente, use "nurture" — nunca desqualifique por falta de informacao.',
      'Gere tambem score Lara de 0 a 100. qualified deve ficar entre 70-100; nurture entre 0-69; disqualified entre 0-39. O sistema validara essa coerencia.',
      'Retorne somente JSON valido: { "business_type": "dealership"|"automotive_group"|"automaker"|"vehicle_reseller"|"technology_supplier"|"marketing_agency"|"consultancy"|"non_automotive_company"|"other"|"unknown", "vehicle_stock": numero|null, "website_provider": "nome comprovado"|null, "website_provider_evidence": "credito exato que comprova"|null, "fit": "qualified"|"nurture"|"disqualified", "score": 0-100, "summary": "resumo curto, factual e sem suposicoes", "reason": "motivo direto da decisao", "evidence": [{ "source": "official_site"|"cnpj"|"web_search"|"lead_record", "fact": "fato que sustenta a decisao" }] }.',
    ],
    lead: { nome: lead.name, empresa: lead.company, cargo: lead.jobTitle },
    icp_configurado: agent?.icp ?? null,
    criterios_qualificacao: agent?.qualificationCriteria ?? null,
    criterios_desqualificacao: agent?.disqualificationCriteria ?? null,
    fontes_em_ordem_de_prioridade: {
      site_oficial: findings.officialSite,
      dados_oficiais_cnpj: findings.cnpj,
      busca_web_secundaria: findings.webSearch,
      resumo_anterior_nao_primario: findings.previousResearch ?? null,
    },
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
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                business_type: {
                  type: 'STRING',
                  enum: [
                    'dealership', 'automotive_group', 'automaker', 'vehicle_reseller',
                    'technology_supplier', 'marketing_agency', 'consultancy',
                    'non_automotive_company', 'other', 'unknown',
                  ],
                },
                vehicle_stock: { type: 'NUMBER', nullable: true },
                website_provider: { type: 'STRING', nullable: true },
                website_provider_evidence: { type: 'STRING', nullable: true },
                fit: { type: 'STRING', enum: ['qualified', 'nurture', 'disqualified'] },
                score: { type: 'NUMBER' },
                summary: { type: 'STRING' },
                reason: { type: 'STRING' },
                evidence: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      source: {
                        type: 'STRING',
                        enum: ['official_site', 'cnpj', 'web_search', 'lead_record'],
                      },
                      fact: { type: 'STRING' },
                    },
                    required: ['source', 'fact'],
                  },
                },
              },
              required: ['business_type', 'vehicle_stock', 'website_provider', 'website_provider_evidence', 'fit', 'score', 'summary', 'reason', 'evidence'],
            },
          },
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
    const fallbackSummary = [findings.officialSite, findings.cnpj, findings.webSearch]
      .filter(Boolean)
      .join('\n\n');
    return normalizeResearchAssessment(parsed, fallbackSummary);
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
      select: {
        name: true,
        company: true,
        jobTitle: true,
        city: true,
        state: true,
        siteUrl: true,
        customFields: true,
        researchSiteSource: true,
      },
    });
    if (!lead) return;

    const resolvedWebsite = resolveLeadResearchWebsite(lead);
    const researchInput = {
      name: lead.name,
      company: lead.company,
      jobTitle: lead.jobTitle,
      city: lead.city,
      state: lead.state,
      siteUrl: resolvedWebsite.siteUrl,
      researchSiteSource: resolvedWebsite.source,
    };

    // Corrige o cadastro antes de acessar a web. Assim, mesmo se a visita ou
    // a IA falhar, o valor declarado no formulario nao volta a ser substituido
    // por um resultado de busca de uma tentativa anterior.
    if (resolvedWebsite.cameFromCustomField && resolvedWebsite.siteUrl !== lead.siteUrl) {
      await prisma.lead.update({
        where: { email },
        data: {
          siteUrl: resolvedWebsite.siteUrl,
          researchSiteSource: 'lead_provided',
        },
      });
    }

    await withAbortableTimeout(
      signal => runResearch(email, researchInput, signal),
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
  lead: {
    name: string | null;
    company: string | null;
    jobTitle: string | null;
    city: string | null;
    state: string | null;
    siteUrl: string | null;
    researchSiteSource: LeadWebsiteSource | null;
  },
  signal: AbortSignal,
): Promise<void> {
  const researchQuery = buildLeadResearchQuery(lead);
  if (!researchQuery) {
    // Sem empresa nem nome, nao ha o que pesquisar — marca como concluido
    // (sem resultado) pra nao ficar tentando pra sempre.
    await prisma.lead.update({ where: { email }, data: { researchedAt: new Date() } });
    return;
  }

  const webSearch = await searchWeb(researchQuery, signal);
  const webFindingParts = webSearch.text ? [webSearch.text] : [];

  let siteResult = await discoverAndVisitSite(
    email,
    lead.company,
    lead.siteUrl,
    lead.researchSiteSource,
    webSearch.results,
    signal,
  );

  // Um site digitado errado nao pode condenar todas as tentativas seguintes a
  // repetir a mesma query vazia. Se nenhum candidato abriu, busca novamente
  // pelo nome/localizacao e tenta os novos candidatos. A avaliacao continua
  // conservadora: resultado generico de busca, sozinho, nunca qualifica.
  if (!siteResult && lead.siteUrl) {
    const fallbackQuery = buildLeadResearchNameFallbackQuery(lead);
    if (fallbackQuery && fallbackQuery !== researchQuery) {
      const fallbackSearch = await searchWeb(fallbackQuery, signal);
      if (fallbackSearch.text) webFindingParts.push(fallbackSearch.text);
      siteResult = await discoverAndVisitSite(email, lead.company, null, null, fallbackSearch.results, signal);
    }
  }

  const webFindings = webFindingParts.length > 0 ? webFindingParts.join('\n\n') : null;
  const siteFindings = siteResult
    ? [
        `Site consultado: ${siteResult.siteUrl}`,
        `Origem da descoberta: ${siteResult.source}`,
        `Páginas consultadas: ${siteResult.visitedUrls.join(', ')}`,
        `Conteúdo extraído: ${siteResult.summary}`,
      ].join('\n')
    : null;

  let cnpjFindings: string | null = null;
  // Um CNPJ publicado no próprio site é mais confiável que o primeiro número
  // encontrado em resultados genéricos da busca.
  const cnpj = extractCnpj(siteFindings ?? '') ?? extractCnpj(webFindings ?? '');
  if (cnpj) cnpjFindings = await lookupCnpj(cnpj, signal);

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

  const assessment = await assessResearchFit(lead, {
    officialSite: siteFindings,
    cnpj: cnpjFindings,
    webSearch: webFindings,
  }, signal);

  if (!assessment) {
    await prisma.lead.update({
      where: { email },
      data: {
        ...pendingResearchFailureData(),
        researchSummary: findings.slice(0, 1800),
        ...(siteResult ? {
          siteUrl: siteResult.siteUrl,
          researchVisitedUrls: siteResult.visitedUrls,
          researchSiteSource: siteResult.source,
        } : {}),
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
      researchBusinessType: assessment.businessType,
      researchVehicleStock: assessment.vehicleStock,
      researchWebsiteProvider: assessment.websiteProvider,
      researchWebsiteProviderEvidence: assessment.websiteProviderEvidence,
      researchEvidence: assessment.evidence as any,
      ...(assessment.fit === 'disqualified' ? { isHot: false } : {}),
      ...(siteResult ? {
        siteUrl: siteResult.siteUrl,
        researchVisitedUrls: siteResult.visitedUrls,
        researchSiteSource: siteResult.source,
      } : {}),
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

    const { summary, visitedUrls } = await withAbortableTimeout(
      signal => fetchAndSummarizeSite(siteUrl, signal),
      OVERALL_SITE_FETCH_TIMEOUT_MS,
      `visita de site (${siteUrl})`,
    );
    const siteFindings = `Site informado pelo lead: ${siteUrl}\nPáginas consultadas: ${visitedUrls.join(', ')}\nConteúdo extraído: ${summary}`;
    const combinedFindings = [lead.researchSummary, siteFindings].filter(Boolean).join('\n\n');

    const assessment = await withAbortableTimeout(
      signal => assessResearchFit(lead, {
        officialSite: siteFindings,
        cnpj: null,
        webSearch: null,
        previousResearch: lead.researchSummary,
      }, signal),
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
        ...(assessment ? {
          researchBusinessType: assessment.businessType,
          researchVehicleStock: assessment.vehicleStock,
          researchWebsiteProvider: assessment.websiteProvider,
          researchWebsiteProviderEvidence: assessment.websiteProviderEvidence,
          researchEvidence: assessment.evidence as any,
        } : {}),
        researchVisitedUrls: visitedUrls,
        researchSiteSource: 'lead_provided',
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
