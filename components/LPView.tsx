import React, { useState, useEffect, useMemo } from 'react';
import { LandingPage } from '../types';
import { DataService } from '../services/dataService';
import {
  ExternalLink, Activity, Calendar, Search, RefreshCw,
  ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  MousePointerClick, Users, Clock,
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;
const HOST_FILTERS = [
  { value: 'all',  label: 'Todos os sites' },
  { value: 'lp',   label: 'Landing pages' },
  { value: 'site', label: 'Site' },
  { value: 'blog', label: 'Blog' },
] as const;

type SortKey = 'name' | 'users' | 'avgEngagementTime' | 'bounceRate' | 'totalClicks';

const parseTime = (timeStr: string | undefined): number => {
  if (!timeStr || timeStr === '-') return 0;
  const m = timeStr.match(/(\d+)m/);
  const s = timeStr.match(/(\d+)s/);
  return (m ? parseInt(m[1]) * 60 : 0) + (s ? parseInt(s[1]) : 0);
};

const formatSyncTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const SortBtn: React.FC<{
  col: SortKey; active: SortKey; dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void; label: string; right?: boolean;
}> = ({ col, active, dir, onSort, label, right }) => (
  <th style={{ padding: '10px 14px', textAlign: right ? 'right' : 'left' }}>
    <button
      type="button"
      onClick={() => onSort(col)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: active === col ? 'var(--fg-primary)' : 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      {label}
      {active !== col
        ? <ArrowUpDown size={10} style={{ opacity: 0.3 }} />
        : dir === 'asc' ? <ArrowUp size={10} style={{ color: 'var(--accent)' }} /> : <ArrowDown size={10} style={{ color: 'var(--accent)' }} />}
    </button>
  </th>
);

// ─── Main component ───────────────────────────────────────────────────────────
const LPView: React.FC = () => {
  const [pages, setPages]             = useState<LandingPage[]>([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey]         = useState<SortKey>('users');
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('desc');
  const [dateRange, setDateRange]     = useState('30days');
  const [hostFilter, setHostFilter]   = useState<(typeof HOST_FILTERS)[number]['value']>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    let s = '', e = end.toISOString().split('T')[0];
    if (dateRange === '7days')  { start.setDate(end.getDate() - 7);  s = start.toISOString().split('T')[0]; }
    if (dateRange === '30days') { start.setDate(end.getDate() - 30); s = start.toISOString().split('T')[0]; }
    if (dateRange === '90days') { start.setDate(end.getDate() - 90); s = start.toISOString().split('T')[0]; }
    if (dateRange === 'custom') { s = customStart; e = customEnd; }
    return { s, e };
  };

  const fetchData = async () => {
    const { s, e } = getDateRange();
    if (dateRange === 'custom' && (!s || !e)) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const data = await DataService.getLandingPagesGA(
        s,
        e,
        undefined,
        hostFilter,
        { throwOnError: true }
      );
      setPages(Array.isArray(data) ? data : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao buscar dados do Google Analytics.';
      setErrorMessage(message);
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateRange !== 'custom') fetchData();
    else if (customStart && customEnd) fetchData();
  }, [dateRange, customStart, customEnd, hostFilter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return; }
    setSortKey(key);
    setSortDir('desc');
  };

  const sorted = useMemo(() => {
    const filtered = pages.filter(p => {
      const q = searchTerm.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) || (p.path || '').toLowerCase().includes(q);
    });
    return [...filtered].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'name':              va = (a.name || a.path || '').toLowerCase(); vb = (b.name || b.path || '').toLowerCase(); break;
        case 'users':             va = a.users || 0;            vb = b.users || 0;            break;
        case 'avgEngagementTime': va = parseTime(a.avgEngagementTime); vb = parseTime(b.avgEngagementTime); break;
        case 'bounceRate':        va = a.bounceRate || 0;       vb = b.bounceRate || 0;       break;
        case 'totalClicks':       va = a.totalClicks || 0;      vb = b.totalClicks || 0;      break;
        default: return 0;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [pages, searchTerm, sortKey, sortDir]);

  const totalPagesCount = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginated = sorted.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const totalUsers  = pages.reduce((s, p) => s + (p.users || 0), 0);
  const totalEvents = pages.reduce((s, p) => s + (p.totalClicks || 0), 0);
  const avgBounce   = pages.length > 0 ? pages.reduce((s, p) => s + (p.bounceRate || 0), 0) / pages.length : 0;
  const isDatabaseCache = pages.some(p => p.dataOrigin === 'database_cache');
  const latestSyncAt = pages
    .map(p => p.lastSyncAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  const inputStyle: React.CSSProperties = {
    padding: '7px 12px', fontSize: 12, borderRadius: 'var(--r-md)',
    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
    color: 'var(--fg-primary)', outline: 'none',
  };

  return (
    <div style={{ padding: '24px 28px 64px', maxWidth: 1480, margin: '0 auto' }} className="space-y-6 animate-fade-in-up">

      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4, marginBottom: 0 }}>
            Google Analytics 4 · lp.autodromo.com.br, site.autoforce.com, blog.autoforce.com
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)' }} />
            <input
              type="text"
              placeholder="Buscar página..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ ...inputStyle, paddingLeft: 30, width: 200 }}
            />
          </div>

          {/* Host filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...inputStyle }}>
            <Activity size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <select value={hostFilter} onChange={e => { setHostFilter(e.target.value as typeof hostFilter); setCurrentPage(1); }}
              style={{ background: 'transparent', color: 'var(--fg-primary)', border: 'none', outline: 'none', cursor: 'pointer', fontSize: 12 }}>
              {HOST_FILTERS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>

          {/* Date range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...inputStyle }}>
            <Calendar size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <select value={dateRange} onChange={e => { setDateRange(e.target.value); setCurrentPage(1); }}
              style={{ background: 'transparent', color: 'var(--fg-primary)', border: 'none', outline: 'none', cursor: 'pointer', fontSize: 12 }}>
              <option value="7days">7 dias</option>
              <option value="30days">30 dias</option>
              <option value="90days">90 dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          {dateRange === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={inputStyle} />
              <span style={{ color: 'var(--fg-subtle)', fontSize: 12 }}>–</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={inputStyle} />
            </>
          )}

          <button type="button" onClick={fetchData} disabled={loading}
            style={{ padding: 8, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', opacity: loading ? 0.4 : 1 }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* GA4 summary cards */}
      {errorMessage && (
        <div className="ds-card" style={{ padding: '12px 14px', borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', color: 'var(--red-500)', fontSize: 12, lineHeight: 1.5 }}>
          {errorMessage}
        </div>
      )}

      {!loading && pages.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'rgba(251,146,60,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={16} style={{ color: '#fb923c' }} />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Páginas</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)', margin: '1px 0 0' }}>{pages.length}</p>
            </div>
          </div>
          <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Usuários</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)', margin: '1px 0 0' }}>{totalUsers.toLocaleString('pt-BR')}</p>
            </div>
          </div>
          <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MousePointerClick size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Eventos GA4</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)', margin: '1px 0 0' }}>{totalEvents.toLocaleString('pt-BR')}</p>
            </div>
          </div>
          <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: avgBounce > 50 ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} style={{ color: avgBounce > 50 ? 'var(--red-500)' : 'var(--green-500)' }} />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Bounce Médio</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: avgBounce > 50 ? 'var(--red-500)' : 'var(--fg-primary)', margin: '1px 0 0' }}>{avgBounce.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* GA4 Table */}
      <div className="ds-card" style={{ overflow: 'hidden', padding: 0 }}>
        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#E37400', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={11} style={{ color: 'white' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)' }}>Google Analytics 4</span>
            {!loading && sorted.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>· {sorted.length} páginas</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: loading ? 'var(--yellow-500)' : 'var(--green-500)', display: 'inline-block' }} className={loading ? 'animate-pulse' : ''} />
            <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
              {loading
                ? 'Sincronizando...'
                : isDatabaseCache
                  ? `Cache do banco${formatSyncTime(latestSyncAt) ? ` · último sync ${formatSyncTime(latestSyncAt)}` : ''}`
                  : `GA4 atualizado agora${formatSyncTime(latestSyncAt) ? ` · ${formatSyncTime(latestSyncAt)}` : ''}`}
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--fg-muted)' }}>
            <RefreshCw size={20} className="animate-spin" />
            <p style={{ fontSize: 13, margin: 0 }}>Buscando dados das páginas...</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <SortBtn col="name"              active={sortKey} dir={sortDir} onSort={handleSort} label="Página" />
                    <SortBtn col="users"             active={sortKey} dir={sortDir} onSort={handleSort} label="Usuários" right />
                    <SortBtn col="totalClicks"       active={sortKey} dir={sortDir} onSort={handleSort} label="Eventos" right />
                    <SortBtn col="avgEngagementTime" active={sortKey} dir={sortDir} onSort={handleSort} label="Tempo médio" right />
                    <SortBtn col="bounceRate"        active={sortKey} dir={sortDir} onSort={handleSort} label="Bounce" right />
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
                        Nenhuma página encontrada.
                      </td>
                    </tr>
                  ) : (
                    paginated.map(page => (
                      <tr key={page.id} style={{ borderBottom: '1px solid var(--border)' }}
                        className="hover:bg-white/[0.02] transition-colors">
                        <td style={{ padding: '10px 14px' }}>
                          <p style={{ margin: 0, fontWeight: 600, color: 'var(--fg-primary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }} title={page.name}>
                            {page.name || page.path}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, fontSize: 11, color: 'var(--accent)', overflow: 'hidden', maxWidth: 320 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.path}</span>
                            <ExternalLink size={9} style={{ flexShrink: 0 }} />
                          </div>
                          <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: page.dataOrigin === 'database_cache' ? 'rgba(234,179,8,0.12)' : 'rgba(34,197,94,0.12)', color: page.dataOrigin === 'database_cache' ? 'var(--yellow-500)' : 'var(--green-500)' }}>
                            {page.dataOrigin === 'database_cache' ? 'Cache do banco' : 'GA4 atualizado'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-primary)', fontWeight: 600 }}>
                          {(page.users || 0).toLocaleString('pt-BR')}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                            <MousePointerClick size={11} style={{ opacity: 0.4 }} />
                            {(page.totalClicks || 0).toLocaleString('pt-BR')}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--fg-muted)' }}>
                          {page.avgEngagementTime || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600,
                            background: (page.bounceRate || 0) > 50 ? 'rgba(239,68,68,0.1)' : 'transparent',
                            color: (page.bounceRate || 0) > 50 ? 'var(--red-500)' : 'var(--fg-muted)',
                          }}>
                            {page.bounceRate || 0}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPagesCount > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                  {paginated.length > 0 ? `${pageStart + 1}–${Math.min(pageStart + ITEMS_PER_PAGE, sorted.length)} de ${sorted.length}` : '0 resultados'}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    style={{ padding: 6, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.3 : 1 }}>
                    <ChevronLeft size={14} />
                  </button>
                  <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPagesCount, p + 1))} disabled={currentPage === totalPagesCount}
                    style={{ padding: 6, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', cursor: currentPage === totalPagesCount ? 'not-allowed' : 'pointer', opacity: currentPage === totalPagesCount ? 0.3 : 1 }}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LPView;
