import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { DataService } from '../../services/dataService';
import { DrillDownClickParams, DrillDownResult } from '../../types';

const PAGE_SIZE = 20;

const fmtDate = (value: unknown): string => {
  if (!value) return '—';
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtCurrency = (value: unknown): string => {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
};

const fmtNumber = (value: unknown): string => new Intl.NumberFormat('pt-BR').format(Number(value ?? 0));

const cellStyle: React.CSSProperties = { padding: '10px 12px', fontSize: 12, color: 'var(--fg-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const headStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', textAlign: 'left' };

interface ColumnDef {
  label: string;
  align?: 'right';
  render: (row: Record<string, unknown>) => React.ReactNode;
}

const LEAD_COLUMNS: ColumnDef[] = [
  { label: 'Lead', render: r => <div><div style={{ fontWeight: 600, color: 'var(--fg-primary)' }}>{(r.name as string) || (r.email as string)}</div>{r.name ? <div style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{r.email as string}</div> : null}</div> },
  { label: 'Empresa', render: r => (r.company as string) || '—' },
  { label: 'Origem', render: r => (r.firstSource as string) || '—' },
  { label: 'Status', render: r => (r.toStatus as string) || (r.status as string) || '—' },
  { label: 'Data', render: r => fmtDate(r.changedAt ?? r.firstSeenAt) },
];

const REVENUE_COLUMNS: ColumnDef[] = [
  { label: 'Negócio', render: r => (r.businessName as string) || '—' },
  { label: 'MRR', align: 'right', render: r => fmtCurrency(r.mrrValue) },
  { label: 'Setup', align: 'right', render: r => fmtCurrency(r.setupValue) },
  { label: 'Origem', render: r => (r.origin as string) || '—' },
  { label: 'Vendedor', render: r => (r.closedBy as string) || '—' },
  { label: 'Data', render: r => fmtDate(r.date) },
];

const CAMPAIGN_COLUMNS: ColumnDef[] = [
  { label: 'Campanha', render: r => (r.campaignName as string) || '—' },
  { label: 'Plataforma', render: r => (r.platform as string) || '—' },
  { label: 'Investimento', align: 'right', render: r => fmtCurrency(r.spend) },
  { label: 'Cliques', align: 'right', render: r => fmtNumber(r.clicks) },
  { label: 'Leads', align: 'right', render: r => fmtNumber(r.leads) },
  { label: 'Data', render: r => fmtDate(r.date) },
];

const EMAIL_COLUMNS: ColumnDef[] = [
  { label: 'Nome', render: r => (r.name as string) || '—' },
  { label: 'Fonte', render: r => (r.source as string) || '—' },
  { label: 'Enviados', align: 'right', render: r => fmtNumber(r.sends) },
  { label: 'Aberturas', align: 'right', render: r => fmtNumber(r.opens) },
  { label: 'Cliques', align: 'right', render: r => fmtNumber(r.clicks) },
  { label: 'Data', render: r => fmtDate(r.date) },
];

function columnsForEntity(entity: DrillDownResult['entity']): ColumnDef[] {
  switch (entity) {
    case 'lead':            return LEAD_COLUMNS;
    case 'revenue_entry':   return REVENUE_COLUMNS;
    case 'campaign_metric': return CAMPAIGN_COLUMNS;
    case 'email_campaign':  return EMAIL_COLUMNS;
    default:                return [];
  }
}

export const ReportDrillDownModal: React.FC<{ params: DrillDownClickParams | null; onClose: () => void }> = ({ params, onClose }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DrillDownResult | null>(null);

  useEffect(() => { if (params) { setPage(1); setResult(null); } }, [params]);

  useEffect(() => {
    if (!params) return;
    let cancelled = false;
    setLoading(true);
    DataService.drillDownReportMetric({ ...params, page, pageSize: PAGE_SIZE })
      .then(res => { if (!cancelled) setResult(res); })
      .catch(() => { if (!cancelled) setResult({ supported: true, entity: null, total: 0, page: 1, pageSize: PAGE_SIZE, rows: [] }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params, page]);

  if (!params) return null;

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const columns = columnsForEntity(result?.entity ?? null);

  const handleRowClick = (row: Record<string, unknown>) => {
    if (result?.entity === 'lead' && row.id) { navigate(`/leads/${row.id}`); onClose(); return; }
    if (result?.entity === 'revenue_entry') {
      if (row.leadId) { navigate(`/leads/${row.leadId}`); onClose(); return; }
      if (row.dealUrl) { window.open(row.dealUrl as string, '_blank', 'noopener'); return; }
    }
  };

  const rowClickable = (row: Record<string, unknown>): boolean => {
    if (result?.entity === 'lead') return !!row.id;
    if (result?.entity === 'revenue_entry') return !!row.leadId || !!row.dealUrl;
    return false;
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(900px, 96vw)', maxHeight: '86vh', background: 'var(--bg-surface)', borderRadius: 16,
        border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)', zIndex: 1101,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--fg-primary)' }}>{params.title}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>
              {result?.supported === false ? '' : result ? `${result.total.toLocaleString('pt-BR')} registro${result.total !== 1 ? 's' : ''}` : '...'}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {result?.supported === false ? (
            <div style={{ padding: '48px 22px', textAlign: 'center', color: 'var(--fg-subtle)' }}>
              <AlertCircle size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
              <p style={{ fontSize: 13, margin: 0 }}>{result.reason}</p>
            </div>
          ) : loading ? (
            <div style={{ padding: '8px 0' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 22px' }}>
                  {[40, 20, 15, 15, 10].map((w, j) => (
                    <div key={j} style={{ height: 12, width: `${w}%`, background: 'var(--bg-muted)', borderRadius: 4 }} />
                  ))}
                </div>
              ))}
            </div>
          ) : !result || result.rows.length === 0 ? (
            <div style={{ padding: '48px 22px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13 }}>
              Nenhum registro encontrado.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                  {columns.map(col => (
                    <th key={col.label} style={{ ...headStyle, textAlign: col.align ?? 'left' }}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => {
                  const clickable = rowClickable(row);
                  return (
                    <tr
                      key={(row.id as string) ?? i}
                      onClick={clickable ? () => handleRowClick(row) : undefined}
                      style={{ borderBottom: '1px solid var(--border-subtle)', cursor: clickable ? 'pointer' : 'default', background: i % 2 === 0 ? 'transparent' : 'var(--bg-subtle)' }}
                    >
                      {columns.map(col => (
                        <td key={col.label} style={{ ...cellStyle, textAlign: col.align ?? 'left' }}>{col.render(row)}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {result && result.supported !== false && result.total > PAGE_SIZE && (
          <div style={{ padding: '10px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>Página {page} de {totalPages}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--fg-subtle)' : 'var(--fg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={13} />
              </button>
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? 'var(--fg-subtle)' : 'var(--fg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
};
