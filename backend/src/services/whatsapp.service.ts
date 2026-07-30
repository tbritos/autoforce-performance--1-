import { PlatformConnectionService } from './platform-connection.service';
import { Platform } from '@prisma/client';
import { prisma } from '../config/database';
import { normalizePhoneE164, phoneSearchVariants } from '../utils/phone';

export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: string;
  text?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: WhatsAppTemplateComponent[];
}

async function getWhatsAppCredentials(): Promise<{ accessToken: string; businessAccountId: string }> {
  const envToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const envAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  if (envToken && envAccountId) {
    return { accessToken: envToken, businessAccountId: envAccountId };
  }

  const conn = await PlatformConnectionService.getInternalConnection('WHATSAPP' as Platform);
  const accessToken = conn?.accessToken?.trim();
  const meta = (conn?.metadata ?? {}) as Record<string, unknown>;
  const businessAccountId = (meta.businessAccountId as string | undefined)?.trim();

  if (!accessToken || !businessAccountId) {
    throw new Error('WhatsApp não configurado. Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID no Railway.');
  }

  return { accessToken, businessAccountId };
}

// FIX: Meta Graph API IDs are always numeric — validate to prevent path injection
function validateGraphId(id: string, fieldName: string): void {
  if (!/^\d+$/.test(id)) {
    throw new Error(`${fieldName} inválido: deve ser numérico (ex: 123456789012345)`);
  }
}

async function metaGet<T>(url: string, accessToken: string): Promise<T> {
  // FIX: token in Authorization header, NOT in URL query string
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as T & { error?: { message: string } };
  if ((data as { error?: { message: string } }).error) {
    throw new Error((data as { error: { message: string } }).error.message);
  }
  return data;
}

export interface WhatsAppPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
}

export interface WhatsAppConversationMessage {
  id: string;
  leadId: string | null;
  leadEmail: string | null;
  phone: string;
  direction: string;
  type: string;
  status: string;
  messageId: string | null;
  repliedToMessageId: string | null;
  automationJourneyId: string | null;
  automationExecutionId: string | null;
  templateName: string | null;
  text: string | null;
  payload: unknown;
  phoneNumberId: string | null;
  phoneNumberLabel: string | null;
  phoneNumberDisplay: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  receivedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
}

function normalizePhone(phone: string | null | undefined): string {
  return normalizePhoneE164(String(phone ?? '')) ?? String(phone ?? '').replace(/\D/g, '');
}

function metaTimestamp(seconds: string | number | undefined): Date {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date();
}

async function findLeadByPhone(phone: string) {
  const candidates = phoneSearchVariants(phone);

  for (const value of candidates) {
    const lead = await prisma.lead.findFirst({
      where: { phone: { contains: value } },
      select: { id: true, email: true, phone: true, name: true, whatsappInvalidAt: true },
    });
    if (lead) return lead;
  }

  return null;
}

// Codigos da Meta que so ocorrem quando o proprio numero esta com problema
// (nunca por rate limit, token expirado, indisponibilidade momentanea etc.)
// — nesses casos tentar de novo mais tarde nunca vai funcionar, entao para o
// follow-up automatico e avisa o time em vez de continuar gastando template.
const PERMANENT_WHATSAPP_ERROR_CODES = new Set<number>([
  133010, // conta/numero nao registrado no WhatsApp
  131021, // destinatario nao pode ser o remetente (numero mal configurado/invalido)
]);

// Fallback por texto — a Meta as vezes muda o codigo usado pro mesmo motivo
// (ex: 131026 "Message Undeliverable" e documentado como multi-causa, entao
// so o codigo nao basta; mas quando o texto e explicito sobre o numero nao
// existir no WhatsApp, e seguro classificar como permanente mesmo assim).
const PERMANENT_WHATSAPP_ERROR_TEXT_PATTERNS: RegExp[] = [
  /not a whatsapp user/i,
  /not registered on whatsapp/i,
  /n[aã]o\s+[eé]\s+(um\s+)?usu[aá]rio\s+(do|de)\s+whatsapp/i,
  /n[uú]mero\s+(de\s+)?whatsapp\s+inv[aá]lido/i,
  /invalid\s+whatsapp\s+number/i,
  /recipient\s+phone\s+number\s+is\s+not\s+a?\s*valid/i,
  /invalid.*wa_id|wa_id.*invalid/i,
];

export interface WhatsAppErrorClassification {
  classification: 'permanent' | 'transient';
  reason: string;
}

