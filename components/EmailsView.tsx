import React, { useEffect, useMemo, useState } from 'react';
import {
  Mail, Search, ChevronDown, ChevronRight, RefreshCw,
  Send, Eye, MousePointerClick, TrendingDown, Loader2,
} from 'lucide-react';
import { DataService } from '../services/dataService';
import { EmailCampaign, WorkflowEmailStat } from '../types';

const fmt  = (n: number) => n.toLocaleString('pt-BR');
const rate = (n: number) => `${n.toFixed(1)}%`;

// ─── Rate badge ───────────────────────────────────────────────────────────────
const RateBadge: React.FC<{ value: number; good?: number; warn?: number }> = ({
  value, good = 25, warn = 15,
}) => {
  const color = value >= good
    ? 'var(--green-600)'
    : value >= warn
    ? 'var(--yellow-600)'
    : 'var(--red-500)';
  const bg = value >= good
    ? 'rgba(34,197,94,0.08)'
    : value >= warn
    ? 'rgba(234,179,8,0.08)'
    : 'rgba(239,68,68,0.08)';
  return (
    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 'var(--r-sm)', fontSize: 11, fontWeight: 600, color, background: bg }}>
      {rate(value)}
    </span>
  );
};

// ─── Sort button ──────────────────────────────────────────────────────────────
type WfKey = 'name' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed' | 'openedRate' | 'clickedRate';

