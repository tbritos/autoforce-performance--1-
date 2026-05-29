import React, { useEffect, useMemo, useState } from 'react';
import {
  Megaphone, TrendingUp, Calendar, DollarSign,
  Eye, MousePointerClick, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown,
  ShoppingCart, Search,
} from 'lucide-react';
import { DataService } from '../services/dataService';
import { MetaCampaign, GoogleAdsCampaign } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'paused';

interface DisplayRow {
  id: string;
  name: string;
  spend: number;
  cpc: number;
  ctr: number;
  clicks: number;
  impressions: number;
  reach?: number;
  cpm?: number;
  budget?: number;
  conversions?: number;
  status?: string;
}

type MetaSortKey   = 'name' | 'status' | 'spend' | 'clicks' | 'cpc' | 'ctr' | 'reach' | 'impressions' | 'cpm';
type GoogleSortKey = 'name' | 'status' | 'spend' | 'clicks' | 'cpc' | 'ctr' | 'impressions' | 'budget' | 'conversions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function fmtNum(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString('pt-BR');
}

function sortRows<K extends keyof DisplayRow>(rows: DisplayRow[], key: K, dir: 'asc' | 'desc') {
  return [...rows].sort((a, b) => {
    const va = a[key] ?? 0;
    const vb = b[key] ?? 0;
    const diff = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return dir === 'asc' ? diff : -diff;
  });
}