// Decide se uma falha de envio deve parar o follow-up automatico pra esse
// lead (permanent) ou se e so uma instabilidade passageira que deve
// continuar tentando no proximo ciclo (transient) — ver
// ai-followup.service.ts. Por padrao (codigo desconhecido, sem match de
// texto) classifica como transient: e mais seguro nao desistir de um lead
// bom por engano do que continuar tentando por mais algumas rodadas um lead
// realmente com numero invalido.
export function classifyWhatsAppError(
  error: { code?: number | null; message?: string | null; error_data?: { details?: string | null } | null } | null | undefined
): WhatsAppErrorClassification | null {
  if (!error) return null;
  const code = typeof error.code === 'number' ? error.code : null;
  const text = [error.message, error.error_data?.details].filter(Boolean).join(' — ');

  if (code !== null && PERMANENT_WHATSAPP_ERROR_CODES.has(code)) {
    return { classification: 'permanent', reason: text || `Erro ${code} da Meta` };
  }
  if (PERMANENT_WHATSAPP_ERROR_TEXT_PATTERNS.some(re => re.test(text))) {
    return { classification: 'permanent', reason: text || 'Número inválido no WhatsApp' };
  }
  return { classification: 'transient', reason: text || (code !== null ? `Erro ${code} da Meta` : 'Falha no envio') };
}

export async function fetchWhatsAppPhoneNumbers(): Promise<WhatsAppPhoneNumber[]> {
  const { accessToken } = await getWhatsAppCredentials();
  const wabaIds = await getAllWabaIds();

  const perWaba = await Promise.all(wabaIds.map(async wabaId => {
    try {
      const url = `https://graph.facebook.com/v19.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`;
      const data = await metaGet<{ data?: WhatsAppPhoneNumber[] }>(url, accessToken);
      return data.data ?? [];
    } catch (err) {
      console.error(`[WPP] erro ao listar números da WABA ${wabaId}:`, err instanceof Error ? err.message : err);
      return [];
    }
  }));

  return perWaba.flat();
}

// Busca um numero diretamente pelo phoneNumberId — funciona pra qualquer WABA
// que o token tenha permissao, mesmo que essa WABA nao esteja em
// WHATSAPP_BUSINESS_ACCOUNT_IDS (nao precisa enumerar WABA por WABA).
export async function fetchWhatsAppPhoneNumberById(phoneNumberId: string): Promise<WhatsAppPhoneNumber> {
  validateGraphId(phoneNumberId, 'phoneNumberId');
  const { accessToken } = await getWhatsAppCredentials();
  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`;
  return metaGet<WhatsAppPhoneNumber>(url, accessToken);
}

// ── Diretorio de rotulos amigaveis por numero (WhatsAppNumber) ─────────────
// Nao duplica dados da Meta — so guarda o "nome" que o time da pra cada
// numero (ex: "Comercial", "Campanha X"). O numero padrao/fallback continua
// sendo a env var WHATSAPP_PHONE_NUMBER_ID.

export interface WhatsAppNumberEntry {
  id: string;
  phoneNumberId: string;
  label: string;
  displayPhoneNumber: string | null;
  wabaId: string | null;
}

export async function listRegisteredWhatsAppNumbers(): Promise<WhatsAppNumberEntry[]> {
  return (prisma as any).whatsAppNumber.findMany({ orderBy: { createdAt: 'asc' } });
}

export async function registerWhatsAppNumber(input: { phoneNumberId: string; label: string; wabaId?: string }): Promise<WhatsAppNumberEntry> {
  const phoneNumberId = input.phoneNumberId.trim();
  const label = input.label.trim();
  const wabaId = input.wabaId?.trim() || null;
  if (!phoneNumberId) throw new Error('phoneNumberId é obrigatório');
  if (!label) throw new Error('Rótulo é obrigatório');

  // Validacao direta pelo ID — funciona mesmo se o numero estiver numa WABA
  // diferente da principal, desde que o token tenha permissao nela.
  let match: WhatsAppPhoneNumber;
  try {
    match = await fetchWhatsAppPhoneNumberById(phoneNumberId);
  } catch (err) {
    throw new Error(`Não foi possível validar esse número na Meta: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
  }

  return (prisma as any).whatsAppNumber.upsert({
    where: { phoneNumberId },
    create: { phoneNumberId, label, displayPhoneNumber: match.display_phone_number, wabaId },
    update: { label, displayPhoneNumber: match.display_phone_number, ...(wabaId ? { wabaId } : {}) },
  });
}

async function buildPhoneNumberLabelMap(): Promise<Map<string, WhatsAppNumberEntry>> {
  const entries = await listRegisteredWhatsAppNumbers();
  return new Map(entries.map(e => [e.phoneNumberId, e]));
}

// WABA de um numero: primeiro confia no que foi cadastrado manualmente
// (100% confiavel), so tenta adivinhar via Graph API como ultimo recurso.
async function resolveRegisteredWabaId(phoneNumberId: string): Promise<string | null> {
  const entry = await (prisma as any).whatsAppNumber.findUnique({ where: { phoneNumberId }, select: { wabaId: true } });
  return entry?.wabaId ?? null;
}

