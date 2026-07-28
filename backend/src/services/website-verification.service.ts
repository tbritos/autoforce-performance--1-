import dns from 'dns/promises';
import { chromium } from 'playwright';
import { prisma } from '../config/database';
import { normalizeEmail } from './lead-hub.service';

// Verifica de forma independente o site que o lead informou, visitando a
// pagina com um navegador de verdade (Playwright/Chromium) — a primeira vez
// que este backend busca uma URL controlada por um usuario externo (todo
// outro fetch() do sistema aponta pra hosts fixos de API ou env vars
// configuradas por um operador). Isso abre superficie real de SSRF, tratada
// com varias camadas de defesa abaixo — nao e um detalhe cosmetico.

const NAV_TIMEOUT_MS = 18_000;
const DNS_TIMEOUT_MS = 5_000;
const OVERALL_TIMEOUT_MS = 35_000;
const MAX_TEXT_LENGTH = 1800;
const MAX_CONCURRENT_CHECKS = 2;
export const MAX_SITE_CHECK_ATTEMPTS = 3;

// TTL do lock siteCheckInProgress/siteCheckStartedAt — deliberadamente
// separado de aiProcessing/aiProcessingAt (ver comentario no schema.prisma):
// lancar/navegar um Chromium tem um perfil de duracao e modo de falha
// diferente de uma chamada de LLM, e generoso o bastante pra cobrir
// launch+navegacao+extracao com folga sem travar um lead pra sempre se o
// processo realmente morrer no meio do caminho.
const LOCK_TTL_MS = 90_000;

let inFlightChecks = 0;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms)),
  ]);
}

// ─── SSRF: bloqueio de faixas de IP privadas/reservadas ───────────────────────

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range) & mask);
}

// Alem das faixas privadas classicas (RFC1918) e loopback/link-local, inclui
// o CGNAT (100.64.0.0/10 — comum em redes internas de provedores de nuvem) e
// o endpoint de metadata de nuvem (169.254.169.254, dentro de 169.254.0.0/16).
const BLOCKED_IPV4_CIDRS = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '224.0.0.0/4',
  '240.0.0.0/4',
];

export function isBlockedIpv4(ip: string): boolean {
  return BLOCKED_IPV4_CIDRS.some(cidr => ipv4InCidr(ip, cidr));
}

// Expande um endereco IPv6 (incluindo a forma abreviada "::" e o sufixo
// IPv4-mapeado tipo "::ffff:192.168.1.1") pro inteiro de 128 bits equivalente.
function ipv6ToBigInt(ip: string): bigint {
  let addr = ip;
  const ipv4Embedded = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Embedded) {
    const v4Int = ipv4ToInt(ipv4Embedded[1]);
    const hex = v4Int.toString(16).padStart(8, '0');
    addr = addr.slice(0, addr.length - ipv4Embedded[1].length) + hex.slice(0, 4) + ':' + hex.slice(4);
  }
  const [head, tail] = addr.includes('::') ? addr.split('::') : [addr, ''];
  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail ? tail.split(':').filter(Boolean) : [];
  const missing = Math.max(8 - headParts.length - tailParts.length, 0);
  const allParts = [...headParts, ...Array(missing).fill('0'), ...tailParts].slice(0, 8);
  let result = 0n;
  for (const part of allParts) {
    result = (result << 16n) | BigInt(parseInt(part || '0', 16) || 0);
  }
  return result;
}

function ipv6InCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/');
  const bits = BigInt(Number(bitsStr));
  const fullMask = (1n << 128n) - 1n;
  const mask = bits === 0n ? 0n : (fullMask << (128n - bits)) & fullMask;
  return (ipv6ToBigInt(ip) & mask) === (ipv6ToBigInt(range) & mask);
}

// Inclui o bloqueio geral de qualquer endereco IPv4-mapeado em IPv6
// (::ffff:0:0/96) — um jeito conhecido de tentar contornar um checador que
// so olha faixas IPv4 (ex: ::ffff:127.0.0.1 seria loopback disfarcado).
const BLOCKED_IPV6_CIDRS = [
  '::1/128',
  '::/128',
  '::ffff:0:0/96',
  '64:ff9b::/96',
  '100::/64',
  '2001:db8::/32',
  'fc00::/7',
  'fe80::/10',
  'ff00::/8',
];

export function isBlockedIpv6(ip: string): boolean {
  return BLOCKED_IPV6_CIDRS.some(cidr => ipv6InCidr(ip, cidr));
}

export function isBlockedIp(ip: string): boolean {
  return ip.includes(':') ? isBlockedIpv6(ip) : isBlockedIpv4(ip);
}