function isActiveStatus(status?: string) {
  const upper = (status || '').toUpperCase();
  return upper.includes('ENABL') || upper === 'ACTIVE' || upper === 'ATIVA';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const SortIcon: React.FC<{ active: boolean; dir: 'asc' | 'desc' }> = ({ active, dir }) => {
  if (!active) return <ArrowUpDown size={11} style={{ display: 'inline', marginLeft: 4, opacity: 0.3 }} />;
  return dir === 'asc'
    ? <ArrowUp   size={11} style={{ display: 'inline', marginLeft: 4, color: 'var(--accent)' }} />
    : <ArrowDown size={11} style={{ display: 'inline', marginLeft: 4, color: 'var(--accent)' }} />;
};


function StatusChip({ status }: { status?: string }) {
  if (!status) return <span style={{ color: 'var(--fg-subtle)' }}>—</span>;
  const active = isActiveStatus(status);
  return (
    <span className={`ds-badge ${active ? 'success' : ''}`}>
      <span className="dot" />
      {active ? 'Ativa' : 'Pausada'}
    </span>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColDef<K extends string> {
  key: K;
  label: string;
  render: (row: DisplayRow) => React.ReactNode;
}

const META_COLS: ColDef<MetaSortKey>[] = [
  { key: 'name',        label: 'Campanha',     render: r => <span style={{ fontWeight: 500, color: 'var(--fg-primary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.name}</span> },
  { key: 'status',      label: 'Status',       render: r => <StatusChip status={r.status} /> },
  { key: 'spend',       label: 'Investimento', render: r => <span className="num" style={{ color: 'var(--fg-secondary)' }}>{fmtBRL(r.spend)}</span> },
  { key: 'reach',       label: 'Alcance',      render: r => <span className="num" style={{ color: 'var(--fg-secondary)' }}>{fmtNum(r.reach ?? 0)}</span> },
  { key: 'impressions', label: 'Impressões',   render: r => <span className="num" style={{ color: 'var(--fg-secondary)' }}>{fmtNum(r.impressions)}</span> },
  { key: 'clicks',      label: 'Cliques',      render: r => <span className="num" style={{ color: 'var(--fg-secondary)' }}>{fmtNum(r.clicks)}</span> },
  { key: 'ctr',         label: 'CTR',          render: r => <span className="num" style={{ fontWeight: 600, color: 'var(--fg-primary)' }}>{r.ctr.toFixed(2)}%</span> },
  { key: 'cpc',         label: 'CPC',          render: r => <span className="num" style={{ color: 'var(--fg-secondary)' }}>{fmtBRL(r.cpc)}</span> },
  { key: 'cpm',         label: 'CPM',          render: r => <span className="num" style={{ color: 'var(--fg-secondary)' }}>{fmtBRL(r.cpm ?? 0)}</span> },
];

const GOOGLE_COLS: ColDef<GoogleSortKey>[] = [
  { key: 'name',        label: 'Campanha',      render: r => <span style={{ fontWeight: 500, color: 'var(--fg-primary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.name}</span> },
  { key: 'status',      label: 'Status',        render: r => <StatusChip status={r.status} /> },
  { key: 'budget',      label: 'Orçamento/dia', render: r => <span className="num" style={{ color: 'var(--fg-secondary)' }}>{fmtBRL(r.budget ?? 0)}</span> },
  { key: 'spend',       label: 'Gasto',         render: r => <span className="num" style={{ color: 'var(--fg-secondary)' }}>{fmtBRL(r.spend)}</span> },
  { key: 'impressions', label: 'Impressões',    render: r => <span className="num" style={{ color: 'var(--fg-secondary)' }}>{fmtNum(r.impressions)}</span> },
  { key: 'clicks',      label: 'Cliques',       render: r => <span className="num" style={{ color: 'var(--fg-secondary)' }}>{fmtNum(r.clicks)}</span> },
  { key: 'ctr',         label: 'CTR',           render: r => <span className="num" style={{ fontWeight: 600, color: 'var(--fg-primary)' }}>{r.ctr.toFixed(2)}%</span> },
  { key: 'cpc',         label: 'CPC',           render: r => <span className="num" style={{ color: 'var(--fg-secondary)' }}>{fmtBRL(r.cpc)}</span> },
  { key: 'conversions', label: 'Conversões',    render: r => <span className="num" style={{ fontWeight: 600, color: 'var(--fg-primary)' }}>{fmtNum(r.conversions ?? 0)}</span> },
];

// ─── Campaign table ───────────────────────────────────────────────────────────

function CampaignTable<K extends string>({
  rows, loading, cols, sortKey, sortDir, onSort, emptyText,
}: {
  rows: DisplayRow[];
  loading: boolean;
  cols: ColDef<K>[];
  sortKey: K;
  sortDir: 'asc' | 'desc';
  onSort: (k: K) => void;
  emptyText: string;
}) {
  if (loading) {
    return (
      <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--fg-muted)' }}>
        <RefreshCw size={20} className="animate-spin" />
        <p style={{ fontSize: 13, margin: 0 }}>Carregando campanhas...</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <Megaphone size={28} style={{ margin: '0 auto 10px', color: 'var(--fg-subtle)', display: 'block' }} />
        <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: 0 }}>{emptyText}</p>
      </div>
    );
  }
  return (
    <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto', overflowY: 'auto', maxHeight: 480 }}>
      <table className="ds-table">
        <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-surface)' }}>
          <tr>
            {cols.map(col => (
              <th key={col.key} className={col.key === 'name' ? '' : 'num'}>
                <button
                  type="button"
                  onClick={() => onSort(col.key)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit', fontWeight: 'inherit', color: sortKey === col.key ? 'var(--fg-primary)' : 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', padding: 0 }}
                >
                  {col.label}
                  <SortIcon active={sortKey === col.key} dir={sortDir} />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              {cols.map(col => (
                <td key={col.key} className={col.key === 'name' ? '' : 'num'}>{col.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

const CampaignsView: React.FC = () => {
  const [metaCampaigns,    setMetaCampaigns]    = useState<MetaCampaign[]>([]);
  const [googleCampaigns,  setGoogleCampaigns]  = useState<GoogleAdsCampaign[]>([]);
  const [loadingMeta,      setLoadingMeta]      = useState(false);
  const [loadingGoogle,    setLoadingGoogle]    = useState(false);
  const [metaError,        setMetaError]        = useState<string | null>(null);
  const [googleError,      setGoogleError]      = useState<string | null>(null);

  const [platform,     setPlatform]     = useState<'meta' | 'google'>('meta');
  const [dateRange,    setDateRange]    = useState('30days');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search,       setSearch]       = useState('');
  const [customStart,  setCustomStart]  = useState('');
  const [customEnd,    setCustomEnd]    = useState('');

  const [metaSort,      setMetaSort]      = useState<MetaSortKey>('spend');
  const [metaSortDir,   setMetaSortDir]   = useState<'asc' | 'desc'>('desc');
  const [googleSort,    setGoogleSort]    = useState<GoogleSortKey>('spend');
  const [googleSortDir, setGoogleSortDir] = useState<'asc' | 'desc'>('desc');

  const { startDateStr, endDateStr } = useMemo(() => {
    const end   = new Date();
    const start = new Date();
    if (dateRange === '7days')  start.setDate(end.getDate() - 7);
    if (dateRange === '30days') start.setDate(end.getDate() - 30);
    if (dateRange === '90days') start.setDate(end.getDate() - 90);
    return {
      startDateStr: dateRange === 'custom' ? customStart : start.toISOString().split('T')[0],
      endDateStr:   dateRange === 'custom' ? customEnd   : end.toISOString().split('T')[0],
    };
  }, [dateRange, customStart, customEnd]);

  useEffect(() => {
    if (dateRange === 'custom' && (!customStart || !customEnd)) return;
    setLoadingMeta(true); setMetaError(null);
    DataService.getMetaCampaigns(startDateStr, endDateStr)
      .then(data => setMetaCampaigns(Array.isArray(data) ? data : []))
      .catch(err => { setMetaCampaigns([]); setMetaError(err instanceof Error ? err.message : 'Erro ao carregar campanhas da Meta.'); })
      .finally(() => setLoadingMeta(false));
  }, [startDateStr, endDateStr, dateRange, customStart, customEnd]);

  useEffect(() => {
    if (dateRange === 'custom' && (!customStart || !customEnd)) return;
    setLoadingGoogle(true); setGoogleError(null);
    DataService.getGoogleAdsCampaigns(startDateStr, endDateStr)
      .then(data => setGoogleCampaigns(Array.isArray(data) ? data : []))
      .catch(err => { setGoogleCampaigns([]); setGoogleError(err instanceof Error ? err.message : 'Erro ao carregar campanhas do Google Ads.'); })
      .finally(() => setLoadingGoogle(false));
  }, [startDateStr, endDateStr, dateRange, customStart, customEnd]);

  const handleMetaSort = (key: MetaSortKey) => {
    if (metaSort === key) { setMetaSortDir(d => d === 'asc' ? 'desc' : 'asc'); return; }
    setMetaSort(key); setMetaSortDir('desc');
  };
  const handleGoogleSort = (key: GoogleSortKey) => {
    if (googleSort === key) { setGoogleSortDir(d => d === 'asc' ? 'desc' : 'asc'); return; }
    setGoogleSort(key); setGoogleSortDir('desc');
  };

  const applyFilters = (campaigns: (MetaCampaign | GoogleAdsCampaign)[]) =>
    campaigns.filter(c => {
      if (statusFilter !== 'all') {
        const active = isActiveStatus(c.status);
        if (statusFilter === 'active' && !active) return false;
        if (statusFilter === 'paused' && active)  return false;
      }
      if (search.trim()) return c.name.toLowerCase().includes(search.toLowerCase());
      return true;
    });

  const metaRows = useMemo<DisplayRow[]>(() =>
    sortRows(applyFilters(metaCampaigns).map(c => ({ ...c, clicks: (c as MetaCampaign).clicks || 0 })), metaSort as keyof DisplayRow, metaSortDir),
  [metaCampaigns, metaSort, metaSortDir, statusFilter, search]);

  const googleRows = useMemo<DisplayRow[]>(() =>
    sortRows(applyFilters(googleCampaigns).map(c => ({ ...c, clicks: (c as GoogleAdsCampaign).clicks || 0 })), googleSort as keyof DisplayRow, googleSortDir),
  [googleCampaigns, googleSort, googleSortDir, statusFilter, search]);

  // Stats computed from filtered rows so they always match the table
  const metaStats = useMemo(() => {
    if (!metaRows.length) return null;
    const n = metaRows.length;
    return {
      spend:       metaRows.reduce((s, c) => s + c.spend, 0),
      impressions: metaRows.reduce((s, c) => s + c.impressions, 0),
      clicks:      metaRows.reduce((s, c) => s + c.clicks, 0),
      avgCtr:      metaRows.reduce((s, c) => s + c.ctr, 0) / n,
      avgCpc:      metaRows.reduce((s, c) => s + c.cpc, 0) / n,
    };
  }, [metaRows]);

  const googleStats = useMemo(() => {
    if (!googleRows.length) return null;
    const n = googleRows.length;
    return {
      spend:       googleRows.reduce((s, c) => s + c.spend, 0),
      impressions: googleRows.reduce((s, c) => s + c.impressions, 0),
      clicks:      googleRows.reduce((s, c) => s + c.clicks, 0),
      avgCtr:      googleRows.reduce((s, c) => s + c.ctr, 0) / n,
      conversions: googleRows.reduce((s, c) => s + (c.conversions ?? 0), 0),
    };
  }, [googleRows]);

  // Combined totals for the summary strip
  const combined = useMemo(() => ({
    spend:       (metaStats?.spend ?? 0) + (googleStats?.spend ?? 0),
    impressions: (metaStats?.impressions ?? 0) + (googleStats?.impressions ?? 0),
    clicks:      (metaStats?.clicks ?? 0) + (googleStats?.clicks ?? 0),
  }), [metaStats, googleStats]);

  const allCampaigns = [...metaCampaigns, ...googleCampaigns];
  const statusCounts = useMemo(() => {
    const active = allCampaigns.filter(c => isActiveStatus(c.status)).length;
    return { all: allCampaigns.length, active, paused: allCampaigns.length - active };
  }, [metaCampaigns, googleCampaigns]);

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-subtle)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)', padding: '6px 10px', fontSize: 12,
    color: 'var(--fg-primary)', outline: 'none',
  };

  return (
    <div style={{ padding: '24px 28px 64px', maxWidth: 1480, margin: '0 auto' }} className="space-y-6 animate-fade-in-up">

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>Campanhas</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4, marginBottom: 0 }}>Meta Ads e Google Ads</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">

          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, color: 'var(--fg-subtle)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar campanha..."
              style={{ ...inputStyle, paddingLeft: 28, width: 200 }}
            />
          </div>

          {/* Status filter */}
          <div className="ds-card" style={{ display: 'flex', alignItems: 'center', padding: 4, gap: 2 }}>
            {([
              ['all',    `Todas (${statusCounts.all})`],
              ['active', `Ativas (${statusCounts.active})`],
              ['paused', `Pausadas (${statusCounts.paused})`],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setStatusFilter(value)}
                style={{
                  padding: '5px 10px', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600,
                  background: statusFilter === value ? 'var(--accent-soft)' : 'transparent',
                  color: statusFilter === value ? 'var(--accent)' : 'var(--fg-muted)',
                  border: 'none', cursor: 'pointer', transition: 'all .15s',
                }}>
                {label}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="ds-card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px' }}>
            <Calendar size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <select value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ ...inputStyle, border: 'none', padding: 0, background: 'transparent' }}>
              <option value="7days">Últimos 7 dias</option>
              <option value="30days">Últimos 30 dias</option>
              <option value="90days">Últimos 90 dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={inputStyle} />
              <span style={{ color: 'var(--fg-muted)', fontSize: 12 }}>–</span>
              <input type="date" value={customEnd}   onChange={e => setCustomEnd(e.target.value)}   style={inputStyle} />
            </div>
          )}
        </div>
      </div>

      {/* Combined summary strip */}
      {(combined.spend > 0 || combined.impressions > 0) && (
        <div style={{
          display: 'flex', gap: 24, padding: '10px 18px',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Total combinado</span>
          {[
            { label: 'Investimento',  value: fmtBRL(combined.spend),          icon: DollarSign,       color: 'var(--accent)' },
            { label: 'Impressões',    value: fmtNum(combined.impressions),     icon: Eye,              color: '#6366f1' },
            { label: 'Cliques',       value: fmtNum(combined.clicks),          icon: MousePointerClick, color: '#f59e0b' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <item.icon size={13} style={{ color: item.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)', fontVariantNumeric: 'tabular-nums' }}>{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Stats cards: Meta + Google sempre visíveis ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Meta mini-stats */}
        <div className="ds-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Megaphone size={13} style={{ color: 'var(--fg-subtle)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Meta Ads</span>
            {!loadingMeta && metaCampaigns.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                · {metaRows.length}{metaRows.length !== metaCampaigns.length ? `/${metaCampaigns.length}` : ''} campanha{metaRows.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--border)' }}>
            {(metaStats ? [
              { label: 'Investido',  value: fmtBRL(metaStats.spend),               icon: DollarSign,        color: 'var(--af-600)' },
              { label: 'Impressões', value: fmtNum(metaStats.impressions),          icon: Eye,               color: '#6366f1' },
              { label: 'CTR Médio',  value: `${metaStats.avgCtr.toFixed(2)}%`,      icon: MousePointerClick, color: 'var(--yellow-600)' },
              { label: 'CPC Médio',  value: fmtBRL(metaStats.avgCpc),              icon: TrendingUp,        color: 'var(--green-600)' },
            ] : Array(4).fill(null)).map((s, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
                {s ? (
                  <>
                    <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <s.icon size={10} style={{ color: s.color }} />{s.label}
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
                  </>
                ) : (
                  <div style={{ height: 34, background: 'var(--bg-muted)', borderRadius: 4 }} className="animate-pulse" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Google mini-stats */}
        <div className="ds-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Megaphone size={13} style={{ color: 'var(--fg-subtle)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Google Ads</span>
            {!loadingGoogle && googleCampaigns.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                · {googleRows.length}{googleRows.length !== googleCampaigns.length ? `/${googleCampaigns.length}` : ''} campanha{googleRows.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--border)' }}>
            {(googleStats ? [
              { label: 'Investido',   value: fmtBRL(googleStats.spend),             icon: DollarSign,        color: 'var(--af-600)' },
              { label: 'Impressões',  value: fmtNum(googleStats.impressions),        icon: Eye,               color: '#6366f1' },
              { label: 'CTR Médio',   value: `${googleStats.avgCtr.toFixed(2)}%`,    icon: MousePointerClick, color: 'var(--yellow-600)' },
              { label: 'Conversões',  value: fmtNum(googleStats.conversions),        icon: ShoppingCart,      color: 'var(--green-600)' },
            ] : Array(4).fill(null)).map((s, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRight: i < 3 ? '1px solid var(--border)' : 'none' }}>
                {s ? (
                  <>
                    <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <s.icon size={10} style={{ color: s.color }} />{s.label}
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{s.value}</p>
                  </>
                ) : (
                  <div style={{ height: 34, background: 'var(--bg-muted)', borderRadius: 4 }} className="animate-pulse" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabela com tab Meta / Google ─────────────────────────────────── */}
      <div className="ds-card" style={{ overflow: 'hidden' }}>
        <div className="ds-card-head" style={{ gap: 12 }}>
          {/* Tab toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', padding: 3, gap: 2 }}>
            {(['meta', 'google'] as const).map(p => (
              <button key={p} type="button" onClick={() => setPlatform(p)}
                style={{
                  padding: '4px 14px', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600,
                  background: platform === p ? 'var(--bg-surface)' : 'transparent',
                  color: platform === p ? 'var(--fg-primary)' : 'var(--fg-muted)',
                  border: platform === p ? '1px solid var(--border)' : '1px solid transparent',
                  cursor: 'pointer', transition: 'all .15s', boxShadow: platform === p ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                }}>
                {p === 'meta' ? 'Meta Ads' : 'Google Ads'}
              </button>
            ))}
          </div>
        </div>

        {platform === 'meta' && (
          <>
            {metaError && <p style={{ margin: '12px 16px 0', padding: '8px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--red-100)', background: 'var(--red-50)', color: 'var(--red-700)', fontSize: 12 }}>{metaError}</p>}
            <CampaignTable rows={metaRows} loading={loadingMeta} cols={META_COLS} sortKey={metaSort} sortDir={metaSortDir} onSort={handleMetaSort} emptyText="Nenhuma campanha encontrada no período." />
          </>
        )}
        {platform === 'google' && (
          <>
            {googleError && <p style={{ margin: '12px 16px 0', padding: '8px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--red-100)', background: 'var(--red-50)', color: 'var(--red-700)', fontSize: 12 }}>{googleError}</p>}
            <CampaignTable rows={googleRows} loading={loadingGoogle} cols={GOOGLE_COLS} sortKey={googleSort} sortDir={googleSortDir} onSort={handleGoogleSort} emptyText="Nenhuma campanha Google Ads encontrada. Verifique a conexão em Configurações → Conexões." />
          </>
        )}
      </div>
    </div>
  );
};

export default CampaignsView;
