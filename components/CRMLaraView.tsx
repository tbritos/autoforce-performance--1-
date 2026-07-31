import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Flame, RefreshCw, Search, Settings, User } from 'lucide-react';
import { DataService } from '../services/dataService';
import type { MarketingKanbanBoard, MarketingKanbanCard, MarketingStage } from '../types';

const COLUMN_META: Array<{ stage: MarketingStage; label: string; hint?: string }> = [
  { stage: 'NOVO', label: 'Novo' },
  { stage: 'QUALIFICACAO', label: 'Em qualificação' },
  { stage: 'NUTRICAO', label: 'Em nutrição' },
  { stage: 'AGUARDANDO_FOLLOWUP', label: 'Aguardando follow-up' },
  { stage: 'CONVERSA_RESOLVIDA', label: 'Conversa resolvida' },
  { stage: 'AGENDA_ENVIADA', label: 'Convite de agenda enviado' },
  { stage: 'REUNIAO_AGENDADA', label: 'Reunião agendada', hint: 'segue no Pipedrive a partir daqui' },
  { stage: 'SEM_INTERESSE', label: 'Sem interesse / desqualificado' },
  { stage: 'TRANSFERIDO_HUMANO', label: 'Transferido pra humano' },
];

const SOURCE_META: Record<string, { icon: React.ElementType; title: string }> = {
  ai: { icon: Bot, title: 'Movido pela IA' },
  research: { icon: Search, title: 'Movido pela pesquisa da Lara' },
  system: { icon: Settings, title: 'Movido automaticamente pelo sistema' },
  manual: { icon: User, title: 'Movido manualmente' },
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function emptyBoard(): MarketingKanbanBoard {
  const totals = {} as Record<MarketingStage, number>;
  const columns = {} as Record<MarketingStage, MarketingKanbanCard[]>;
  for (const { stage } of COLUMN_META) {
    totals[stage] = 0;
    columns[stage] = [];
  }
  return { totals, columns };
}

export default function CRMLaraView() {
  const navigate = useNavigate();
  const [board, setBoard] = useState<MarketingKanbanBoard>(emptyBoard());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOverStage, setDragOverStage] = useState<MarketingStage | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await DataService.getMarketingKanban(false);
      setBoard(data);
    } catch {
      setError('Erro ao carregar o board.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const moveCard = async (cardId: string, fromStage: MarketingStage, toStage: MarketingStage) => {
    if (fromStage === toStage) return;
    setBoard(prev => {
      const card = prev.columns[fromStage].find(c => c.id === cardId);
      if (!card) return prev;
      return {
        totals: {
          ...prev.totals,
          [fromStage]: Math.max(0, prev.totals[fromStage] - 1),
          [toStage]: prev.totals[toStage] + 1,
        },
        columns: {
          ...prev.columns,
          [fromStage]: prev.columns[fromStage].filter(c => c.id !== cardId),
          [toStage]: [{ ...card, marketingStageSource: 'manual', marketingStageChangedAt: new Date().toISOString() }, ...prev.columns[toStage]],
        },
      };
    });
    try {
      await DataService.updateLeadMarketingStage(cardId, toStage);
    } catch {
      setError('Erro ao mover o card — recarregando o board.');
      await load();
    }
  };

  return (
    <div data-testid="crm-lara-board" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={20} /> CRM Lara
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>
            Board de marketing — a Lara organiza os leads aqui até agendar a reunião e passar pro Pipedrive.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={() => load()} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--fg-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--red-50)', color: 'var(--red-700)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', flex: 1, minWidth: 0, paddingBottom: 8 }}>
        {COLUMN_META.map(({ stage, label, hint }) => {
          const cards = board.columns[stage] ?? [];
          const total = board.totals[stage] ?? 0;
          const isDragOver = dragOverStage === stage;
          return (
            <div
              key={stage}
              data-testid={`crm-lara-column-${stage}`}
              onDragOver={e => { e.preventDefault(); setDragOverStage(stage); }}
              onDragLeave={() => setDragOverStage(prev => (prev === stage ? null : prev))}
              onDrop={e => {
                e.preventDefault();
                setDragOverStage(null);
                const data = e.dataTransfer.getData('application/x-lead-card');
                if (!data) return;
                const { id, stage: fromStage } = JSON.parse(data) as { id: string; stage: MarketingStage };
                void moveCard(id, fromStage, stage);
              }}
              style={{
                minWidth: 260, maxWidth: 260, display: 'flex', flexDirection: 'column',
                background: 'var(--bg-subtle)', border: `1px solid ${isDragOver ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10, overflow: 'hidden', flexShrink: 0,
              }}
            >
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-primary)' }}>{label}</span>
                  <span data-testid={`crm-lara-total-${stage}`} style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', background: 'var(--bg-muted)', borderRadius: 99, padding: '1px 7px' }}>
                    {total}
                  </span>
                </div>
                {hint && <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'var(--fg-subtle)' }}>{hint}</p>}
              </div>

              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1, minHeight: 120 }}>
                {cards.length === 0 && (
                  <p style={{ margin: '12px 0', fontSize: 12, color: 'var(--fg-subtle)', textAlign: 'center' }}>Nenhum lead aqui</p>
                )}
                {cards.map(card => {
                  const source = card.marketingStageSource ? SOURCE_META[card.marketingStageSource] : undefined;
                  const SourceIcon = source?.icon;
                  return (
                    <div
                      key={card.id}
                      data-testid="crm-lara-card"
                      draggable
                      onDragStart={e => e.dataTransfer.setData('application/x-lead-card', JSON.stringify({ id: card.id, stage }))}
                      onClick={() => navigate(`/leads/${encodeURIComponent(card.id)}`)}
                      style={{
                        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
                        padding: '8px 10px', cursor: 'grab', display: 'flex', flexDirection: 'column', gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {card.name || card.email}
                        </span>
                        {card.isHot && <Flame size={13} color="#dc2626" />}
                      </div>
                      {card.company && (
                        <span style={{ fontSize: 11, color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {card.company}
                        </span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                        <span style={{ fontSize: 10.5, color: 'var(--fg-subtle)' }}>
                          score Lara {card.aiScore ?? '—'}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--fg-subtle)' }} title={source?.title}>
                          {SourceIcon && <SourceIcon size={11} />}
                          {timeAgo(card.marketingStageChangedAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