const Th: React.FC<{
  label: string; col?: WfKey; active?: WfKey; dir?: 'asc' | 'desc';
  onSort?: (k: WfKey) => void; right?: boolean;
}> = ({ label, col, active, dir, onSort, right }) => (
  <th style={{ padding: '10px 14px', textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' }}>
    {col && onSort ? (
      <button type="button" onClick={() => onSort(col)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: active === col ? 'var(--fg-primary)' : 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        {label}
        <span style={{ opacity: active === col ? 1 : 0.3, fontSize: 10 }}>{active === col ? (dir === 'asc' ? '▲' : '▼') : '▲'}</span>
      </button>
    ) : (
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    )}
  </th>
);

// ─── Main component ───────────────────────────────────────────────────────────
const ITEMS = 15;

const EmailsView: React.FC = () => {
  const [campaigns,     setCampaigns]     = useState<EmailCampaign[]>([]);
  const [workflowStats, setWorkflowStats] = useState<WorkflowEmailStat[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [syncing,       setSyncing]       = useState(false);
  const [mode,          setMode]          = useState<'emails' | 'automation'>('emails');
  const [searchTerm,    setSearchTerm]    = useState('');
  const [emailPage,     setEmailPage]     = useState(1);
  const [autoPage,      setAutoPage]      = useState(1);
  const [expandedWf,    setExpandedWf]    = useState<string | null>(null);
  const [sortKey,       setSortKey]       = useState<WfKey>('delivered');
  const [sortDir,       setSortDir]       = useState<'asc' | 'desc'>('desc');
  const [dateRange,     setDateRange]     = useState('45');

  const { startDateStr, endDateStr } = useMemo(() => {
    const end = new Date(), start = new Date();
    start.setDate(end.getDate() - parseInt(dateRange));
    return { startDateStr: start.toISOString().split('T')[0], endDateStr: end.toISOString().split('T')[0] };
  }, [dateRange]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (mode === 'emails') {
          const data = await DataService.syncRdEmailCampaigns(startDateStr, endDateStr);
          setCampaigns(Array.isArray(data) ? data : []);
          setWorkflowStats([]);
        } else {
          const data = await DataService.syncRdWorkflowEmailStats(startDateStr, endDateStr);
          setWorkflowStats(Array.isArray(data) ? data : []);
          setCampaigns([]);
        }
      } catch { setCampaigns([]); setWorkflowStats([]); }
      finally { setLoading(false); }
    };
    load();
  }, [mode, startDateStr]);

  useEffect(() => { setEmailPage(1); setAutoPage(1); }, [mode, searchTerm]);

  const handleSync = async () => {
    setLoading(true);
    try {
      if (mode === 'automation') {
        const data = await DataService.syncRdWorkflowEmailStats(startDateStr, endDateStr);
        setWorkflowStats(Array.isArray(data) ? data : []);
      } else {
        const data = await DataService.syncRdEmailCampaigns(startDateStr, endDateStr);
        setCampaigns(Array.isArray(data) ? data : []);
      }
    } catch { /* noop */ }
    finally { setLoading(false); }
  };

  const handleSort = (key: WfKey) => {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return; }
    setSortKey(key); setSortDir('desc');
  };

  // ─── Email campaigns ──────────────────────────────────────────────────────
  const filteredCampaigns = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return campaigns
      .filter(c => c.name.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [campaigns, searchTerm]);

  const pagedCampaigns   = filteredCampaigns.slice((emailPage - 1) * ITEMS, emailPage * ITEMS);
  const totalEmailPages  = Math.max(1, Math.ceil(filteredCampaigns.length / ITEMS));

  const emailKpis = useMemo(() => {
    if (!campaigns.length) return null;
    const totalSends  = campaigns.reduce((s, c) => s + (c.sends  || 0), 0);
    const totalOpens  = campaigns.reduce((s, c) => s + (c.opens  || 0), 0);
    const totalClicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0);
    const totalBounce = campaigns.reduce((s, c) => s + (c.bounce || 0), 0);
    return {
      count: campaigns.length,
      totalSends,
      openRate:   totalSends > 0 ? (totalOpens  / totalSends) * 100 : 0,
      clickRate:  totalSends > 0 ? (totalClicks / totalSends) * 100 : 0,
      bounceRate: totalSends > 0 ? (totalBounce / totalSends) * 100 : 0,
    };
  }, [campaigns]);

  // ─── Automation workflows ─────────────────────────────────────────────────
  const groupedWorkflows = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const map = new Map<string, { name: string; items: WorkflowEmailStat[] }>();
    workflowStats.forEach(item => {
      const key = item.workflowName || 'Workflow';
      const g   = map.get(key) || { name: key, items: [] };
      g.items.push(item);
      map.set(key, g);
    });
    return Array.from(map.values()).map(g => {
      const t = g.items.reduce(
        (acc, i) => ({ delivered: acc.delivered + i.delivered, opened: acc.opened + i.opened, clicked: acc.clicked + i.clicked, bounced: acc.bounced + i.bounced, unsubscribed: acc.unsubscribed + i.unsubscribed }),
        { delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }
      );
      const base = t.delivered || 1;
      return { ...g, totals: t, rates: { openedRate: (t.opened / base) * 100, clickedRate: (t.clicked / base) * 100 } };
    }).filter(g => !q || g.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const d = sortDir === 'asc' ? 1 : -1;
        if (sortKey === 'name')        return a.name.localeCompare(b.name) * d;
        if (sortKey === 'openedRate')  return (a.rates.openedRate  - b.rates.openedRate)  * d;
        if (sortKey === 'clickedRate') return (a.rates.clickedRate - b.rates.clickedRate) * d;
        return ((a.totals[sortKey as keyof typeof a.totals] ?? 0) - (b.totals[sortKey as keyof typeof b.totals] ?? 0)) * d;
      });
  }, [workflowStats, sortKey, sortDir, searchTerm]);

  const pagedWorkflows  = groupedWorkflows.slice((autoPage - 1) * ITEMS, autoPage * ITEMS);
  const totalAutoPages  = Math.max(1, Math.ceil(groupedWorkflows.length / ITEMS));

  const autoKpis = useMemo(() => {
    if (!groupedWorkflows.length) return null;
    const totalDel   = groupedWorkflows.reduce((s, w) => s + w.totals.delivered, 0);
    const totalOpen  = groupedWorkflows.reduce((s, w) => s + w.totals.opened,    0);
    const totalClick = groupedWorkflows.reduce((s, w) => s + w.totals.clicked,   0);
    return {
      count: groupedWorkflows.length,
      totalDel,
      openRate:  totalDel > 0 ? (totalOpen  / totalDel) * 100 : 0,
      clickRate: totalDel > 0 ? (totalClick / totalDel) * 100 : 0,
    };
  }, [groupedWorkflows]);

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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>E-mails</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4, marginBottom: 0 }}>
            Disparos e fluxos sincronizados com o RD Station.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            {(['emails', 'automation'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)}
                style={{ padding: '5px 14px', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all .15s',
                  background: mode === m ? 'var(--accent)' : 'transparent',
                  color: mode === m ? 'white' : 'var(--fg-muted)',
                }}>
                {m === 'emails' ? 'Disparo de Email' : 'Fluxo de Email'}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...inputStyle }}>
            <RefreshCw size={12} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
            <select value={dateRange} onChange={e => setDateRange(e.target.value)}
              style={{ background: 'transparent', color: 'var(--fg-primary)', border: 'none', outline: 'none', cursor: 'pointer', fontSize: 12 }}>
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="45">45 dias</option>
              <option value="90">90 dias</option>
            </select>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)' }} />
            <input type="text" placeholder="Buscar..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 30, width: 180 }} />
          </div>

          {/* Manual refresh */}
          <button type="button" onClick={handleSync} disabled={loading}
            style={{ padding: 8, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.4 : 1 }}
            title="Atualizar agora">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI cards */}
      {!loading && (mode === 'emails' ? emailKpis : autoKpis) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {mode === 'emails' && emailKpis && (<>
            <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Disparos</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)', margin: '1px 0 0' }}>{emailKpis.count}</p>
              </div>
            </div>
            <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={16} style={{ color: '#818cf8' }} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Envios</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)', margin: '1px 0 0' }}>{fmt(emailKpis.totalSends)}</p>
              </div>
            </div>
            <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'rgba(251,146,60,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Eye size={16} style={{ color: '#fb923c' }} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Tx. Abertura</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: emailKpis.openRate >= 25 ? 'var(--green-600)' : emailKpis.openRate >= 15 ? 'var(--yellow-600)' : 'var(--red-500)', margin: '1px 0 0' }}>{rate(emailKpis.openRate)}</p>
              </div>
            </div>
            <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'rgba(52,211,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MousePointerClick size={16} style={{ color: 'var(--green-500)' }} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Tx. Clique</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)', margin: '1px 0 0' }}>{rate(emailKpis.clickRate)}</p>
              </div>
            </div>
          </>)}

          {mode === 'automation' && autoKpis && (<>
            <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Fluxos</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)', margin: '1px 0 0' }}>{autoKpis.count}</p>
              </div>
            </div>
            <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={16} style={{ color: '#818cf8' }} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Entregues</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)', margin: '1px 0 0' }}>{fmt(autoKpis.totalDel)}</p>
              </div>
            </div>
            <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'rgba(251,146,60,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Eye size={16} style={{ color: '#fb923c' }} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Tx. Abertura</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: autoKpis.openRate >= 25 ? 'var(--green-600)' : autoKpis.openRate >= 15 ? 'var(--yellow-600)' : 'var(--red-500)', margin: '1px 0 0' }}>{rate(autoKpis.openRate)}</p>
              </div>
            </div>
            <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'rgba(52,211,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MousePointerClick size={16} style={{ color: 'var(--green-500)' }} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Tx. Clique</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)', margin: '1px 0 0' }}>{rate(autoKpis.clickRate)}</p>
              </div>
            </div>
          </>)}
        </div>
      )}

      {/* Table card */}
      <div className="ds-card" style={{ overflow: 'hidden', padding: 0 }}>
        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)' }}>
              {mode === 'emails' ? 'Disparo de Email' : 'Fluxo de Email'}
            </span>
            {!loading && (
              <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
                · {mode === 'emails' ? filteredCampaigns.length : groupedWorkflows.length} {mode === 'emails' ? 'disparos' : 'fluxos'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: loading ? 'var(--yellow-500)' : 'var(--green-500)', display: 'inline-block' }} className={loading ? 'animate-pulse' : ''} />
            <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{loading ? 'Carregando...' : 'Sincronizado'}</span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--fg-muted)' }}>
            <RefreshCw size={20} className="animate-spin" />
            <p style={{ fontSize: 13, margin: 0 }}>Carregando dados...</p>
          </div>
        ) : mode === 'emails' ? (
          filteredCampaigns.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
              Nenhum disparo encontrado.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <Th label="Campanha" />
                      <Th label="Data" />
                      <Th label="Envios" right />
                      <Th label="Abertura" right />
                      <Th label="Tx. Abertura" right />
                      <Th label="Cliques" right />
                      <Th label="Tx. Clique" right />
                      <Th label="Bounce" right />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCampaigns.map(item => {
                      const openRate  = item.sends > 0 ? (item.opens  / item.sends) * 100 : 0;
                      const clickRate = item.sends > 0 ? (item.clicks / item.sends) * 100 : 0;
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }} className="hover:bg-white/[0.02] transition-colors">
                          <td style={{ padding: '10px 14px', maxWidth: 320 }}>
                            <p style={{ margin: 0, fontWeight: 600, color: 'var(--fg-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--fg-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>{item.date}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--fg-primary)', fontWeight: 600 }}>{fmt(item.sends)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--fg-muted)' }}>{fmt(item.opens)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}><RateBadge value={openRate} /></td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--fg-muted)' }}>{fmt(item.clicks)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}><RateBadge value={clickRate} good={3} warn={1} /></td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: item.bounce > 0 ? 'var(--red-500)' : 'var(--fg-muted)' }}>
                              {item.bounce > 0 && <TrendingDown size={11} />}
                              {fmt(item.bounce)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination page={emailPage} total={totalEmailPages} onPage={setEmailPage} count={filteredCampaigns.length} items={ITEMS} />
            </>
          )
        ) : (
          groupedWorkflows.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
              Nenhum fluxo encontrado.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <Th label="Fluxo"      col="name"          active={sortKey} dir={sortDir} onSort={handleSort} />
                      <Th label="Entregues"  col="delivered"     active={sortKey} dir={sortDir} onSort={handleSort} right />
                      <Th label="Aberturas"  col="opened"        active={sortKey} dir={sortDir} onSort={handleSort} right />
                      <Th label="Tx. Abert." col="openedRate"    active={sortKey} dir={sortDir} onSort={handleSort} right />
                      <Th label="Cliques"    col="clicked"       active={sortKey} dir={sortDir} onSort={handleSort} right />
                      <Th label="Tx. Clique" col="clickedRate"   active={sortKey} dir={sortDir} onSort={handleSort} right />
                      <Th label="Bounce"     col="bounced"       active={sortKey} dir={sortDir} onSort={handleSort} right />
                      <Th label="Descad."    col="unsubscribed"  active={sortKey} dir={sortDir} onSort={handleSort} right />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedWorkflows.map(wf => (
                      <React.Fragment key={wf.name}>
                        <tr style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                          className="hover:bg-white/[0.02] transition-colors"
                          onClick={() => setExpandedWf(prev => prev === wf.name ? null : wf.name)}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {expandedWf === wf.name
                                ? <ChevronDown size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                : <ChevronRight size={14} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />}
                              <span style={{ fontWeight: 600, color: 'var(--fg-primary)' }}>{wf.name}</span>
                              <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{wf.items.length} e-mails</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--fg-primary)' }}>{fmt(wf.totals.delivered)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--fg-muted)' }}>{fmt(wf.totals.opened)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}><RateBadge value={wf.rates.openedRate} /></td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--fg-muted)' }}>{fmt(wf.totals.clicked)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}><RateBadge value={wf.rates.clickedRate} good={3} warn={1} /></td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: wf.totals.bounced > 0 ? 'var(--red-500)' : 'var(--fg-muted)' }}>{fmt(wf.totals.bounced)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--fg-muted)' }}>{fmt(wf.totals.unsubscribed)}</td>
                        </tr>
                        {expandedWf === wf.name && (
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <td colSpan={8} style={{ padding: '0 0 0 40px', background: 'var(--bg-secondary)' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    {['E-mail', 'Entregues', 'Aberturas', 'Tx. Abert.', 'Cliques', 'Tx. Clique', 'Bounce', 'Descad.'].map((h, i) => (
                                      <th key={h} style={{ padding: '8px 14px', textAlign: i > 0 ? 'right' : 'left', fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {wf.items.map(item => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '8px 14px', color: 'var(--fg-primary)', fontWeight: 500 }}>{item.emailName}</td>
                                      <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--fg-muted)' }}>{fmt(item.delivered)}</td>
                                      <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--fg-muted)' }}>{fmt(item.opened)}</td>
                                      <td style={{ padding: '8px 14px', textAlign: 'right' }}><RateBadge value={item.openedRate} /></td>
                                      <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--fg-muted)' }}>{fmt(item.clicked)}</td>
                                      <td style={{ padding: '8px 14px', textAlign: 'right' }}><RateBadge value={item.clickedRate} good={3} warn={1} /></td>
                                      <td style={{ padding: '8px 14px', textAlign: 'right', color: item.bounced > 0 ? 'var(--red-500)' : 'var(--fg-muted)' }}>{fmt(item.bounced)}</td>
                                      <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--fg-muted)' }}>{fmt(item.unsubscribed)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={autoPage} total={totalAutoPages} onPage={setAutoPage} count={groupedWorkflows.length} items={ITEMS} />
            </>
          )
        )}
      </div>
    </div>
  );
};

// ─── Pagination ───────────────────────────────────────────────────────────────
const Pagination: React.FC<{ page: number; total: number; onPage: (p: number) => void; count: number; items: number }> = ({ page, total, onPage, count, items }) => {
  if (total <= 1) return null;
  const start = (page - 1) * items + 1;
  const end   = Math.min(page * items, count);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{start}–{end} de {count}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}
          style={{ padding: '4px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.3 : 1, fontSize: 12 }}>
          Anterior
        </button>
        <button type="button" onClick={() => onPage(Math.min(total, page + 1))} disabled={page === total}
          style={{ padding: '4px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', cursor: page === total ? 'not-allowed' : 'pointer', opacity: page === total ? 0.3 : 1, fontSize: 12 }}>
          Próxima
        </button>
      </div>
    </div>
  );
};

export default EmailsView;
