import { prisma } from '../config/database';
import { normalizeEmail } from './lead-hub.service';

// Pesquisa automatica de informacao (coluna "Novo" do CRM Lara) — dispara
// UMA VEZ quando um lead novo chega (webhook de campanha real ou primeira
// mensagem de WhatsApp), busca dados publicos sobre a empresa/pessoa (web +
// CNPJ) e decide, sem mandar nenhuma mensagem, se o lead avanca pra
// Qualificacao ou Sem Interesse. Mesmo padrao (lock atomico + sweep
// periodico) de website-verification.service.ts — ver esse arquivo pro
// desenho original que este reaproveita.

const LOCK_TTL_MS = 60_000;
export const MAX_RESEARCH_ATTEMPTS = 3;
const OVERALL_TIMEOUT_MS = 25_000;

// Mesma lista usada em ai-followup.service.ts/lead-marketing-stage.service.ts
// pra excluir importacao em massa — reforcado aqui porque upsertLead
// (webhook de campanha) e o mesmo caminho usado pela importacao de CSV.
const EXCLUDED_RESEARCH_SOURCES = ['importacao_csv', 'rdstation', 'rdstation_webhook'];

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms)),
  ]);
}

// ─── Fonte 1: busca na web (Tavily) ────────────────────────────────────────────

async function searchWeb(query: string): Promise<string | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
      }),
    });
    if (!res.ok) {
      console.warn(`[LeadResearch] Tavily respondeu ${res.status} pra query "${query}"`);
      return null;
    }
    const data = await res.json() as {
      answer?: string;
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    const parts: string[] = [];
    if (data.answer) parts.push(`Resumo: ${data.answer}`);
    for (const r of (data.results ?? []).slice(0, 5)) {
      if (r.title || r.content) parts.push(`- ${r.title ?? ''}: ${(r.content ?? '').slice(0, 300)} (${r.url ?? ''})`);
    }
    return parts.length > 0 ? parts.join('\n') : null;
  } catch (err) {
    console.warn('[LeadResearch] falha na busca web (Tavily):', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Fonte 2: CNPJ / dados oficiais da empresa (BrasilAPI, gratuita) ──────────

function extractCnpj(text: string): string | null {
  const match = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, '');
  return digits.length === 14 ? digits : null;
}

async function lookupCnpj(cnpj: string): Promise<string | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const razaoSocial = data.razao_social ?? data.nome_fantasia;
    const situacao = data.descricao_situacao_cadastral;
    const atividade = (data.cnae_fiscal_descricao as string | undefined) ?? '';
    const porte = data.descricao_porte ?? '';
    return `Dados oficiais (CNPJ ${cnpj}): razão social "${razaoSocial}", situação cadastral "${situacao}", atividade principal "${atividade}", porte "${porte}".`;
  } catch (err) {
    console.warn(`[LeadResearch] falha ao consultar CNPJ ${cnpj} na BrasilAPI:`, err instanceof Error ? err.message : err);
    return null;
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
  findings: string
): Promise<{ fit: 'qualified' | 'nurture' | 'disqualified'; summary: string; reason: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const agent = await (prisma as any).aIAgent.findFirst({
    where: { isActive: true },
    select: { icp: true, qualificationCriteria: true, disqualificationCriteria: true },
  });

  const prompt = {
    instrucao: [
      'Voce esta analisando um lead que ACABOU de entrar no sistema — nenhuma conversa aconteceu ainda, e voce NAO vai mandar nenhuma mensagem.',
      'Sua unica tarefa e decidir, a partir de dados publicos pesquisados (busca na web, dados oficiais da empresa), se esse lead parece se encaixar no ICP da AutoForce.',
      'ICP: concessionaria oficial, grupo automotivo, montadora, ou revenda de veiculos com pelo menos 50 veiculos em estoque. Agencias de marketing/publicidade, fornecedores de tecnologia, consultorias e qualquer empresa que nao seja concessionaria/grupo/revenda/montadora NAO fazem parte do ICP, mesmo que atuem no mercado automotivo.',
      'Use fit="disqualified" SOMENTE quando os dados pesquisados indicarem claramente que a empresa NAO e do ICP (ex: e uma agencia, uma consultoria, um fornecedor de tecnologia). Na duvida ou com dado insuficiente, use "nurture" — nunca desqualifique por falta de informacao.',
      'Retorne somente JSON valido: { "fit": "qualified"|"nurture"|"disqualified", "summary": "resumo curto do que a pesquisa encontrou sobre a empresa/pessoa", "reason": "motivo direto da decisao de fit" }.',
    ],
    lead: { nome: lead.name, empresa: lead.company, cargo: lead.jobTitle },
    icp_configurado: agent?.icp ?? null,
    criterios_qualificacao: agent?.qualificationCriteria ?? null,
    criterios_desqualificacao: agent?.disqualificationCriteria ?? null,
    dados_pesquisados: findings,
  };

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(prompt) }] }],
          generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        }),
      }
    );
    if (!res.ok) {
      console.warn(`[LeadResearch] Gemini respondeu ${res.status} na avaliacao de fit`);
      return null;
    }
    const payload = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const content = payload.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '{}';
    const parsed = JSON.parse(content);
    const fit = ['qualified', 'nurture', 'disqualified'].includes(parsed.fit) ? parsed.fit : 'nurture';
    return {
      fit,
      summary: typeof parsed.summary === 'string' ? parsed.summary : findings.slice(0, 500),
      reason: typeof parsed.reason === 'string' ? parsed.reason : 'Pesquisa automática de informação',
    };
  } catch (err) {
    console.warn('[LeadResearch] falha ao avaliar fit via Gemini:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── Entrada principal ─────────────────────────────────────────────────────────

export async function researchLead(leadEmailRaw: string): Promise<void> {
  const email = normalizeEmail(leadEmailRaw);
  const now = new Date();

  // Trava atomica (UPDATE...WHERE) — mesmo padrao de verifyLeadWebsite.
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
      select: { name: true, company: true, jobTitle: true },
    });
    if (!lead) return;

    await withTimeout(runResearch(email, lead), OVERALL_TIMEOUT_MS, `pesquisa de lead (${email})`);
  } catch (err) {
    await prisma.lead.update({
      where: { email },
      data: { researchedAt: new Date(), researchAttempts: { increment: 1 } },
    }).catch(() => {});
    console.error(`[LeadResearch] falha ao pesquisar ${email}:`, err instanceof Error ? err.message : err);
  } finally {
    await prisma.lead.update({ where: { email }, data: { researchInProgress: false } }).catch(() => {});
  }
}