// Resolve por qual numero da Meta uma resposta (manual ou da IA) deve ser
// enviada: o numero que recebeu a MENSAGEM MAIS RECENTE desse lead, senao o
// numero padrao (env var). So vale pra resposta manual/IA — disparos de
// automação usam o phoneNumberId explicito configurado no bloco da jornada.
export async function resolveDefaultPhoneNumberIdForLead(phone: string): Promise<string> {
  const normalized = normalizePhone(phone);

  const last = await (prisma as any).whatsAppMessage.findFirst({
    where: {
      direction: 'inbound',
      phoneNumberId: { not: null },
      OR: phoneSearchVariants(normalized).map(v => ({ phone: { endsWith: v } })),
    },
    orderBy: { createdAt: 'desc' },
    select: { phoneNumberId: true },
  });

  const resolved = last?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!resolved) throw new Error('WHATSAPP_PHONE_NUMBER_ID não configurado e nenhuma mensagem anterior encontrada para esse lead');
  return resolved;
}

// ── Variavel de template: posicional ({{1}}) ou nomeada ({{nome}}) ────────
// A Meta so permite um formato por template (nunca misturado), mas tratamos
// cada chave de varMappings por si — usado tanto por jornadas de automacao
// quanto por disparo avulso, pra nao duplicar essa regra pela terceira vez.

export interface TemplateBodyParam {
  type: 'text';
  text: string;
  parameter_name?: string;
}

// Placeholders distintos usados no HEADER/BODY de um template (ex: ["{{1}}"]
// ou ["{{nome}}"]) — usado pra validar no servidor se todas as variaveis do
// template escolhido tem mapeamento antes de deixar disparar em massa.
export function extractTemplateVars(components: WhatsAppTemplateComponent[]): string[] {
  const vars: string[] = [];
  for (const comp of components) {
    if ((comp.type === 'HEADER' || comp.type === 'BODY') && comp.text) {
      const matches = comp.text.match(/\{\{[^}]+\}\}/g) ?? [];
      vars.push(...matches);
    }
  }
  return [...new Set(vars)];
}

// varMappings: { "{{1}}": "name", ... } ou { "{{nome}}": "name", ... } — a
// chave e o placeholder literal do template, o valor e a chave de fieldValues.
//
// IMPORTANTE: a Meta trata HEADER e BODY como componentes separados, cada um
// com seu proprio array de parameters — mesmo que os dois usem o mesmo texto
// de placeholder (ex: "{{1}}" no header E no body). Por isso essa funcao
// recebe o texto de UM componente por vez (chame uma vez pro header e outra
// pro body) — nunca junte os dois num so array, senao a Meta responde
// "(#132000) Number of parameters does not match the expected number of params".
export function buildComponentParams(
  componentText: string | null | undefined,
  varMappings: Record<string, string>,
  fieldValues: Record<string, string>
): TemplateBodyParam[] {
  if (!componentText) return [];
  const vars = [...new Set(componentText.match(/\{\{[^}]+\}\}/g) ?? [])];
  return vars
    .sort((a, b) => {
      const idxA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const idxB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return idxA - idxB;
    })
    .map(placeholder => {
      const field = varMappings[placeholder];
      const name = placeholder.replace(/[{}]/g, '');
      const text = field ? (fieldValues[field] ?? '') : '';
      return /^\d+$/.test(name) ? { type: 'text', text } : { type: 'text', parameter_name: name, text };
    });
}

// Substitui as variaveis no texto do BODY do template pelos valores reais —
// usado so pra salvar/exibir na nossa conversa, nao afeta o envio de verdade
// (que a Meta resolve a partir de buildTemplateParams).
export function resolveTemplateBodyText(
  bodyText: string,
  varMappings: Record<string, string>,
  fieldValues: Record<string, string>
): string {
  return bodyText.replace(/\{\{[^}]+\}\}/g, (placeholder: string) => {
    const field = varMappings[placeholder];
    return field ? (fieldValues[field] ?? placeholder) : placeholder;
  });
}

// Numeros de telefone da Meta podem estar espalhados em mais de uma WABA (ex:
// contas Meta Business separadas dentro do mesmo Business Manager). A WABA
// "principal" continua em WHATSAPP_BUSINESS_ACCOUNT_ID; WABAs adicionais vao
// em WHATSAPP_BUSINESS_ACCOUNT_IDS (separadas por virgula, incluindo a principal).
async function getAllWabaIds(): Promise<string[]> {
  const multi = process.env.WHATSAPP_BUSINESS_ACCOUNT_IDS?.trim();
  if (multi) {
    const ids = multi.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length > 0) return ids;
  }
  const { businessAccountId } = await getWhatsAppCredentials();
  return [businessAccountId];
}

