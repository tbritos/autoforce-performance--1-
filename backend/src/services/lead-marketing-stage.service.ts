import { MarketingStage } from '@prisma/client';
import { prisma } from '../config/database';
import { normalizeEmail } from './lead-hub.service';

export type MarketingStageSource = 'ai' | 'system' | 'manual';

// Uma vez que um humano assumiu a conversa ou a reuniao ja foi marcada, uma
// reclassificacao rotineira (IA reavaliando fit numa mensagem de rotina, ou o
// job periodico de silencio) nao deve empurrar o card pra tras — so um
// drag-and-drop manual pode tirar o lead desses dois estados.
const LOCKED_STAGES: MarketingStage[] = ['REUNIAO_AGENDADA', 'TRANSFERIDO_HUMANO'];

// Mensagem padrao de atividade por estagio — ver lead-activity.service.ts.
// Cobre a maioria dos eventos pedidos pra timeline (fez follow-up, descartou
// o lead, transferiu pra humano etc.) de uma vez so, ja que toda transicao
// de coluna do CRM Lara passa por este mutador central.
const STAGE_ACTIVITY_MESSAGE: Record<MarketingStage, string> = {
  NOVO: 'Lead entrou no funil de marketing',
  QUALIFICACAO: 'Lead classificado como "Em qualificação"',
  NUTRICAO: 'Lead classificado como "Em nutrição"',
  AGUARDANDO_FOLLOWUP: 'Lead entrou em espera de follow-up (silêncio)',
  AGENDA_ENVIADA: 'Convite de agenda enviado ao lead',
  REUNIAO_AGENDADA: 'Reunião agendada',
  SEM_INTERESSE: 'Lead descartado (sem interesse / fora do ICP)',
  TRANSFERIDO_HUMANO: 'Conversa transferida para atendimento humano',
};

// Unico ponto que deve escrever em marketingStage/marketingStageChangedAt/
// marketingStageSource — ver plano "CRM Lara" pra a maquina de estados
// completa (quem chama isso e com qual source, em cada arquivo).
//
// Update atomico (UPDATE...WHERE, nao read-then-write) pra nao abrir uma
// janela de corrida entre uma reclassificacao da IA/job periodico e um
// drag-and-drop manual chegando quase ao mesmo tempo por um caminho que nao
// passa pelo lock aiProcessing/aiProcessingAt.
export async function setMarketingStage(
  leadEmailRaw: string,
  newStage: MarketingStage,
  source: MarketingStageSource,
  changedBy?: string,
  reason?: string
): Promise<void> {
  const email = normalizeEmail(leadEmailRaw);
  const excludedForNonManual = source === 'manual' ? [] : LOCKED_STAGES;

  const result = await prisma.lead.updateMany({
    where: {
      email,
      marketingStage: {
        not: newStage,
        ...(excludedForNonManual.length > 0 ? { notIn: excludedForNonManual } : {}),
      },
    },
    data: {
      marketingStage: newStage,
      marketingStageChangedAt: new Date(),
      marketingStageSource: source,
    },
  });

  if (result.count > 0) {
    console.log(`[CRM-Lara] ${email} -> ${newStage} (source=${source}${changedBy ? `, by=${changedBy}` : ''})`);
    const { logLeadActivity } = await import('./lead-activity.service');
    await logLeadActivity(email, 'stage_changed', STAGE_ACTIVITY_MESSAGE[newStage], reason, source);
  }
}

// Override manual (drag-and-drop no board) — resolve id -> email e delega
// pro mutador central, sempre com source 'manual' (unico source que ignora a
// guarda de estados travados).
export async function setMarketingStageById(id: string, newStage: MarketingStage, changedBy?: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id }, select: { email: true } });
  if (!lead) throw new Error('Lead nao encontrado');
  await setMarketingStage(lead.email, newStage, 'manual', changedBy);
}

const ALL_STAGES: MarketingStage[] = [
  'NOVO', 'QUALIFICACAO', 'NUTRICAO', 'AGUARDANDO_FOLLOWUP',
  'AGENDA_ENVIADA', 'REUNIAO_AGENDADA', 'SEM_INTERESSE', 'TRANSFERIDO_HUMANO',
];

// Colunas que so recebem e nunca esvaziam sozinhas (nada move um lead pra
// fora delas automaticamente) — sem limite, cresceriam sem parar. Janela de
// atividade recente por padrao; `includeAll` deixa ver tudo sob demanda.
const WINDOWED_STAGES: MarketingStage[] = ['AGENDA_ENVIADA', 'REUNIAO_AGENDADA', 'SEM_INTERESSE', 'TRANSFERIDO_HUMANO'];
const WINDOW_DAYS = 60;
const CARDS_PER_COLUMN = 50;