async function runResearch(
  email: string,
  lead: { name: string | null; company: string | null; jobTitle: string | null }
): Promise<void> {
  const queryTarget = lead.company || lead.name;
  if (!queryTarget) {
    // Sem empresa nem nome, nao ha o que pesquisar — marca como concluido
    // (sem resultado) pra nao ficar tentando pra sempre.
    await prisma.lead.update({ where: { email }, data: { researchedAt: new Date() } });
    return;
  }

  const webFindings = await searchWeb(`${queryTarget} empresa CNPJ concessionária revenda de veículos`);

  let cnpjFindings: string | null = null;
  const cnpj = webFindings ? extractCnpj(webFindings) : null;
  if (cnpj) cnpjFindings = await lookupCnpj(cnpj);

  const findings = [webFindings, cnpjFindings].filter(Boolean).join('\n\n');

  if (!findings) {
    // Nenhuma fonte configurada ou nenhum resultado encontrado — grava que
    // tentou, sem sinal de ICP (fica em Novo, sem decisao automatica).
    await prisma.lead.update({
      where: { email },
      data: { researchedAt: new Date(), researchAttempts: { increment: 1 } },
    });
    console.log(`[LeadResearch] ${email} — nenhuma fonte disponível ou nenhum resultado encontrado`);
    return;
  }

  const assessment = await assessResearchFit(lead, findings);

  await prisma.lead.update({
    where: { email },
    data: {
      researchedAt: new Date(),
      researchSummary: assessment?.summary ?? findings.slice(0, 1800),
      researchIcpSignal: assessment?.fit ?? null,
    },
  });

  if (assessment) {
    const { setMarketingStage } = await import('./lead-marketing-stage.service');
    const stage = assessment.fit === 'disqualified' ? 'SEM_INTERESSE' : 'QUALIFICACAO';
    await setMarketingStage(email, stage, 'ai', undefined, assessment.reason).catch(() => {});
  }

  console.log(`[LeadResearch] ${email} — pesquisa concluída (fit=${assessment?.fit ?? 'sem decisão'})`);
}

// Chamado nos 3 pontos de criacao de lead (upsertLead, resend inbound,
// whatsapp inbound) — mesmo padrao fire-and-forget ja usado ali pra
// LeadScoringService.applyScoringRulesToLead. So dispara pra lead com
// telefone (sem WhatsApp nao ha canal pra eventualmente confirmar o
// engajamento) e que NAO veio de importacao em massa (o mesmo endpoint de
// upsertLead atende webhook de campanha real E importacao de CSV).
export async function triggerLeadResearch(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { email: true, phone: true, firstSource: true },
  });
  if (!lead || !lead.phone) return;
  if (lead.firstSource && EXCLUDED_RESEARCH_SOURCES.includes(lead.firstSource)) return;

  await researchLead(lead.email);
}

// ─── Varredura periodica (rede de seguranca pra falhas transitorias) ──────────
// Mesmo padrao de sweepUnverifiedSites (website-verification.service.ts) —
// so considera quem ainda esta em NOVO (quem ja progrediu nao precisa mais
// de pesquisa) e nunca reprocessa leads antigos (o gatilho real e sempre a
// criacao; isso so cobre quem falhou de forma transitoria logo apos criar).
const BACKOFF_MS_BY_ATTEMPT: Record<number, number> = {
  0: 0,
  1: 5 * 60 * 1000,
  2: 30 * 60 * 1000,
};

export async function sweepUnresearchedLeads(limit = 20): Promise<{ checked: number }> {
  const candidates = await prisma.lead.findMany({
    where: {
      marketingStage: 'NOVO',
      phone: { not: null },
      researchedAt: null,
      researchAttempts: { lt: MAX_RESEARCH_ATTEMPTS },
      researchInProgress: false,
      NOT: { firstSource: { in: EXCLUDED_RESEARCH_SOURCES } },
    },
    select: { email: true, researchAttempts: true, firstSeenAt: true },
    take: limit * 3,
    orderBy: { firstSeenAt: 'asc' },
  });

  const now = Date.now();
  const eligible = candidates
    .filter(c => {
      const delay = BACKOFF_MS_BY_ATTEMPT[c.researchAttempts] ?? 2 * 60 * 60 * 1000;
      return now - c.firstSeenAt.getTime() >= delay;
    })
    .slice(0, limit);

  let checked = 0;
  for (const lead of eligible) {
    await researchLead(lead.email);
    checked++;
  }
  return { checked };
}