// Dado um phoneNumberId, descobre a qual WABA ele pertence (numeros podem
// estar em WABAs diferentes da principal). Sem phoneNumberId, usa a WABA
// principal (WHATSAPP_BUSINESS_ACCOUNT_ID).
async function resolveWabaId(accessToken: string, defaultWabaId: string, phoneNumberId?: string): Promise<string> {
  if (!phoneNumberId) return defaultWabaId;

  // 1) Confia primeiro no que foi cadastrado manualmente (100% confiavel).
  const registeredWabaId = await resolveRegisteredWabaId(phoneNumberId);
  if (registeredWabaId) return registeredWabaId;

  // 2) Best-effort via Graph API (nao confiavel pra todo caso — mantido so
  // como fallback pra numeros ainda nao cadastrados com wabaId explicito).
  validateGraphId(phoneNumberId, 'phoneNumberId');
  try {
    const infoUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}?fields=whatsapp_business_account`;
    const info = await metaGet<{ whatsapp_business_account?: { id: string } }>(infoUrl, accessToken);
    return info.whatsapp_business_account?.id ?? defaultWabaId;
  } catch {
    return defaultWabaId;
  }
}

// Fetch templates — if phoneNumberId is provided, find its WABA first so we get
// templates scoped to that specific number's Business Account.
export async function fetchWhatsAppTemplates(phoneNumberId?: string): Promise<WhatsAppTemplate[]> {
  const { accessToken, businessAccountId } = await getWhatsAppCredentials();
  const wabaId = await resolveWabaId(accessToken, businessAccountId, phoneNumberId);

  const url = `https://graph.facebook.com/v19.0/${wabaId}/message_templates?limit=100&fields=id,name,status,category,language,components`;
  const data = await metaGet<{ data?: WhatsAppTemplate[] }>(url, accessToken);
  return data.data ?? [];
}

export async function listWhatsAppConversationByLead(leadId: string): Promise<WhatsAppConversationMessage[]> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, email: true, phone: true },
  });
  if (!lead) throw new Error('Lead não encontrado');

  const where: Record<string, unknown>[] = [{ leadId: lead.id }, { leadEmail: lead.email }];

  if (lead.phone) {
    const variants = phoneSearchVariants(lead.phone);
    variants.forEach(v => where.push({ phone: { endsWith: v } }));
  }

  // orderBy 'asc' + take pegaria as 300 mensagens MAIS ANTIGAS (mesmo bug corrigido
  // em outros pontos do agente de IA): numa conversa com mais de 300 mensagens, o
  // SDR veria so o inicio da conversa na tela, sem nenhuma mensagem recente.
  const recent = await (prisma as any).whatsAppMessage.findMany({
    where: { OR: where },
    orderBy: [{ createdAt: 'desc' }],
    take: 300,
  });

  const labelMap = await buildPhoneNumberLabelMap();
  // Mensagens de antes de existir mais de um numero nao tem phoneNumberId
  // gravado (null) — tratamos como sendo do numero padrao (env var), que e
  // exatamente a mesma suposicao que resolveDefaultPhoneNumberIdForLead ja
  // faz pra decidir por onde responder. Sem isso, a mesma conversa aparecia
  // dividida em "numero padrao" e o numero de verdade (ex: "Lara").
  const defaultPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null;
  const enriched = recent.map((msg: any) => {
    const phoneNumberId = msg.phoneNumberId ?? defaultPhoneNumberId;
    const entry = phoneNumberId ? labelMap.get(phoneNumberId) : undefined;
    return {
      ...msg,
      phoneNumberId,
      phoneNumberLabel: entry?.label ?? null,
      phoneNumberDisplay: entry?.displayPhoneNumber ?? null,
    };
  });

  return enriched.reverse();
}

export async function recordOutgoingWhatsAppMessage(input: {
  leadEmail: string | null;
  phone: string;
  messageId?: string | null;
  templateName?: string | null;
  text?: string | null;
  payload?: unknown;
  automationJourneyId?: string | null;
  automationExecutionId?: string | null;
  phoneNumberId?: string | null;
  whatsAppBlastId?: string | null;
  status?: 'sent' | 'failed';
}): Promise<void> {
  let lead = input.leadEmail
    ? await prisma.lead.findUnique({ where: { email: input.leadEmail }, select: { id: true, email: true, whatsappInvalidAt: true } })
    : null;

  // leadEmail vem null de proposito pra leads com email gerado
  // (wpp_...@autoforce.internal) — nao deve aparecer em nada voltado ao
  // usuario. Mas isso nao pode significar leadId nulo: sem leadId, essa
  // mensagem fica invisivel pra consulta de elegibilidade de follow-up
  // (WHERE "leadId" IS NOT NULL, ver ai-followup.service.ts), e esse lead
  // nunca mais recebe follow-up automatico. Resolve por telefone nesse caso
  // — o leadEmail gravado continua null, so o leadId passa a ser correto.
  if (!lead && input.phone) {
    lead = await findLeadByPhone(input.phone);
  }

  const status = input.status ?? 'sent';

  // Extrai o erro real da Meta pra classificar (ver classifyWhatsAppError
  // acima) — payload chega como { request, error } no caminho sincrono
  // (sendWhatsAppText, disparos avulsos) quando falha, ou como uma string
  // crua quando o proprio fetch lancou excecao (sem resposta HTTP nenhuma).
  let errorCode: number | null = null;
  let errorTitle: string | null = null;
  let errorMessage: string | null = null;
  if (status === 'failed') {
    const raw = (input.payload as { error?: unknown } | null)?.error;
    if (typeof raw === 'string') {
      errorMessage = raw;
    } else if (raw && typeof raw === 'object') {
      const e = raw as { code?: number; message?: string; title?: string; error_data?: { details?: string } };
      errorCode = typeof e.code === 'number' ? e.code : null;
      errorTitle = e.title ?? null;
      errorMessage = e.message ?? e.error_data?.details ?? null;
    }
  }

  const data = {
    leadId: lead?.id ?? null,
    // So usa o email resolvido quando a busca partiu de um leadEmail de
    // verdade — no fallback por telefone (leadEmail veio null de proposito),
    // mantem null, sem vazar o email gerado.
    leadEmail: (input.leadEmail ? lead?.email : null) ?? input.leadEmail ?? null,
    phone: normalizePhone(input.phone),
    direction: 'outbound',
    type: input.templateName ? 'template' : 'text',
    status,
    messageId: input.messageId ?? null,
    templateName: input.templateName ?? null,
    text: input.text ?? null,
    payload: input.payload ?? {},
    errorCode,
    errorTitle,
    errorMessage,
    automationJourneyId: input.automationJourneyId ?? null,
    automationExecutionId: input.automationExecutionId ?? null,
    phoneNumberId: input.phoneNumberId ?? null,
    whatsAppBlastId: input.whatsAppBlastId ?? null,
    sentAt: status === 'sent' ? new Date() : null,
    failedAt: status === 'failed' ? new Date() : null,
  };

  if (data.messageId) {
    await (prisma as any).whatsAppMessage.upsert({
      where: { messageId: data.messageId },
      create: data,
      update: data,
    });
  } else {
    await (prisma as any).whatsAppMessage.create({ data });
  }

  await applyWhatsAppFailureClassification(lead, status, { code: errorCode, message: errorMessage });
}

