import { MarketingStage } from '@prisma/client';
import { prisma } from '../config/database';
import { normalizeEmail } from './lead-hub.service';

export type MarketingStageSource = 'ai' | 'system' | 'manual';

// Uma vez que um humano assumiu a conversa ou a reuniao ja foi marcada, uma
// reclassificacao rotineira (IA reavaliando fit numa mensagem de rotina, ou o
// job periodico de silencio) nao deve empurrar o card pra tras — so um
// drag-and-drop manual pode tirar o lead desses dois estados.
const LOCKED_STAGES: MarketingStage[] = ['REUNIAO_AGENDADA', 'TRANSFERIDO_HUMANO'];

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
  changedBy?: string
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

export async function getMarketingKanban(includeAll = false): Promise<{
  totals: Record<MarketingStage, number>;
  columns: Record<MarketingStage, MarketingKanbanCard[]>;
}> {
  const counts = await prisma.lead.groupBy({
    by: ['marketingStage'],
    where: { deletedAt: null },
    _count: { _all: true },
  });

  const totals = Object.fromEntries(ALL_STAGES.map(stage => [stage, 0])) as Record<MarketingStage, number>;
  for (const row of counts) totals[row.marketingStage] = row._count._all;

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const columnEntries = await Promise.all(ALL_STAGES.map(async (stage) => {
    const windowed = !includeAll && WINDOWED_STAGES.includes(stage);
    const leads = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        marketingStage: stage,
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
