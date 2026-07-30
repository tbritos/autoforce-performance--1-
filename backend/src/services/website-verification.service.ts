import dns from 'dns/promises';
import { chromium } from 'playwright';

// Utilitario reaproveitavel: visita uma URL controlada por um usuario
// externo com um navegador de verdade (Playwright/Chromium) e devolve o
// texto extraido, com defesa em profundidade contra SSRF (a primeira vez
// que este backend busca uma URL fornecida por fora — todo outro fetch()
// do sistema aponta pra hosts fixos de API ou env vars configuradas por um
// operador). Consumido por lead-research.service.ts (pesquisa de
// informacao — descoberta/verificacao de site do lead); a orquestracao
// (quando chamar, onde salvar o resultado, decisao de fit) vive la, nao
// aqui — este arquivo so garante que a busca em si e segura.

const NAV_TIMEOUT_MS = 18_000;
const DNS_TIMEOUT_MS = 5_000;
export const OVERALL_SITE_FETCH_TIMEOUT_MS = 35_000;
const MAX_TEXT_LENGTH = 1800;

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
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

export function validateAndNormalizeUrl(raw: string): URL {
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

// ─── Busca da pagina (Chromium isolado por checagem) ──────────────────────────

// Retorna so o texto extraido e sanitizado — a decisao de fit/ICP a partir
// desse texto e sempre feita pela IA (ver assessResearchFit em
// lead-research.service.ts), nao por uma heuristica local aqui, pra nao ter
// duas logicas de julgamento de ICP divergentes no sistema.
export async function fetchAndSummarizeSite(rawUrl: string, signal?: AbortSignal): Promise<{ summary: string }> {
  if (signal?.aborted) throw new Error('Visita de site cancelada');
  const url = validateAndNormalizeUrl(rawUrl);
  const validatedIp = await withTimeout(resolveAndValidateHost(url.hostname), DNS_TIMEOUT_MS, 'resolucao DNS');
  if (signal?.aborted) throw new Error('Visita de site cancelada');

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

  const abortVisit = () => { void browser.close().catch(() => {}); };
  signal?.addEventListener('abort', abortVisit, { once: true });
  try {
    if (signal?.aborted) throw new Error('Visita de site cancelada');
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
    return { summary };
  } finally {
    signal?.removeEventListener('abort', abortVisit);
    await browser.close().catch(() => {});
  }
}