// Aplica o resultado de classifyWhatsAppError ao Lead — usado tanto pro
// envio sincrono (aqui) quanto pro webhook de status assincrono
// (recordStatus, mais abaixo). So escreve quando ha uma transicao real de
// estado: marca em falha permanente nova, ou limpa quando um envio
// realmente sai (autocurativo — nunca um veto de verdade).
async function applyWhatsAppFailureClassification(
  lead: { id: string; whatsappInvalidAt: Date | null } | null,
  status: string,
  error: { code: number | null; message: string | null }
): Promise<void> {
  if (!lead?.id) return;

  if (status === 'failed') {
    const verdict = classifyWhatsAppError(error);
    if (verdict?.classification === 'permanent') {
      await prisma.lead
        .update({
          where: { id: lead.id },
          data: { whatsappInvalidAt: new Date(), whatsappInvalidReason: verdict.reason.slice(0, 500) },
        })
        .catch(() => {});
    }
  } else if (lead.whatsappInvalidAt) {
    await prisma.lead
      .update({ where: { id: lead.id }, data: { whatsappInvalidAt: null, whatsappInvalidReason: null } })
      .catch(() => {});
  }
}

function extractInboundText(message: any): { type: string; text: string | null } {
  if (message.type === 'text') return { type: 'text', text: message.text?.body ?? null };
  if (message.type === 'button') return { type: 'button', text: message.button?.text ?? message.button?.payload ?? null };
  if (message.type === 'interactive') {
    return {
      type: 'interactive',
      text: message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? null,
    };
  }
  return { type: String(message.type ?? 'unknown'), text: null };
}

// Confere se `phoneNumberId` (o numero da Meta que RECEBEU a mensagem) e o
// numero configurado pro agente de IA — evita que o agente responda a
// mensagens recebidas em outros numeros (ex: respostas a disparos em massa
// feitos de um numero diferente). Sem nada configurado em lugar nenhum, nao
// bloqueia (mantem o comportamento anterior a essa checagem).
async function isAgentPhoneNumber(phoneNumberId: string | null): Promise<boolean> {
  const agent = await (prisma as any).aIAgent.findFirst({ where: { isActive: true }, select: { whatsappPhoneNumberId: true } });
  const expected = agent?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || null;
  if (!expected) return true;
  return phoneNumberId === expected;
}