// Resolve TODOS os enderecos A/AAAA (nunca so o primeiro — um resolver
// malicioso pode devolver um IP publico primeiro e um interno depois) e
// rejeita se qualquer um deles cair numa faixa bloqueada. Retorna um IP
// valido pra fixar o Chromium nele via --host-resolver-rules.
async function resolveAndValidateHost(hostname: string): Promise<string> {
  const addrs: string[] = [];
  try { addrs.push(...await dns.resolve4(hostname)); } catch { /* sem registros A, ok se tiver AAAA */ }
  try { addrs.push(...await dns.resolve6(hostname)); } catch { /* sem registros AAAA, ok se tiver A */ }
  if (addrs.length === 0) throw new Error(`Nao foi possivel resolver o host: ${hostname}`);

  for (const ip of addrs) {
    if (isBlockedIp(ip)) throw new Error(`IP fora de faixa publica bloqueado: ${ip}`);
  }
  return addrs[0];
}

// ─── Validacao/normalizacao da URL ────────────────────────────────────────────

function validateAndNormalizeUrl(raw: string): URL {
  const url = new URL(raw.trim());
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Protocolo nao permitido: ${url.protocol}`);
  }
  // Remove credenciais embutidas (http://user:pass@host/...)
  url.username = '';
  url.password = '';
  return url;
}

// ─── Extracao de texto + defesa contra prompt injection ───────────────────────

function sanitizeExtractedText(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/ignore\s+(all\s+|previous\s+|prior\s+|above\s+)*instructions?/gi, '[trecho removido]')
    .replace(/system\s+prompt/gi, '[trecho removido]')
    .replace(/you\s+are\s+now/gi, '[trecho removido]')
    .slice(0, MAX_TEXT_LENGTH);
}

// Heuristica local, aproximada — so um rotulo auxiliar guardado junto do
// resumo. O julgamento de verdade acontece quando a IA le o texto extraido
// na proxima mensagem da conversa (ver ai-provider.service.ts).
function inferIcpSignal(text: string): 'fits' | 'unclear' | 'does_not_fit' {
  const t = text.toLowerCase();
  const positive = /(concession[aá]ria|revenda de ve[ií]culos|multimarcas|seminovos|montadora|showroom|estoque de ve[ií]culos)/;
  const negative = /(ag[eê]ncia de marketing|marketing digital|consultoria empresarial|desenvolvimento de software|ag[eê]ncia digital)/;
  if (negative.test(t) && !positive.test(t)) return 'does_not_fit';
  if (positive.test(t)) return 'fits';
  return 'unclear';
}

// ─── Busca da pagina (Chromium isolado por checagem) ──────────────────────────

async function fetchAndSummarizeSite(rawUrl: string): Promise<{ summary: string; icpSignal: 'fits' | 'unclear' | 'does_not_fit' }> {
  const url = validateAndNormalizeUrl(rawUrl);
  const validatedIp = await withTimeout(resolveAndValidateHost(url.hostname), DNS_TIMEOUT_MS, 'resolucao DNS');

  // Um processo de Chromium por checagem (nao um Browser compartilhado de
  // vida longa) — --host-resolver-rules e uma flag de lancamento do
  // processo, e cada checagem precisa fixar um hostname diferente num IP
  // diferente. A regra extra "MAP * 0.0.0.0" e defesa em profundidade: se
  // por algum motivo uma requisicao pra outro host escapar do bloqueio via
  // route() abaixo, ela cai num IP nulo em vez de vazar pra algum lugar real.
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      `--host-resolver-rules=MAP ${url.hostname} ${validatedIp},MAP * 0.0.0.0`,
    ],
  });

  try {
    const context = await browser.newContext({
      acceptDownloads: false,
      userAgent: 'Mozilla/5.0 (compatible; AutoForceLeadCheck/1.0; +https://autoforce.com)',
    });

    const page = await context.newPage();
    // Bloqueia popups/novas abas abertas pela propria pagina — o evento
    // 'page' dispara pra TODA pagina criada no contexto, entao precisa
    // ignorar a propria pagina principal (senao ela se fecha sozinha).
    context.on('page', p => { if (p !== page) p.close().catch(() => {}); });

    // Unica regra de rede: so deixa passar requisicoes http(s) pro MESMO
    // hostname ja validado — cobre de uma vez redirecionamento pra outro
    // dominio e sub-recursos (imagem/script/xhr) que a propria pagina tente
    // buscar de outro host. Qualquer coisa fora disso e abortada antes de
    // qualquer conexao de rede acontecer.
    await context.route('**/*', route => {
      let reqUrl: URL;
      try {
        reqUrl = new URL(route.request().url());
      } catch {
        return route.abort();
      }
      if (reqUrl.protocol !== 'http:' && reqUrl.protocol !== 'https:') return route.abort();
      if (reqUrl.hostname.toLowerCase() !== url.hostname.toLowerCase()) return route.abort();
      return route.continue();
    });

    const response = await page.goto(url.toString(), {
      timeout: NAV_TIMEOUT_MS,
      waitUntil: 'domcontentloaded',
    });

    const contentType = response?.headers()['content-type'] ?? '';
    if (contentType && !contentType.toLowerCase().includes('text/html')) {
      throw new Error(`Conteudo nao e HTML (content-type: ${contentType})`);
    }

    // Roda dentro do navegador (Playwright serializa a funcao pro contexto da
    // pagina) — `document` so existe la, nao no Node; cast evita precisar da
    // lib "dom" no tsconfig deste projeto backend.
    const rawText = await page.evaluate(() => (globalThis as any).document?.body?.innerText ?? '');
    const summary = sanitizeExtractedText(rawText);
    const icpSignal = inferIcpSignal(summary);
    return { summary, icpSignal };
  } finally {
    await browser.close().catch(() => {});
  }
}

// ─── Entrada principal ─────────────────────────────────────────────────────────

export async function verifyLeadWebsite(leadEmailRaw: string): Promise<void> {
  const email = normalizeEmail(leadEmailRaw);

  if (inFlightChecks >= MAX_CONCURRENT_CHECKS) {
    console.log(`[SiteCheck] limite de checagens simultaneas atingido — ${email} fica pra proxima varredura`);
    return;
  }

  const now = new Date();
  // Lock atomico (UPDATE...WHERE, nao ler-depois-escrever) — cobre o caso
  // raro de duas mensagens seguidas do lead corrigindo a URL enquanto a
  // primeira checagem ainda roda.
  const acquired = await prisma.lead.updateMany({
    where: {
      email,
      OR: [
        { siteCheckInProgress: false },
        { siteCheckStartedAt: { lt: new Date(now.getTime() - LOCK_TTL_MS) } },
      ],
    },
    data: { siteCheckInProgress: true, siteCheckStartedAt: now },
  });
  if (acquired.count === 0) {
    console.log(`[SiteCheck] checagem ja em andamento pra ${email} — pulando`);
    return;
  }

  inFlightChecks++;
  try {
    const lead = await prisma.lead.findUnique({ where: { email }, select: { siteUrl: true } });
    const siteUrl = lead?.siteUrl;
    if (!siteUrl) return;

    try {
      const { summary, icpSignal } = await withTimeout(
        fetchAndSummarizeSite(siteUrl),
        OVERALL_TIMEOUT_MS,
        `verificacao de site (${email})`
      );
      await prisma.lead.update({
        where: { email },
        data: {
          siteCheckedAt: new Date(),
          siteVerificationSummary: summary,
          siteIcpSignal: icpSignal,
        },
      });
      console.log(`[SiteCheck] ${email} — site verificado (icpSignal=${icpSignal})`);
    } catch (err) {
      await prisma.lead.update({
        where: { email },
        data: {
          siteCheckedAt: new Date(),
          siteCheckAttempts: { increment: 1 },
        },
      }).catch(() => {});
      console.error(`[SiteCheck] falha ao verificar site de ${email} (${siteUrl}):`, err instanceof Error ? err.message : err);
    }
  } finally {
    inFlightChecks--;
    await prisma.lead
      .update({ where: { email }, data: { siteCheckInProgress: false } })
      .catch(() => {});
  }
}

// ─── Varredura periodica (rede de seguranca pra falhas transitorias) ──────────
// Sem biblioteca de fila neste backend — mesmo padrao de disparo direto +
// varredura periodica ja usado pro follow-up automatico (ver
// sync-scheduler.service.ts / ai-followup.service.ts). Backoff simples por
// numero de tentativas em vez de retentar a cada tick.
const BACKOFF_MS_BY_ATTEMPT: Record<number, number> = {
  0: 0,
  1: 5 * 60 * 1000,
  2: 30 * 60 * 1000,
};

export async function sweepUnverifiedSites(limit = 20): Promise<{ checked: number }> {
  const candidates = await prisma.lead.findMany({
    where: {
      siteUrl: { not: null },
      siteVerificationSummary: null,
      siteCheckAttempts: { lt: MAX_SITE_CHECK_ATTEMPTS },
      siteCheckInProgress: false,
    },
    select: { email: true, siteCheckAttempts: true, siteCheckedAt: true },
    take: limit * 3,
    orderBy: { siteCheckedAt: 'asc' },
  });

  const now = Date.now();
  const eligible = candidates
    .filter(c => {
      if (!c.siteCheckedAt) return true;
      const delay = BACKOFF_MS_BY_ATTEMPT[c.siteCheckAttempts] ?? 2 * 60 * 60 * 1000;
      return now - c.siteCheckedAt.getTime() >= delay;
    })
    .slice(0, limit);

  let checked = 0;
  for (const lead of eligible) {
    await verifyLeadWebsite(lead.email);
    checked++;
  }
  return { checked };
}