export interface MarketingKanbanCard {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  phone: string | null;
  score: number;
  isHot: boolean;
  marketingStageChangedAt: Date | null;
  marketingStageSource: string | null;
}

// marketingStage default e "NOVO" pra TODO lead criado, sem excecao (ver
// @default(NOVO) no schema) — mas nem todo lead na base entrou pelo funil
// ativo do agente (webhook de campanha ou WhatsApp direto): leads sem
// telefone nunca vao ser trabalhados por WhatsApp, e leads com a tag
// 'importacao' ou vindos de importacao em massa (mesmos sinais de
// LeadHubService.EXCLUDED_LEAD_TAG/LEGACY_BULK_IMPORT_SOURCES,
// lead-hub.service.ts) sao base historica que ninguem pediu pra reengajar.
//
// IMPORTANTE: origem (tag/firstSource) e um fato fixado na criacao do lead —
// nao muda depois. Por isso so filtra a coluna NOVO (que representa "ainda
// nao analisado, esperando o primeiro atendimento"): um lead importado que
// depois conversou de verdade no WhatsApp e progrediu pra outro estagio
// continua aparecendo normalmente ali, porque nesse ponto o que importa e o
// engajamento real, nao como ele entrou na base originalmente. Aplicar esse
// filtro em todas as colunas esconderia leads genuinamente ativos so por
// causa da origem historica deles.
const NOVO_EXCLUDED_TAG = 'importacao';
const NOVO_EXCLUDED_SOURCES = ['importacao_csv', 'rdstation', 'rdstation_webhook'];

export async function getMarketingKanban(includeAll = false): Promise<{
  totals: Record<MarketingStage, number>;
  columns: Record<MarketingStage, MarketingKanbanCard[]>;
}> {
  // Filtro "de estado atual" — vale pra toda coluna, sempre (nao e sobre
  // origem historica, e sobre o lead ter telefone HOJE, e sobre `status`
  // ainda ser 'LEAD'). `status` (funil de vendas real: MQL/SQL/PROPOSAL/
  // CLIENT/LOST/etc) e `marketingStage` (coluna do CRM Lara) sao campos
  // totalmente independentes — nenhuma sincronizacao do Pipedrive nem troca
  // manual de status em Lead Hub toca marketingStage. Um lead pode virar
  // Proposta/Cliente/Perdido sem nunca ter conversado com o agente, e sem
  // esse filtro ficaria com marketingStage='NOVO' pra sempre, aparecendo
  // indefinidamente no board de marketing mesmo ja tendo saido dele pra
  // virar oportunidade de vendas real ou ter encerrado. Mesma whitelist
  // ELIGIBLE_STATUS='LEAD' ja usada em ai-followup.service.ts.
  const baseFilter = { deletedAt: null, phone: { not: null }, status: 'LEAD' as const };

  // So se aplica a NOVO — ver comentario acima.
  const novoOnlyFilter = {
    NOT: { tags: { has: NOVO_EXCLUDED_TAG } },
    OR: [{ firstSource: null }, { firstSource: { notIn: NOVO_EXCLUDED_SOURCES } }],
  };

  const counts = await prisma.lead.groupBy({
    by: ['marketingStage'],
    where: baseFilter,
    _count: { _all: true },
  });

  const totals = Object.fromEntries(ALL_STAGES.map(stage => [stage, 0])) as Record<MarketingStage, number>;
  for (const row of counts) totals[row.marketingStage] = row._count._all;
  totals.NOVO = await prisma.lead.count({ where: { ...baseFilter, marketingStage: 'NOVO', ...novoOnlyFilter } });

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const columnEntries = await Promise.all(ALL_STAGES.map(async (stage) => {
    const windowed = !includeAll && WINDOWED_STAGES.includes(stage);
    const leads = await prisma.lead.findMany({
      where: {
        ...baseFilter,
        marketingStage: stage,
        ...(stage === 'NOVO' ? novoOnlyFilter : {}),
        ...(windowed ? { marketingStageChangedAt: { gte: cutoff } } : {}),
      },
      orderBy: { marketingStageChangedAt: 'desc' },
      take: CARDS_PER_COLUMN,
      select: {
        id: true, name: true, email: true, company: true, phone: true,
        score: true, isHot: true, marketingStageChangedAt: true, marketingStageSource: true,
      },
    });
    return [stage, leads] as const;
  }));

  return {
    totals,
    columns: Object.fromEntries(columnEntries) as Record<MarketingStage, MarketingKanbanCard[]>,
  };
}