async function recordInboundMessage(message: any, senderName: string | null, phoneNumberId: string | null): Promise<void> {
  const from = normalizePhone(message.from);
  if (!from) return;

  let lead = await findLeadByPhone(from);

  // Auto-create a placeholder lead for unknown numbers
  if (!lead) {
    const toE164 = from.startsWith('55') ? from : `55${from}`;
    const generatedEmail = `wpp_${toE164}@autoforce.internal`;
    lead = await prisma.lead.upsert({
      where: { email: generatedEmail },
      create: {
        email: generatedEmail,
        phone: toE164,
        name: senderName ?? null,
        tags: ['whatsapp_inbound'],
      },
      update: {
        // Fill in name if it was missing and now we have it
        ...(senderName ? { name: senderName } : {}),
      },
      select: { id: true, email: true, phone: true, name: true, whatsappInvalidAt: true },
    });
    const { LeadScoringService } = await import('./lead-scoring.service');
    await LeadScoringService.applyScoringRulesToLead(lead.id).catch(err => {
      console.error('[LeadScoring] falha ao aplicar regras no lead criado via WhatsApp:', err);
    });
    const { triggerLeadResearch } = await import('./lead-research.service');
    await triggerLeadResearch(lead.id).catch(err => {
      console.error('[LeadResearch] falha ao disparar pesquisa no lead criado via WhatsApp:', err);
    });
  } else if (senderName && !lead.name) {
    // Update name on existing lead if it was blank
    await prisma.lead.update({
      where: { id: lead.id },
      data: { name: senderName },
    });
  }

  if (!lead) return;

  // Qualquer mensagem do lead reseta o contador de follow-up automatico —
  // ver ai-followup.service.ts.
  // Mensagem recebida = prova definitiva de que o numero funciona — limpa
  // qualquer marcacao anterior de falha permanente (autocurativo).
  await prisma.lead
    .update({ where: { id: lead.id }, data: { followUpCount: 0, whatsappInvalidAt: null, whatsappInvalidReason: null } })
    .catch(() => {});

  const { type, text } = extractInboundText(message);
  const receivedAt = metaTimestamp(message.timestamp);

  await (prisma as any).whatsAppMessage.upsert({
    where: { messageId: String(message.id) },
    create: {
      leadId: lead.id,
      leadEmail: lead.email,
      phone: from,
      direction: 'inbound',
      type,
      status: 'received',
      messageId: String(message.id),
      repliedToMessageId: message.context?.id ?? null,
      text,
      payload: message,
      phoneNumberId,
      receivedAt,
      createdAt: receivedAt,
    },
    update: {
      leadId: lead.id,
      leadEmail: lead.email,
      phone: from,
      direction: 'inbound',
      type,
      status: 'received',
      repliedToMessageId: message.context?.id ?? null,
      text,
      payload: message,
      phoneNumberId,
      receivedAt,
    },
  });

  if (await isAgentPhoneNumber(phoneNumberId)) {
    const { scheduleAIReply } = await import('./ai-whatsapp-reply.service');
    scheduleAIReply(from);
    console.log(`[WPP] inbound message recorded; AI reply scheduled phone=${from} lead=${lead.email} type=${type}`);
  } else {
    console.log(`[WPP] inbound message on non-agent number (phoneNumberId=${phoneNumberId}); AI reply skipped phone=${from} lead=${lead.email}`);
  }

  try {
    const { resumeWaitingWhatsAppReply } = await import('./automation-engine.service');
    await resumeWaitingWhatsAppReply(lead.email, text ?? '', 'replied');
  } catch (err) {
    console.error('[WPP] waiting automation resume failed after inbound message:', err);
  }
}

async function recordStatus(status: any, phoneNumberId: string | null): Promise<void> {
  const messageId = String(status.id ?? '');
  if (!messageId) return;

  const state = String(status.status ?? 'sent');
  const at = metaTimestamp(status.timestamp);

  // Falha assincrona (webhook) — a Meta manda o motivo real em errors[0],
  // mesma info que a falha sincrona tem em payload.error (ver
  // recordOutgoingWhatsAppMessage) so que num formato de array.
  const firstError = Array.isArray(status.errors) ? status.errors[0] : null;
  const errorCode = typeof firstError?.code === 'number' ? firstError.code : null;
  const errorTitle = firstError?.title ?? null;
  const errorMessage = firstError?.message ?? firstError?.error_data?.details ?? null;

  const data: Record<string, unknown> = {
    status: state,
    payload: status,
    ...(state === 'failed' ? { errorCode, errorTitle, errorMessage } : {}),
  };
  if (state === 'sent') data.sentAt = at;
  if (state === 'delivered') data.deliveredAt = at;
  if (state === 'read') data.readAt = at;
  if (state === 'failed') data.failedAt = at;

  const updated = await (prisma as any).whatsAppMessage.updateMany({
    where: { messageId },
    data,
  });

  if (updated.count === 0) {
    await (prisma as any).whatsAppMessage.create({
      data: {
        phone: normalizePhone(status.recipient_id),
        direction: 'outbound',
        type: 'status',
        status: state,
        messageId,
        payload: status,
        phoneNumberId,
        ...data,
      },
    });
  }

  if (state === 'failed') {
    const lead = await findLeadByPhone(String(status.recipient_id ?? ''));
    await applyWhatsAppFailureClassification(lead, state, { code: errorCode, message: errorMessage });
    if (lead?.email) {
      const { resumeWaitingWhatsAppReply } = await import('./automation-engine.service');
      await resumeWaitingWhatsAppReply(lead.email, 'failed', 'failed');
    }
  } else if (state === 'delivered' || state === 'read') {
    // Confirmacao forte de que o numero funciona de verdade — limpa uma
    // marcacao de falha permanente anterior (autocurativo).
    const lead = await findLeadByPhone(String(status.recipient_id ?? ''));
    await applyWhatsAppFailureClassification(lead, state, { code: null, message: null });
  }
}

