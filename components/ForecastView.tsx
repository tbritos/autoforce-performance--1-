import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, RefreshCw, X } from 'lucide-react';
import { DataService } from '../services/dataService';
import { PipedriveStage } from '../types';

const formatCurrency = (val: number) => {
  if (Number.isNaN(val)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

interface ForecastRow {
  pipelineId: number;
  stageId: number;
  stageName: string | null;
  dealCount: number;
  totalMrr: number;
  totalSetup: number;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  LEAD: { label: 'Lead', color: 'var(--sl-400)' }, MQL: { label: 'MQL', color: 'var(--af-500)' },
  SQL: { label: 'SQL', color: '#818cf8' }, SCHEDULED: { label: 'Agendado', color: '#f59e0b' },
  DEMO: { label: 'Demo', color: '#f97316' }, PROPOSAL: { label: 'Proposta', color: '#a855f7' },
  OPPORTUNITY: { label: 'Proposta', color: '#a855f7' }, CLIENT: { label: 'Cliente', color: 'var(--green-500)' },
  LOST: { label: 'Perdido', color: 'var(--red-500)' }, DISQUALIFIED: { label: 'Desqualificado', color: 'var(--fg-subtle)' },
};

// ─── Stage deals drill-down modal ───────────────────────────────────────────

const StageDealsModal: React.FC<{
  pipelineId: number;
  stageId: number;
  stageName: string;
  onClose: () => void;
}> = ({ pipelineId, stageId, stageName, onClose }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Awaited<ReturnType<typeof DataService.drillDownLeads>> | null>(null);
  const pageSize = 20;

  useEffect(() => { setPage(1); }, [pipelineId, stageId]);

  useEffect(() => {
    setLoading(true);
    DataService.drillDownLeads({ pipelineId, stageId, page, pageSize })
      .then(setData)
      .catch(() => setData({ total: 0, page: 1, pageSize, leads: [] }))
      .finally(() => setLoading(false));
  }, [pipelineId, stageId, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(760px, 100%)', maxHeight: '82vh', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--fg-primary)' }}>{stageName}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>
              {data ? `${data.total.toLocaleString('pt-BR')} negócio${data.total !== 1 ? 's' : ''} em aberto` : 'Carregando...'}
            </p>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg-muted)', flexShrink: 0 }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 36, background: 'var(--bg-muted)', borderRadius: 8 }} className="animate-pulse" />
              ))}
            </div>
          ) : !data || data.leads.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13 }}>
              Nenhum negócio encontrado neste estágio.
            </div>
          ) : (
            <div>
              {data.leads.map((lead, i) => {
                const meta = STATUS_META[lead.status] ?? { label: lead.status, color: 'var(--fg-muted)' };
                const total = (lead.pipedriveDealValue ?? 0) + (lead.pipedriveSetupValue ?? 0);
                return (
                  <div
                    key={lead.id}
                    onClick={() => { navigate(`/leads/${lead.id}`); onClose(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
                      cursor: 'pointer', borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)')}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.name || lead.email}
                      </p>
                      <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.company ? `${lead.company} · ` : ''}{lead.email}
                      </p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: `${meta.color}18`, color: meta.color, flexShrink: 0 }}>
                      {meta.label}
                    </span>
                    <div style={{ width: 150, textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--fg-primary)' }}>{formatCurrency(total)}</p>
                      {(lead.pipedriveSetupValue ?? 0) > 0 && (
                        <p style={{ margin: '1px 0 0', fontSize: 10, color: 'var(--fg-subtle)' }}>
                          MRR {formatCurrency(lead.pipedriveDealValue ?? 0)} + Setup {formatCurrency(lead.pipedriveSetupValue ?? 0)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {data && data.total > pageSize && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', fontSize: 12, color: 'var(--fg-muted)', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>
              Anterior
            </button>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Página {page} de {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', fontSize: 12, color: 'var(--fg-muted)', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>
              Próxima
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Pipeline table ──────────────────────────────────────────────────────────

const PipelineTable: React.FC<{
  pipelineName: string;
  rows: Array<ForecastRow & { orderNr: number }>;
  onRowClick: (row: ForecastRow) => void;
}> = ({ pipelineName, rows, onRowClick }) => {
  const totalMrr    = rows.reduce((s, r) => s + r.totalMrr, 0);
  const totalSetup  = rows.reduce((s, r) => s + r.totalSetup, 0);
  const totalDeals  = rows.reduce((s, r) => s + r.dealCount, 0);
  const thStyle: React.CSSProperties = { padding: '10px 20px', fontSize: 11, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' };
  const tdStyle: React.CSSProperties = { padding: '11px 20px', fontSize: 13, color: 'var(--fg-secondary)' };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-primary)' }}>{pipelineName}</span>
        <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{totalDeals} negócio{totalDeals !== 1 ? 's' : ''} em aberto</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ ...thStyle, textAlign: 'left' }}>Estágio</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Negócios</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>MRR</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Setup</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${row.pipelineId}-${row.stageId}`}
                onClick={() => onRowClick(row)}
                style={{ cursor: 'pointer', background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)')}
              >
                <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--fg-primary)' }}>{row.stageName ?? `Estágio #${row.stageId}`}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{row.dealCount}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(row.totalMrr)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(row.totalSetup)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--fg-primary)' }}>{formatCurrency(row.totalMrr + row.totalSetup)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13 }}>
                  Nenhum negócio em aberto neste pipeline.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-subtle)' }}>
                <td style={{ padding: '11px 20px', fontSize: 12, fontWeight: 700, color: 'var(--fg-primary)' }}>Total</td>
                <td style={{ padding: '11px 20px', fontSize: 12, fontWeight: 700, color: 'var(--fg-primary)', textAlign: 'right' }}>{totalDeals}</td>
                <td style={{ padding: '11px 20px', fontSize: 12, fontWeight: 700, color: 'var(--fg-primary)', textAlign: 'right' }}>{formatCurrency(totalMrr)}</td>
                <td style={{ padding: '11px 20px', fontSize: 12, fontWeight: 700, color: 'var(--fg-primary)', textAlign: 'right' }}>{formatCurrency(totalSetup)}</td>
                <td style={{ padding: '11px 20px', fontSize: 13, fontWeight: 800, color: 'var(--accent)', textAlign: 'right' }}>{formatCurrency(totalMrr + totalSetup)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

interface ForecastViewProps {
  onTotals?: (totals: { totalMrr: number; totalSetup: number; dealCount: number }) => void;
}

const ForecastView: React.FC<ForecastViewProps> = ({ onTotals }) => {
  const [loading, setLoading]   = useState(true);
  const [forecast, setForecast] = useState<ForecastRow[]>([]);
  const [stages, setStages]     = useState<PipedriveStage[]>([]);
  const [drillDown, setDrillDown] = useState<ForecastRow | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([DataService.getForecast(), DataService.getPipedriveStages()])
      .then(([f, s]) => { setForecast(f); setStages(s); })
      .catch(() => { setForecast([]); setStages([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    onTotals?.({
      totalMrr:   forecast.reduce((s, r) => s + r.totalMrr, 0),
      totalSetup: forecast.reduce((s, r) => s + r.totalSetup, 0),
      dealCount:  forecast.reduce((s, r) => s + r.dealCount, 0),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecast]);

  const stageMetaMap = useMemo(() => {
    const map = new Map<number, PipedriveStage>();
    stages.forEach(s => map.set(s.id, s));
    return map;
  }, [stages]);

  const pipelineGroups = useMemo(() => {
    const groups = new Map<number, { name: string; rows: Array<ForecastRow & { orderNr: number }> }>();
    forecast.forEach(row => {
      const meta = stageMetaMap.get(row.stageId);
      const pipelineName = meta?.pipeline_name ?? `Pipeline #${row.pipelineId}`;
      if (!groups.has(row.pipelineId)) groups.set(row.pipelineId, { name: pipelineName, rows: [] });
      groups.get(row.pipelineId)!.rows.push({ ...row, orderNr: meta?.order_nr ?? 9999 });
    });
    groups.forEach(g => g.rows.sort((a, b) => a.orderNr - b.orderNr));
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [forecast, stageMetaMap]);

  const grandTotal = useMemo(() => forecast.reduce((s, r) => s + r.totalMrr + r.totalSetup, 0), [forecast]);
  const grandDeals = useMemo(() => forecast.reduce((s, r) => s + r.dealCount, 0), [forecast]);

  return (
    <div className="ds-card">
      {drillDown && (
        <StageDealsModal
          pipelineId={drillDown.pipelineId}
          stageId={drillDown.stageId}
          stageName={drillDown.stageName ?? `Estágio #${drillDown.stageId}`}
          onClose={() => setDrillDown(null)}
        />
      )}

      <div className="ds-card-head">
        <span className="ttl"><TrendingUp size={14} className="ico" /> Forecast — Propostas em Aberto</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!loading && forecast.length > 0 && (
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
              {grandDeals} negócio{grandDeals !== 1 ? 's' : ''} · {formatCurrency(grandTotal)}
            </span>
          )}
          <button type="button" onClick={load} disabled={loading}
            style={{ background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 32, background: 'var(--bg-muted)', borderRadius: 8 }} className="animate-pulse" />
          ))}
        </div>
      ) : pipelineGroups.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13 }}>
          Nenhum negócio em aberto vinculado encontrado. Verifique a sincronização com o Pipedrive em Conexões.
        </div>
      ) : (
        pipelineGroups.map(([pipelineId, group]) => (
          <PipelineTable key={pipelineId} pipelineName={group.name} rows={group.rows} onRowClick={setDrillDown} />
        ))
      )}
    </div>
  );
};

export default ForecastView;