export async function handleWhatsAppWebhook(payload: any): Promise<{ messages: number; statuses: number }> {
  let messages = 0;
  let statuses = 0;

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      // Numero da Meta que recebeu/enviou essa mensagem — presente no payload
      // real da Meta, um nivel acima de `message`/`status` (por isso nunca fica
      // gravado dentro de `payload` da linha do banco, que so guarda `message`).
      const phoneNumberId = (value.metadata?.phone_number_id as string | undefined) ?? null;

      // Build wa_id → display name map from contacts array
      const nameByPhone: Record<string, string> = {};
      for (const contact of value.contacts ?? []) {
        const waId = contact?.wa_id as string | undefined;
        const name = contact?.profile?.name as string | undefined;
        if (waId && name) nameByPhone[waId] = name;
      }

      for (const message of value.messages ?? []) {
        const senderName = nameByPhone[message.from] ?? null;
        await recordInboundMessage(message, senderName, phoneNumberId);
        messages += 1;
      }
      for (const status of value.statuses ?? []) {
        await recordStatus(status, phoneNumberId);
        statuses += 1;
      }
    }
  }

  return { messages, statuses };
}

export async function sendWhatsAppTextFromUI(leadId: string, text: string, phoneNumberIdOverride?: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, email: true, phone: true },
  });
  if (!lead) throw new Error('Lead não encontrado');
  if (!lead.phone) throw new Error('Lead sem telefone cadastrado');

  const { accessToken } = await getWhatsAppCredentials();
  const phone = normalizePhone(lead.phone);
  const phoneNumberId = phoneNumberIdOverride?.trim() || await resolveDefaultPhoneNumberIdForLead(phone);

  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'text',
    text: { body: text.trim().slice(0, 4096) },
  };

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { messages?: Array<{ id?: string }>; error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `WhatsApp API error ${res.status}`);
  }

  const isGenerated = lead.email.startsWith('wpp_') && lead.email.endsWith('@autoforce.internal');
  await recordOutgoingWhatsAppMessage({
    leadEmail: isGenerated ? null : lead.email,
    phone,
    messageId: data.messages?.[0]?.id ?? null,
    text,
    payload: body,
    phoneNumberId,
  });
}

export async function sendWhatsAppTemplateFromUI(
  leadId: string,
  templateName: string,
  bodyParams: string[] = [],
  phoneNumberIdOverride?: string
): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, email: true, phone: true },
  });
  if (!lead) throw new Error('Lead não encontrado');
  if (!lead.phone) throw new Error('Lead sem telefone cadastrado');

  const { accessToken } = await getWhatsAppCredentials();
  const phone = normalizePhone(lead.phone);
  const phoneNumberId = phoneNumberIdOverride?.trim() || await resolveDefaultPhoneNumberIdForLead(phone);

  // Busca o template DEPOIS de saber o numero — templates ficam na WABA do
  // numero, e cada WABA pode ter templates diferentes (nao sao compartilhados).
  const templates = await fetchWhatsAppTemplates(phoneNumberId);
  const template = templates.find(t => t.name === templateName);
  if (!template) throw new Error(`Template "${templateName}" não encontrado`);

  const params = bodyParams.map(value => ({ type: 'text', text: value }));
  const templatePayload: Record<string, unknown> = {
    name: template.name,
    language: { code: template.language },
  };
  if (params.length > 0) {
    templatePayload.components = [{ type: 'body', parameters: params }];
  }

  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: templatePayload,
  };

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { messages?: Array<{ id?: string }>; error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `WhatsApp API error ${res.status}`);
  }

  const bodyComponent = template.components.find(c => c.type === 'BODY');
  const resolvedText = bodyComponent?.text
    ? bodyComponent.text.replace(/\{\{(\d+)\}\}/g, (_match, idx) => bodyParams[Number(idx) - 1] ?? `{{${idx}}}`)
    : null;

  const isGenerated = lead.email.startsWith('wpp_') && lead.email.endsWith('@autoforce.internal');
  await recordOutgoingWhatsAppMessage({
    leadEmail: isGenerated ? null : lead.email,
    phone,
    messageId: data.messages?.[0]?.id ?? null,
    templateName: template.name,
    text: resolvedText,
    payload: body,
    phoneNumberId,
  });
}

export const EBOOK_MAQUINA_DE_VENDAS = {
  filename: 'Como Construir uma Maquina de Vendas Automotiva.pdf',
  path: '/ebook-maquina-de-vendas-automotiva.pdf',
};

// Material de benchmark — diferente do ebook acima, esse e um link de
// visualizacao do Canva (pagina HTML, nao um arquivo baixavel), entao nao da
// pra mandar como documento anexado do WhatsApp (a Meta precisa baixar um
// arquivo de verdade pra isso). Enviado como link normal dentro do texto.
export const EBOOK_BENCHMARK_URL =
  'https://www.canva.com/design/DAHAObarEMs/pXFWmTuuvg8-9DS_SkUd5w/view?utm_content=DAHAObarEMs&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hd2658ba1eb#1';

export function getEbookMaquinaDeVendasUrl(): string {
  // Mesma cadeia de fallback usada no redirect do Google (server.ts) — se
  // FRONTEND_URL nao estiver configurada, tenta CORS_ORIGIN antes de cair pro
  // localhost (que a Meta nao conseguiria alcancar pra buscar o documento).
  const frontendUrl = (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')[0]
    .trim();
  return `${frontendUrl}${EBOOK_MAQUINA_DE_VENDAS.path}`;
}

export async function sendWhatsAppDocument(input: {
  to: string;
  leadEmail: string | null;
  documentUrl: string;
  filename: string;
  caption?: string;
  phoneNumberId?: string | null;
}): Promise<void> {
  const { accessToken } = await getWhatsAppCredentials();
  const phone = normalizePhone(input.to);
  const phoneNumberId = input.phoneNumberId?.trim() || await resolveDefaultPhoneNumberIdForLead(phone);

  const body = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'document',
    document: {
      link: input.documentUrl,
      filename: input.filename,
      ...(input.caption ? { caption: input.caption } : {}),
    },
  };

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { messages?: Array<{ id?: string }>; error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `WhatsApp API error ${res.status}`);
  }

  await recordOutgoingWhatsAppMessage({
    leadEmail: input.leadEmail,
    phone,
    messageId: data.messages?.[0]?.id ?? null,
    text: input.caption ?? `📄 ${input.filename}`,
    payload: body,
    phoneNumberId,
  });
}

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'PHONE_NUMBER' | 'URL';
  text: string;
  phone_number?: string;
  url?: string;
}

export interface CreateTemplateInput {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  headerText?: string;
  bodyText: string;
  footerText?: string;
  buttons?: TemplateButton[];
  phoneNumberId?: string;
}

function extractVarCount(text: string): number {
  const matches = text.match(/\{\{\d+\}\}/g) ?? [];
  return new Set(matches.map(m => m.replace(/\D/g, ''))).size;
}

export async function createWhatsAppTemplate(input: CreateTemplateInput): Promise<{ id: string; status: string }> {
  const { accessToken, businessAccountId: defaultWabaId } = await getWhatsAppCredentials();
  const businessAccountId = await resolveWabaId(accessToken, defaultWabaId, input.phoneNumberId);

  const components: Record<string, unknown>[] = [];

  if (input.headerText?.trim()) {
    const headerVars = extractVarCount(input.headerText);
    const headerComp: Record<string, unknown> = { type: 'HEADER', format: 'TEXT', text: input.headerText.trim() };
    if (headerVars > 0) {
      headerComp.example = { header_text: [Array.from({ length: headerVars }, (_, i) => `Exemplo ${i + 1}`)] };
    }
    components.push(headerComp);
  }

  const bodyVars = extractVarCount(input.bodyText);
  const bodyComp: Record<string, unknown> = { type: 'BODY', text: input.bodyText.trim() };
  if (bodyVars > 0) {
    bodyComp.example = { body_text: [Array.from({ length: bodyVars }, (_, i) => `Exemplo ${i + 1}`)] };
  }
  components.push(bodyComp);

  if (input.footerText?.trim()) {
    components.push({ type: 'FOOTER', text: input.footerText.trim() });
  }

  if (input.buttons && input.buttons.length > 0) {
    const buttons = input.buttons.slice(0, 3).map(btn => {
      const b: Record<string, unknown> = { type: btn.type, text: btn.text.trim() };
      if (btn.type === 'PHONE_NUMBER' && btn.phone_number) b.phone_number = btn.phone_number.trim();
      if (btn.type === 'URL' && btn.url) {
        b.url = btn.url.trim();
        // If URL contains {{1}}, provide example
        if (btn.url.includes('{{1}}')) b.example = ['pagina'];
      }
      return b;
    });
    components.push({ type: 'BUTTONS', buttons });
  }

  const res = await fetch(`https://graph.facebook.com/v19.0/${businessAccountId}/message_templates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: input.name,
      language: input.language,
      category: input.category,
      components,
    }),
  });

  const data = await res.json() as { id?: string; status?: string; error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Meta API error ${res.status}`);
  }
  return { id: data.id ?? '', status: data.status ?? 'PENDING' };
}

export async function deleteWhatsAppTemplate(templateName: string, phoneNumberId?: string): Promise<void> {
  const { accessToken, businessAccountId: defaultWabaId } = await getWhatsAppCredentials();
  const businessAccountId = await resolveWabaId(accessToken, defaultWabaId, phoneNumberId);

  const url = `https://graph.facebook.com/v19.0/${businessAccountId}/message_templates?name=${encodeURIComponent(templateName)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const data = await res.json() as { error?: { message: string } };
    throw new Error(data.error?.message ?? `Meta API error ${res.status}`);
  }
}

export async function setLeadAiHandoff(leadId: string, handoff: boolean): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) throw new Error('Lead não encontrado');
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      aiHandoff: handoff,
      // When re-enabling IA mode, clear any stuck processing lock
      ...(handoff === false ? { aiProcessing: false, aiProcessingAt: null } : {}),
    },
  });
}

export { getWhatsAppCredentials };
