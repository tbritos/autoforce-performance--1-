import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, RefreshCw, Download, Calendar,
  TrendingUp, DollarSign, Users, CheckCircle, Eye,
  MousePointerClick, Filter, ArrowDown, X, ChevronRight,
  Layers, ChevronUp, GripVertical, ArrowLeft, Info, Link2,
} from 'lucide-react';
import { FunnelStage } from '../types';
import { DataService } from '../services/dataService';
import {
  FunnelDef, FunnelStats, MetaCampaign, GoogleAdsCampaign,
  CumulativeStageKey, FunnelStageLeadsResult,
} from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelFormState {
  name:            string;
  description:     string;
  color:           string;
  leadTags:        string[];
  impressionPages: string[];
  campaignIds:     string[];
  stagesConfig:    FunnelStage[];
  filterCampaign:  string;
  filterLandingPage: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNIFIED_ID = '__unified__';

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#f97316', '#6366f1',
];

const STAGE_SOURCES: { value: string; label: string; color: string; icon: React.ElementType }[] = [
  { value: 'ga4_users',     label: 'GA4 - Usuários',          color: '#94a3b8', icon: Eye },
  { value: 'crm_LEAD',      label: 'Tag - Lead',              color: '#3b82f6', icon: Users },
  { value: 'crm_MQL',       label: 'CRM - MQL',               color: '#6366f1', icon: TrendingUp },
  { value: 'crm_SQL',       label: 'CRM - SQL',               color: '#818cf8', icon: Filter },
  { value: 'crm_SCHEDULED', label: 'CRM - Agendado',          color: '#f59e0b', icon: Calendar },
  { value: 'crm_DEMO',      label: 'CRM - Demo',              color: '#f97316', icon: MousePointerClick },
  { value: 'crm_PROPOSAL',  label: 'CRM - Proposta',          color: '#a855f7', icon: CheckCircle },
  { value: 'crm_CLIENT',    label: 'CRM - Cliente / Venda',   color: '#22c55e', icon: DollarSign },
  { value: 'crm_LOST',      label: 'CRM - Perdido',           color: '#ef4444', icon: X },
];

const STAGE_TEMPLATES: Record<string, FunnelStage[]> = {
  full: [
    { id: 'ts1', name: 'Usuários',     source: 'ga4_users',     color: '#94a3b8' },
    { id: 'ts2', name: 'Leads',        source: 'crm_LEAD',      color: '#3b82f6' },
    { id: 'ts3', name: 'MQLs',         source: 'crm_MQL',       color: '#6366f1' },
    { id: 'ts4', name: 'SQLs',         source: 'crm_SQL',       color: '#818cf8' },
    { id: 'ts5', name: 'Agendamentos', source: 'crm_SCHEDULED', color: '#f59e0b' },
    { id: 'ts6', name: 'Vendas',       source: 'crm_CLIENT',    color: '#22c55e' },
  ],
  commercial: [
    { id: 'ts3', name: 'SQLs',         source: 'crm_SQL',       color: '#818cf8' },
    { id: 'ts4', name: 'Agendamentos', source: 'crm_SCHEDULED', color: '#f59e0b' },
    { id: 'ts5', name: 'Demos',        source: 'crm_DEMO',      color: '#f97316' },
    { id: 'ts6', name: 'Propostas',    source: 'crm_PROPOSAL',  color: '#a855f7' },
    { id: 'ts7', name: 'Vendas',       source: 'crm_CLIENT',    color: '#22c55e' },
  ],
  simple: [
    { id: 'ts2', name: 'Leads',        source: 'crm_LEAD',      color: '#3b82f6' },
    { id: 'ts5', name: 'Agendamentos', source: 'crm_SCHEDULED', color: '#f59e0b' },
    { id: 'ts7', name: 'Vendas',       source: 'crm_CLIENT',    color: '#22c55e' },
  ],
  crm_only: [
    { id: 'ts2', name: 'Leads',        source: 'crm_LEAD',      color: '#3b82f6' },
    { id: 'ts3', name: 'MQLs',         source: 'crm_MQL',       color: '#6366f1' },
    { id: 'ts4', name: 'SQLs',         source: 'crm_SQL',       color: '#818cf8' },
    { id: 'ts5', name: 'Agendamentos', source: 'crm_SCHEDULED', color: '#f59e0b' },
    { id: 'ts6', name: 'Vendas',       source: 'crm_CLIENT',    color: '#22c55e' },
  ],
  ga4_only: [
    { id: 'ts1', name: 'Usuários',     source: 'ga4_users',     color: '#94a3b8' },
  ],
};

const getStageCount = (source: string, stats: FunnelStats | null): number => {
  if (!stats) return 0;
  if (source === 'ga4_users') return stats.gaUsers ?? 0;
  // LOST is a current-status snapshot (once lost, it stays lost) — no "ever reached" ambiguity.
  if (source === 'crm_LOST') return stats.funnelCounts?.LOST ?? 0;
  // Forward stages use the cumulative "ever reached" count — the current-status snapshot
  // (funnelCounts) would silently drop leads that advanced past this stage and were later lost.
  const status = source.replace('crm_', '') as CumulativeStageKey;
  return stats.everReachedCounts?.[status] ?? 0;
};

const STAGE_KEY_LABEL: Record<CumulativeStageKey, string> = {
  LEAD: 'Leads', MQL: 'MQLs', SQL: 'SQLs', SCHEDULED: 'Agendamentos',
  DEMO: 'Demos', PROPOSAL: 'Propostas', CLIENT: 'Vendas',
};

const STAGE_STATUS_META: Record<string, { label: string; color: string }> = {
  LEAD: { label: 'Lead', color: '#64748b' }, MQL: { label: 'MQL', color: '#6366f1' },
  SQL: { label: 'SQL', color: '#818cf8' }, SCHEDULED: { label: 'Agendado', color: '#f59e0b' },
  DEMO: { label: 'Demo', color: '#f97316' }, PROPOSAL: { label: 'Proposta', color: '#a855f7' },
  OPPORTUNITY: { label: 'Proposta', color: '#a855f7' }, CLIENT: { label: 'Cliente', color: '#22c55e' },
  LOST: { label: 'Perdido', color: '#ef4444' }, DISQUALIFIED: { label: 'Desqualificado', color: '#94a3b8' },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const emptyForm = (): FunnelFormState => ({
  name: '', description: '', color: '#3b82f6',
  leadTags: [], impressionPages: [], campaignIds: [],
  stagesConfig: [...STAGE_TEMPLATES.full.map(s => ({ ...s, id: `${Date.now()}_${s.id}` }))],
  filterCampaign: '', filterLandingPage: '',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function fmtNum(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
  return v.toLocaleString('pt-BR');
}

function convRate(n: number, d: number): string {
  if (!d) return '—';
  return `${((n / d) * 100).toFixed(1)}%`;
}

function fmtDelta(v: number): string {
  if (v === 0) return '0';
  const sign = v > 0 ? '+' : '-';
  return `${sign}${fmtNum(Math.abs(v))}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TooltipInfo: React.FC<{ text: string; position?: 'top' | 'bottom' }> = ({ text, position = 'bottom' }) => {
  const [show, setShow]     = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (iconRef.current) {
      const r = iconRef.current.getBoundingClientRect();
      setCoords({ x: r.left + r.width / 2, y: position === 'top' ? r.top : r.bottom });
    }
    setShow(true);
  };

  return (
    <span ref={iconRef} className="inline-flex items-center" onMouseEnter={handleMouseEnter} onMouseLeave={() => setShow(false)}>
      <Info size={11} style={{ color: 'var(--fg-subtle)', cursor: 'help', flexShrink: 0 }} />
      {show && createPortal(
        <span style={{
          position: 'fixed', zIndex: 9999, width: 260, borderRadius: 12,
          padding: '10px 12px', fontSize: 12, lineHeight: 1.5, pointerEvents: 'none',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          color: 'var(--fg-muted)', boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
          left: coords.x, transform: 'translateX(-50%)',
          ...(position === 'top'
            ? { bottom: window.innerHeight - coords.y + 8 }
            : { top: coords.y + 8 }),
        }}>
          {text}
        </span>,
        document.body
      )}
    </span>
  );
};

const KpiTile: React.FC<{
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string;
}> = ({ label, value, sub, icon: Icon, color }) => (
  <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
    <div style={{ width: 34, height: 34, borderRadius: 'var(--r-md)', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={15} style={{ color }} />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)', margin: 0, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--fg-muted)', margin: 0 }}>{sub}</p>}
    </div>
  </div>
);

// ─── Funnel selector sidebar ──────────────────────────────────────────────────

const FunnelSidebar: React.FC<{
  funnels:    FunnelDef[];
  selectedId: string;
  onSelect:   (id: string) => void;
  onNew:      () => void;
  onEdit:     (f: FunnelDef) => void;
  onDelete:   (id: string) => void;
  loading:    boolean;
}> = ({ funnels, selectedId, onSelect, onNew, onEdit, onDelete, loading }) => (
  <div style={{
    width: 220, flexShrink: 0,
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)', padding: '12px 8px',
    display: 'flex', flexDirection: 'column', gap: 2,
    alignSelf: 'flex-start', position: 'sticky', top: 24,
  }}>
    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '4px 8px 8px' }}>
      Funis
    </p>

    {/* Unified option */}
    <button
      type="button"
      onClick={() => onSelect(UNIFIED_ID)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 'var(--r-md)', width: '100%', textAlign: 'left',
        background: selectedId === UNIFIED_ID ? 'var(--accent-soft)' : 'transparent',
        border: 'none', cursor: 'pointer', transition: 'background .12s',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--fg-muted)', flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: selectedId === UNIFIED_ID ? 600 : 400, color: selectedId === UNIFIED_ID ? 'var(--accent)' : 'var(--fg-secondary)' }}>
        Unificado
      </span>
    </button>

    {loading && (
      <div style={{ padding: '8px 10px' }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ height: 28, background: 'var(--bg-muted)', borderRadius: 6, marginBottom: 4 }} className="animate-pulse" />
        ))}
      </div>
    )}

    {funnels.map(f => (
      <div
        key={f.id}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 4px 4px 10px',
          borderRadius: 'var(--r-md)',
          background: selectedId === f.id ? 'var(--accent-soft)' : 'transparent',
          transition: 'background .12s',
        }}
      >
        <button
          type="button"
          onClick={() => onSelect(f.id)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: selectedId === f.id ? 600 : 400, color: selectedId === f.id ? 'var(--accent)' : 'var(--fg-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {f.name}
          </span>
        </button>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button type="button" onClick={() => onEdit(f)} title="Editar"
            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', borderRadius: 4 }}>
            <Pencil size={11} />
          </button>
          <button type="button" onClick={() => onDelete(f.id)} title="Excluir"
            style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', borderRadius: 4 }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    ))}

    <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
      <button
        type="button"
        onClick={onNew}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '7px 10px', borderRadius: 'var(--r-md)',
          background: 'transparent', border: '1px dashed var(--border)',
          fontSize: 12, color: 'var(--fg-muted)', cursor: 'pointer',
          transition: 'all .12s',
        }}
      >
        <Plus size={13} /> Novo funil
      </button>
    </div>
  </div>
);

// ─── Funnel form panel ────────────────────────────────────────────────────────

// ─── Chip multi-value input ───────────────────────────────────────────────────

// ─── SelectPicker — dropdown com sugestões + chips ───────────────────────────

const SelectPicker: React.FC<{
  label:       string;
  placeholder: string;
  options:     string[];
  values:      string[];
  onChange:    (values: string[]) => void;
  allowNew?:   boolean;
  chipColor?:  string;
  labelFor?:   (value: string) => string;
}> = ({ label, placeholder, options, values, onChange, allowNew = true, chipColor = 'var(--accent)', labelFor = (v: string) => v }) => {
  const [search, setSearch]   = React.useState('');
  const [open,   setOpen]     = React.useState(false);
  const containerRef           = React.useRef<HTMLDivElement>(null);

  const filtered = options.filter(
    o => labelFor(o).toLowerCase().includes(search.toLowerCase()) && !values.includes(o)
  );
  const canCreate = allowNew && search.trim() && !options.includes(search.trim()) && !values.includes(search.trim());

  const add = (v: string) => {
    onChange([...values, v]);
    setSearch('');
  };

  const remove = (v: string) => onChange(values.filter(x => x !== v));

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && search.trim()) {
      e.preventDefault();
      if (filtered[0]) add(filtered[0]);
      else if (canCreate) add(search.trim());
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef}>
      <p style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500, margin: '0 0 6px' }}>{label}</p>

      {/* Selected chips */}
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {values.map(v => (
            <span key={v} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 'var(--r-full)',
              background: `${chipColor}18`, border: `1px solid ${chipColor}44`,
              fontSize: 11, color: chipColor, fontWeight: 500, maxWidth: '100%',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{labelFor(v)}</span>
              <button type="button" onClick={() => remove(v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: chipColor, padding: 0, lineHeight: 1, display: 'flex', flexShrink: 0 }}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '7px 10px', fontSize: 12, boxSizing: 'border-box',
            background: 'var(--bg-subtle)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--r-md)', color: 'var(--fg-primary)', outline: 'none',
            transition: 'border-color .15s',
          }}
        />

        {/* Dropdown */}
        {open && (filtered.length > 0 || canCreate) && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', boxShadow: '0 4px 16px rgba(0,0,0,.12)',
            maxHeight: 180, overflowY: 'auto',
          }}>
            {canCreate && (
              <button type="button" onMouseDown={() => add(search.trim())}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'var(--accent)', textAlign: 'left',
                  borderBottom: filtered.length ? '1px solid var(--border)' : 'none',
                }}>
                <Plus size={11} /> Criar "{search.trim()}"
              </button>
            )}
            {filtered.map(opt => (
              <button type="button" key={opt} onMouseDown={() => add(opt)}
                style={{
                  display: 'block', width: '100%', padding: '8px 12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'var(--fg-secondary)', textAlign: 'left',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {labelFor(opt)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Funnel Create Page (full-screen) ─────────────────────────────────────────

type DataMode = 'ga4_crm' | 'crm_only' | 'ga4_only';

const DATA_MODE_OPTIONS: { key: DataMode; title: string; desc: string; iconBg: string; iconText: string }[] = [
  { key: 'ga4_crm',   title: 'GA4 + CRM',   desc: 'Tráfego do GA4 + estágios do CRM (unificado)', iconBg: 'linear-gradient(135deg,#f97316,#3b82f6)', iconText: 'GA' },
  { key: 'crm_only',  title: 'Só CRM',      desc: 'Apenas estágios e status do Pipedrive',        iconBg: '#1e40af',                                 iconText: 'AF' },
  { key: 'ga4_only',  title: 'Só tráfego',  desc: 'Eventos e páginas do GA4',                    iconBg: '#16a34a',                                 iconText: 'G4' },
];

const DATA_MODE_TEMPLATE: Record<DataMode, keyof typeof STAGE_TEMPLATES> = {
  ga4_crm:  'full',
  crm_only: 'crm_only',
  ga4_only: 'ga4_only',
};

const FunnelCreatePage: React.FC<{
  initial: FunnelFormState;
  editId:  string | null;
  onSave:  (form: FunnelFormState) => Promise<void>;
  onClose: () => void;
  saving:  boolean;
}> = ({ initial, editId, onSave, onClose, saving }) => {
  const [form, setForm]           = useState<FunnelFormState>({ ...initial });
  const [dataMode, setDataMode]   = useState<DataMode>('ga4_crm');
  const [previewStats, setPreviewStats] = useState<FunnelStats | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [pages, setPages]         = useState<string[]>([]);
  const [allTags, setAllTags]     = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => { setForm({ ...initial }); }, [initial]);

  useEffect(() => {
    const end   = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    DataService.getFunnelStats(null, start, end).then(setPreviewStats).catch(() => {});
    DataService.getLandingPagesGA().then(ps => setPages(ps.map(p => p.path))).catch(() => {});
    DataService.getAllLeadTags().then(setAllTags).catch(() => {});
    Promise.all([
      DataService.getMetaCampaigns(start, end).catch(() => []),
      DataService.getGoogleAdsCampaigns(start, end).catch(() => []),
    ]).then(([meta, google]) => {
      setCampaigns([
        ...(Array.isArray(meta) ? meta : []).map((c: any) => ({ id: c.id, name: c.name })),
        ...(Array.isArray(google) ? google : []).map((c: any) => ({ id: c.id, name: c.name })),
      ]);
    });
  }, []);

  const campaignLabel = (id: string) => campaigns.find(c => c.id === id)?.name ?? id;

  const reorderStage = (from: number, to: number) => {
    setForm(f => {
      const next = [...f.stagesConfig];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...f, stagesConfig: next };
    });
  };

  const selectDataMode = (mode: DataMode) => {
    setDataMode(mode);
    const tKey = DATA_MODE_TEMPLATE[mode];
    const t = STAGE_TEMPLATES[tKey].map(s => ({ ...s, id: `s_${Date.now()}_${s.id}` }));
    setForm(f => ({ ...f, stagesConfig: t }));
  };

  const addStage = () => {
    const next: FunnelStage = { id: `s_${Date.now()}`, name: 'Nova etapa', source: 'crm_LEAD', color: '#3b82f6' };
    setForm(f => ({ ...f, stagesConfig: [...f.stagesConfig, next] }));
  };

  const updateStage = (id: string, patch: Partial<FunnelStage>) => {
    setForm(f => ({
      ...f,
      stagesConfig: f.stagesConfig.map(s =>
        s.id === id
          ? { ...s, ...patch, color: patch.source ? (STAGE_SOURCES.find(o => o.value === patch.source)?.color ?? s.color) : (patch.color ?? s.color) }
          : s
      ),
    }));
  };

  const removeStage = (id: string) =>
    setForm(f => ({ ...f, stagesConfig: f.stagesConfig.filter(s => s.id !== id) }));

  const applyTemplate = (key: keyof typeof STAGE_TEMPLATES) => {
    const t = STAGE_TEMPLATES[key].map(s => ({ ...s, id: `s_${Date.now()}_${s.id}` }));
    setForm(f => ({ ...f, stagesConfig: t }));
  };

  const iStyle: React.CSSProperties = {
    padding: '8px 12px', fontSize: 13, boxSizing: 'border-box',
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--fg-primary)', outline: 'none', width: '100%',
  };

  const sectionCard: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 12, overflow: 'hidden', marginBottom: 16,
  };
  const sectionHead: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 20px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg-muted)',
  };
  const sectionNum: React.CSSProperties = {
    width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)',
    color: 'white', fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg-app)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, padding: '12px 28px', flexShrink: 0 }}>
        <button type="button" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={14} /> Funil
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-primary)' }}>{editId ? 'Editar funil' : 'Novo funil'}</span>
          <span style={{ fontSize: 13, color: 'var(--fg-muted)', marginLeft: 10 }}>Configure as etapas e veja o preview ao lado.</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={onClose}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="button" onClick={() => onSave(form)} disabled={saving || !form.name.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving || !form.name.trim() ? 0.5 : 1 }}>
            <CheckCircle size={14} /> {saving ? 'Salvando...' : editId ? 'Salvar funil' : 'Criar funil'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, padding: '28px 28px 64px', maxWidth: 1060, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* Left: form */}
        <div>

          {/* Section 1 — Informações */}
          <div style={sectionCard}>
            <div style={sectionHead}>
              <span style={sectionNum}>1</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>Informações do funil</span>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Nome + cor */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Nome do funil</p>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Funil de aquisição — Site" style={iStyle} />
                </div>
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Cor</p>
                  <div style={{ display: 'flex', gap: 5, padding: '8px 0' }}>
                    {PALETTE.map(c => (
                      <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                        title={c}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                          border: form.color === c ? '2px solid var(--fg-primary)' : '2px solid transparent',
                          padding: 0, outline: form.color === c ? '2px solid var(--bg-surface)' : 'none', outlineOffset: -4,
                        }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Descrição <span style={{ fontWeight: 400, color: 'var(--fg-subtle)' }}>(opcional)</span></p>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Pra que serve esse funil, o que ele mede..." rows={2}
                  style={{ ...iStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              {/* Fonte de dados */}
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Fonte de dados principal</p>
                <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--fg-subtle)' }}>De onde o funil puxa os números de cada etapa.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {DATA_MODE_OPTIONS.map(opt => {
                    const selected = dataMode === opt.key;
                    return (
                      <button key={opt.key} type="button" onClick={() => selectDataMode(opt.key)}
                        style={{
                          position: 'relative', padding: '14px 14px 12px',
                          borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                          border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: selected ? 'var(--accent-soft)' : 'var(--bg-surface)',
                          display: 'flex', flexDirection: 'column', gap: 8,
                          transition: 'all .15s',
                        }}>
                        {selected && (
                          <div style={{ position: 'absolute', top: 10, right: 10, width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle size={10} color="white" strokeWidth={3} />
                          </div>
                        )}
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: opt.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: '-.02em' }}>{opt.iconText}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)', lineHeight: 1.2 }}>{opt.title}</span>
                        <span style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.4 }}>{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Escopo de leads */}
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Tags de lead</p>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--fg-subtle)' }}>
                  Define quais leads pertencem a este funil — um lead entra se tiver qualquer uma dessas tags. Se vazio, cai no filtro de campanha/página abaixo.
                </p>
                <SelectPicker
                  label="" placeholder="Buscar ou criar tag..."
                  options={allTags} values={form.leadTags}
                  onChange={v => setForm(f => ({ ...f, leadTags: v }))}
                  chipColor="#3b82f6"
                />
              </div>

              {/* Atribuição */}
              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Páginas de captura</p>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--fg-subtle)' }}>Páginas do GA4 cujo tráfego conta como "Usuários" deste funil.</p>
                <SelectPicker
                  label="" placeholder="Buscar página..."
                  options={pages} values={form.impressionPages}
                  onChange={v => setForm(f => ({ ...f, impressionPages: v }))}
                  allowNew={false} chipColor="#94a3b8"
                />
              </div>

              <div>
                <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Campanhas vinculadas</p>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--fg-subtle)' }}>Campanhas do Meta/Google Ads cujo investimento conta neste funil (KPI de Investimento/CPL/ROI).</p>
                <SelectPicker
                  label="" placeholder="Buscar campanha..."
                  options={campaigns.map(c => c.id)} values={form.campaignIds}
                  onChange={v => setForm(f => ({ ...f, campaignIds: v }))}
                  allowNew={false} chipColor="#f59e0b" labelFor={campaignLabel}
                />
              </div>

              {/* Filtro legado (fallback quando não há tags) */}
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>
                  Filtro por UTM <span style={{ fontWeight: 400, color: 'var(--fg-subtle)' }}>(usado só se não houver tags acima)</span>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <select value={form.filterCampaign} onChange={e => setForm(f => ({ ...f, filterCampaign: e.target.value }))}
                    style={{ ...iStyle, cursor: 'pointer' }}>
                    <option value="">Todas as campanhas (UTM)</option>
                    {/* value = nome da campanha, nao o ID: o lead grava o texto do utm_campaign, nao o ID numerico do Meta/Google Ads */}
                    {campaigns.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <select value={form.filterLandingPage} onChange={e => setForm(f => ({ ...f, filterLandingPage: e.target.value }))}
                    style={{ ...iStyle, cursor: 'pointer' }}>
                    <option value="">Todas as páginas (UTM)</option>
                    {pages.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 — Etapas */}
          <div style={sectionCard}>
            <div style={sectionHead}>
              <span style={sectionNum}>2</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>Etapas do funil</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg-muted)' }}>{form.stagesConfig.length} etapas</span>
            </div>
            <div style={{ padding: 20 }}>

              {/* Templates */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--fg-muted)' }}>Começar de um modelo</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { key: 'full',       label: '🎯 Aquisição completa' },
                    { key: 'commercial', label: '💼 Comercial (SQL→Venda)' },
                    { key: 'simple',     label: '⚡ Simples (3 etapas)' },
                  ].map(t => (
                    <button key={t.key} type="button" onClick={() => applyTemplate(t.key as keyof typeof STAGE_TEMPLATES)}
                      style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: 12, color: 'var(--fg-secondary)', cursor: 'pointer', fontWeight: 500 }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stage list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {form.stagesConfig.map((stage, i) => {
                  const src = STAGE_SOURCES.find(s => s.value === stage.source);
                  const StageIcon = src?.icon ?? Users;
                  const stageColor = src?.color ?? '#3b82f6';
                  return (
                    <div key={stage.id}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => { if (dragIndex !== null && dragIndex !== i) reorderStage(dragIndex, i); setDragIndex(null); }}
                      onDragEnd={() => setDragIndex(null)}
                      style={{
                        display: 'grid', gridTemplateColumns: '24px 34px 1fr auto 34px',
                        gap: 8, alignItems: 'center',
                        padding: '8px 10px',
                        background: 'var(--bg-subtle)', borderRadius: 10,
                        border: dragIndex === i ? '1px dashed var(--accent)' : '1px solid var(--border)',
                        opacity: dragIndex === i ? 0.4 : 1,
                      }}>
                      {/* Grip handle */}
                      <div style={{ display: 'flex', justifyContent: 'center', cursor: 'grab' }}>
                        <GripVertical size={14} style={{ color: 'var(--fg-subtle)' }} />
                      </div>

                      {/* Stage icon */}
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: stageColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <StageIcon size={13} color="white" />
                      </div>

                      {/* Stage name */}
                      <input value={stage.name} onChange={e => updateStage(stage.id, { name: e.target.value })}
                        placeholder="Nome da etapa"
                        style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)', width: '100%', padding: '2px 0' }} />

                      {/* Source select */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <Link2 size={11} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
                        <select value={stage.source} onChange={e => updateStage(stage.id, { source: e.target.value })}
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: 'var(--fg-secondary)', outline: 'none', cursor: 'pointer', minWidth: 160 }}>
                          {STAGE_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>

                      {/* Delete */}
                      <button type="button" onClick={() => removeStage(stage.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 6 }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#ef444418'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-subtle)'; e.currentTarget.style.background = 'none'; }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add stage */}
              <button type="button" onClick={addStage}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--fg-muted)'; }}>
                <Plus size={13} /> Adicionar etapa
              </button>
            </div>
          </div>
        </div>

        {/* Right: live preview */}
        <div style={{ position: 'sticky', top: 73, alignSelf: 'flex-start' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={13} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)' }}>Preview ao vivo</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>dados reais · 30d</span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {form.stagesConfig.map((stage, i) => {
                const count    = getStageCount(stage.source, previewStats);
                const prevCount = i > 0 ? getStageCount(form.stagesConfig[i - 1].source, previewStats) : 0;
                const rate     = i > 0 && prevCount > 0 ? ((count / prevCount) * 100).toFixed(0) + '%' : null;
                const maxCount = Math.max(...form.stagesConfig.map(s => getStageCount(s.source, previewStats)), 1);
                const pct      = Math.max((count / maxCount) * 100, 2);
                const color    = STAGE_SOURCES.find(s => s.value === stage.source)?.color ?? '#3b82f6';
                return (
                  <div key={stage.id}>
                    {rate && (
                      <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: '2px 0 2px 4px' }}>
                        | {rate} convertem
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--fg-secondary)', width: 80, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stage.name}
                      </span>
                      <div style={{ flex: 1, height: 22, background: 'var(--bg-muted)', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 5, display: 'flex', alignItems: 'center', paddingLeft: 7, boxSizing: 'border-box', transition: 'width .5s ease', minWidth: pct > 5 ? 'auto' : 0 }}>
                          {pct > 20 && <span style={{ fontSize: 11, fontWeight: 700, color: 'white', whiteSpace: 'nowrap' }}>{fmtNum(count)}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-primary)', width: 36, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtNum(count)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {form.stagesConfig.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--fg-muted)', textAlign: 'center', padding: '20px 0' }}>Adicione etapas para ver o preview.</p>
              )}
              {previewStats === null && form.stagesConfig.length > 0 && (
                <p style={{ fontSize: 11, color: 'var(--fg-subtle)', textAlign: 'center', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <RefreshCw size={10} className="animate-spin" /> Carregando...
                </p>
              )}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-muted)', display: 'flex', alignItems: 'flex-start', gap: 5, lineHeight: 1.4 }}>
                <Info size={11} style={{ marginTop: 1, flexShrink: 0, color: 'var(--accent)' }} />
                O preview usa os dados reais dos últimos 30 dias. Reordene ou edite as etapas para ver o impacto na hora.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Stage drill-down modal ────────────────────────────────────────────────────

const StageDrillDownModal: React.FC<{
  funnelId:  string | null;
  stage:     CumulativeStageKey;
  label:     string;
  startDate: string;
  endDate:   string;
  onClose:   () => void;
}> = ({ funnelId, stage, label, startDate, endDate, onClose }) => {
  const navigate = useNavigate();
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData]       = useState<FunnelStageLeadsResult | null>(null);
  const pageSize = 20;

  useEffect(() => { setPage(1); }, [funnelId, stage, startDate, endDate]);

  useEffect(() => {
    setLoading(true);
    DataService.getFunnelStageLeads(funnelId, stage, startDate, endDate, page, pageSize)
      .then(setData)
      .catch(() => setData({ total: 0, page: 1, pageSize, leads: [] }))
      .finally(() => setLoading(false));
  }, [funnelId, stage, startDate, endDate, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(760px, 100%)', maxHeight: '82vh', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--fg-primary)' }}>{label}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>
              {data ? `${data.total.toLocaleString('pt-BR')} lead${data.total !== 1 ? 's' : ''} que chegaram nesta etapa` : 'Carregando...'}
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
              Nenhum lead encontrado.
            </div>
          ) : (
            <div>
              {data.leads.map((lead, i) => {
                const meta = STAGE_STATUS_META[lead.status] ?? { label: lead.status, color: 'var(--fg-muted)' };
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
                    <span style={{ fontSize: 11, color: 'var(--fg-subtle)', width: 78, textAlign: 'right', flexShrink: 0 }}>
                      {fmtDate(lead.firstSeenAt)}
                    </span>
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
    </div>,
    document.body
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const FunnelView: React.FC = () => {
  // ── Funnel list state ──────────────────────────────────────────────────────
  const [funnels, setFunnels]         = useState<FunnelDef[]>([]);
  const [funnelsLoading, setFunnelsLoading] = useState(true);
  const [selectedId, setSelectedId]   = useState<string>(UNIFIED_ID);
  const [showForm, setShowForm]       = useState(false);
  const [editFunnel, setEditFunnel]   = useState<FunnelDef | null>(null);
  const [formSaving, setFormSaving]   = useState(false);

  // ── Stats state ────────────────────────────────────────────────────────────
  const [stats, setStats]             = useState<FunnelStats | null>(null);
  const [metaCampaigns, setMeta]      = useState<MetaCampaign[]>([]);
  const [googleCampaigns, setGoogle]  = useState<GoogleAdsCampaign[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [drillStage, setDrillStage]   = useState<CumulativeStageKey | null>(null);

  // ── Date range ─────────────────────────────────────────────────────────────
  const [dateRange, setDateRange]     = useState('30days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');

  const { startDate, endDate } = useMemo(() => {
    const end   = new Date();
    const start = new Date();
    if (dateRange === '7days')  start.setDate(end.getDate() - 7);
    if (dateRange === '30days') start.setDate(end.getDate() - 30);
    if (dateRange === '90days') start.setDate(end.getDate() - 90);
    return {
      startDate: dateRange === 'custom' ? customStart : start.toISOString().split('T')[0],
      endDate:   dateRange === 'custom' ? customEnd   : end.toISOString().split('T')[0],
    };
  }, [dateRange, customStart, customEnd]);

  // ── Load funnel list on mount ──────────────────────────────────────────────
  useEffect(() => {
    DataService.listFunnels()
      .then(list => setFunnels(list))
      .catch(err => console.error('Erro ao carregar funis:', err))
      .finally(() => setFunnelsLoading(false));
  }, []);

  // ── Load stats when selection or date range changes ────────────────────────
  const loadStats = useCallback(async () => {
    if (dateRange === 'custom' && (!customStart || !customEnd)) return;
    setStatsLoading(true);
    try {
      const funnelId = selectedId === UNIFIED_ID ? null : selectedId;

      const [s, meta, google] = await Promise.all([
        DataService.getFunnelStats(funnelId, startDate, endDate),
        DataService.getMetaCampaigns(startDate, endDate).catch(() => [] as MetaCampaign[]),
        DataService.getGoogleAdsCampaigns(startDate, endDate).catch(() => [] as GoogleAdsCampaign[]),
      ]);
      setStats(s);
      setMeta(Array.isArray(meta) ? meta : []);
      setGoogle(Array.isArray(google) ? google : []);
    } catch (err) {
      console.error('Erro ao carregar stats do funil:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedId, startDate, endDate, dateRange, customStart, customEnd]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ── Funnel CRUD handlers ───────────────────────────────────────────────────
  const handleOpenNew = () => { setEditFunnel(null); setShowForm(true); };

  const handleOpenEdit = (f: FunnelDef) => { setEditFunnel(f); setShowForm(true); };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este funil?')) return;
    await DataService.deleteFunnel(id);
    setFunnels(prev => prev.filter(f => f.id !== id));
    if (selectedId === id) setSelectedId(UNIFIED_ID);
  };

  const handleSave = async (form: FunnelFormState) => {
    setFormSaving(true);
    try {
      const payload = {
        name:              form.name.trim(),
        description:       form.description.trim() || undefined,
        color:             form.color,
        leadTags:          form.leadTags,
        impressionPages:   form.impressionPages,
        campaignIds:       form.campaignIds,
        stagesConfig:      form.stagesConfig,
        filterCampaign:    form.filterCampaign || undefined,
        filterLandingPage: form.filterLandingPage || undefined,
      };
      if (editFunnel) {
        const updated = await DataService.updateFunnel(editFunnel.id, payload);
        setFunnels(prev => prev.map(f => f.id === editFunnel.id ? updated : f));
      } else {
        const created = await DataService.createFunnel(payload);
        setFunnels(prev => [...prev, created]);
        setSelectedId(created.id);
      }
      setShowForm(false);
    } catch (err) {
      console.error('Erro ao salvar funil:', err);
    } finally {
      setFormSaving(false);
    }
  };

  // ── Computed values ────────────────────────────────────────────────────────
  const adSpend = useMemo(() =>
    metaCampaigns.reduce((s, c) => s + (c.spend || 0), 0) +
    googleCampaigns.reduce((s, c) => s + (c.spend || 0), 0),
  [metaCampaigns, googleCampaigns]);

  const fc  = stats?.funnelCounts;
  const erc = stats?.everReachedCounts;

  // Cumulative "ever reached" counts — computed on the backend from LeadStatusHistory so
  // leads that advanced past a stage and were later marked LOST still count at that stage.
  const totalLeads      = stats?.totalLeads ?? 0;
  const totalMQL        = erc?.MQL       ?? 0;
  const totalSQL        = erc?.SQL       ?? 0;
  const totalScheduled  = erc?.SCHEDULED ?? 0;
  const totalDemo       = erc?.DEMO      ?? 0;
  const totalProposal   = erc?.PROPOSAL  ?? 0;
  const totalClients    = erc?.CLIENT    ?? 0;

  // ── Active funnel meta (must come before funnelAdSpend) ───────────────────
  const activeFunnel = funnels.find(f => f.id === selectedId) ?? null;

  // adSpend for the selected custom funnel — filter loaded campaigns by the funnel's campaignIds
  const funnelAdSpend = useMemo(() => {
    if (selectedId === UNIFIED_ID || !activeFunnel?.campaignIds?.length) return 0;
    const ids = new Set(activeFunnel.campaignIds);
    return (
      metaCampaigns.filter(c => ids.has(c.id)).reduce((s, c) => s + (c.spend || 0), 0) +
      googleCampaigns.filter(c => ids.has(c.id)).reduce((s, c) => s + (c.spend || 0), 0)
    );
  }, [selectedId, activeFunnel, metaCampaigns, googleCampaigns]);

  const roi = adSpend > 0 ? (((stats?.mrr || 0) - adSpend) / adSpend) * 100 : 0;
  const cpl = totalLeads > 0 && adSpend > 0 ? adSpend / totalLeads : 0;

  const showUsersStage = selectedId === UNIFIED_ID || (activeFunnel?.impressionPages ?? []).length > 0;

  const funnelStages: Array<{
    key: string; label: string; count: number; color: string;
    icon: React.ElementType; stageKey?: CumulativeStageKey;
  }> = [
    ...(showUsersStage ? [{ key: 'users', label: 'Usuários', count: stats?.gaUsers ?? 0, color: '#cbd5e1', icon: Eye }] : []),
    { key: 'leads',       label: 'Leads',       count: totalLeads,             color: '#3b82f6', icon: Users,             stageKey: 'LEAD' as CumulativeStageKey },
    { key: 'mql',         label: 'MQLs',        count: totalMQL,               color: '#6366f1', icon: TrendingUp,        stageKey: 'MQL' as CumulativeStageKey },
    { key: 'sql',         label: 'SQLs',        count: totalSQL,               color: '#818cf8', icon: Filter,            stageKey: 'SQL' as CumulativeStageKey },
    { key: 'scheduled',   label: 'Agendamentos',count: totalScheduled,         color: '#f59e0b', icon: Calendar,          stageKey: 'SCHEDULED' as CumulativeStageKey },
    { key: 'demo',        label: 'Demos',       count: totalDemo,              color: '#f97316', icon: MousePointerClick, stageKey: 'DEMO' as CumulativeStageKey },
    { key: 'proposal',    label: 'Propostas',   count: totalProposal,          color: '#a855f7', icon: CheckCircle,       stageKey: 'PROPOSAL' as CumulativeStageKey },
    { key: 'clients',     label: 'Vendas',      count: totalClients,           color: '#22c55e', icon: DollarSign,        stageKey: 'CLIENT' as CumulativeStageKey },
  ];


  // ── CSV export ─────────────────────────────────────────────────────────────
  const handleExport = () => {
    const headers = ['Etapa', 'Volume', 'Taxa (vs anterior)'];
    const rows = funnelStages.map((s, i) => [
      s.label, s.count.toString(),
      i === 0 ? '100%' : convRate(s.count, funnelStages[i - 1].count),
    ]);
    const isUnified    = selectedId === UNIFIED_ID;
    const exportSpend  = isUnified ? adSpend : funnelAdSpend;
    const exportCpl    = totalLeads > 0 && exportSpend > 0 ? exportSpend / totalLeads : 0;
    const extra = [
      ['', '', ''],
      ['Investimento (Ads)', fmtBRL(exportSpend), ''],
      ['CPL', exportCpl > 0 ? fmtBRL(exportCpl) : '—', ''],
      ['MRR', fmtBRL(stats?.mrr || 0), ''],
      ...(isUnified ? [['ROI', `${roi.toFixed(1)}%`, '']] : [['Taxa L → V', convRate(totalClients, totalLeads), '']]),
    ];
    const csv = '﻿' + [headers, ...rows, ...extra].map(r => r.join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `funil-${endDate}.csv` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const formInitial: FunnelFormState = editFunnel ? {
    name:              editFunnel.name,
    description:       editFunnel.description || '',
    color:             editFunnel.color,
    leadTags:          editFunnel.leadTags        ?? [],
    impressionPages:   editFunnel.impressionPages ?? [],
    campaignIds:       editFunnel.campaignIds     ?? [],
    stagesConfig:      (editFunnel.stagesConfig as FunnelStage[] | null) ?? [...STAGE_TEMPLATES.full],
    filterCampaign:    editFunnel.filterCampaign    ?? '',
    filterLandingPage: editFunnel.filterLandingPage ?? '',
  } : emptyForm();

  return (
    <>
      {showForm && (
        <FunnelCreatePage
          initial={formInitial}
          editId={editFunnel?.id ?? null}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
          saving={formSaving}
        />
      )}

      {drillStage && (
        <StageDrillDownModal
          funnelId={selectedId === UNIFIED_ID ? null : selectedId}
          stage={drillStage}
          label={STAGE_KEY_LABEL[drillStage]}
          startDate={startDate}
          endDate={endDate}
          onClose={() => setDrillStage(null)}
        />
      )}

    <div style={{ padding: '24px 28px 64px', maxWidth: 1480, margin: '0 auto' }} className="animate-fade-in-up">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>Funil</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4 }}>
            Impressões e cliques via GA4 · Leads identificados por tag · Estágio pelo status do CRM
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Date range */}
          <div className="ds-card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px' }}>
            <Calendar size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <select value={dateRange} onChange={e => setDateRange(e.target.value)}
              style={{ background: 'transparent', border: 'none', fontSize: 12, color: 'var(--fg-primary)', outline: 'none', cursor: 'pointer' }}>
              <option value="7days">Últimos 7 dias</option>
              <option value="30days">Últimos 30 dias</option>
              <option value="90days">Últimos 90 dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          {dateRange === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--fg-primary)', borderRadius: 'var(--r-md)', padding: '6px 8px', fontSize: 12, outline: 'none' }} />
              <span style={{ color: 'var(--fg-subtle)' }}>–</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--fg-primary)', borderRadius: 'var(--r-md)', padding: '6px 8px', fontSize: 12, outline: 'none' }} />
            </div>
          )}
          <button type="button" onClick={loadStats} disabled={statsLoading}
            style={{ padding: 8, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer' }}>
            <RefreshCw size={14} className={statsLoading ? 'animate-spin' : ''} />
          </button>
          <button type="button" onClick={handleExport}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', fontSize: 12, color: 'var(--fg-muted)', cursor: 'pointer' }}>
            <Download size={13} /> CSV
          </button>
        </div>
      </div>

      {/* Body: sidebar + content + form */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Sidebar */}
        <FunnelSidebar
          funnels={funnels}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNew={handleOpenNew}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
          loading={funnelsLoading}
        />

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Active funnel title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeFunnel && (
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: activeFunnel.color, flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-primary)' }}>
                {selectedId === UNIFIED_ID ? 'Todos os funis (Unificado)' : activeFunnel?.name ?? ''}
              </span>
              {activeFunnel && (() => {
                const parts: string[] = [];
                if (activeFunnel.description)                parts.push(activeFunnel.description);
                if ((activeFunnel.leadTags ?? []).length)    parts.push(`${activeFunnel.leadTags.length} tag${activeFunnel.leadTags.length > 1 ? 's' : ''}`);
                if ((activeFunnel.impressionPages ?? []).length) parts.push(`${activeFunnel.impressionPages.length} pág${activeFunnel.impressionPages.length > 1 ? 's' : ''}`);
                if ((activeFunnel.campaignIds ?? []).length) parts.push(`${activeFunnel.campaignIds.length} campanha${activeFunnel.campaignIds.length > 1 ? 's' : ''}`);
                return parts.length > 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {parts.join(' · ')}
                  </p>
                ) : null;
              })()}
            </div>
          </div>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {selectedId === UNIFIED_ID ? (
              <>
                <KpiTile label="Investimento (Ads)" value={fmtBRL(adSpend)}             sub="Meta + Google"       icon={DollarSign}  color="#3b82f6" />
                <KpiTile label="CPL"                value={cpl > 0 ? fmtBRL(cpl) : '—'} sub="por lead gerado"    icon={Users}       color="#818cf8" />
                <KpiTile label="MRR"                value={fmtBRL(stats?.mrr || 0)}     sub="receita recorrente"  icon={TrendingUp}  color="#22c55e" />
                <KpiTile label="ROI"                value={`${roi.toFixed(1)}%`}         sub="(MRR − Ads) / Ads"  icon={CheckCircle} color={roi >= 0 ? '#22c55e' : '#ef4444'} />
              </>
            ) : (
              <>
                <KpiTile label="Investimento"  value={funnelAdSpend > 0 ? fmtBRL(funnelAdSpend) : '—'}   sub={activeFunnel?.campaignIds?.length ? `${activeFunnel.campaignIds.length} campanha${activeFunnel.campaignIds.length > 1 ? 's' : ''}` : 'sem campanhas vinculadas'} icon={DollarSign}  color="#3b82f6" />
                <KpiTile label="CPL"           value={funnelAdSpend > 0 && totalLeads > 0 ? fmtBRL(funnelAdSpend / totalLeads) : '—'} sub="por lead gerado"   icon={Users}       color="#818cf8" />
                <KpiTile label="MRR"           value={fmtBRL(stats?.mrr || 0)}                        sub="receita recorrente"  icon={TrendingUp}  color="#22c55e" />
                <KpiTile label="Taxa L → V"    value={convRate(totalClients, totalLeads)}              sub="leads para vendas"   icon={CheckCircle} color="#a855f7" />
              </>
            )}
          </div>

          {/* Funnel stages visualization */}
          <div className="ds-card">
            <div className="ds-card-head">
              <span className="ttl" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Layers size={14} className="ico" /> Funil de Conversão
                <TooltipInfo text="Quantos leads do período JÁ CHEGARAM em cada etapa em algum momento — mesmo que hoje estejam em outro status ou tenham sido marcados como Perdido depois. Por isso os números não batem com a Distribuição por Status, que mostra o status atual." />
              </span>
            </div>
            <div style={{ padding: '16px 20px 20px' }}>
              {statsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 100, height: 14, background: 'var(--bg-muted)', borderRadius: 4 }} className="animate-pulse" />
                      <div style={{ flex: 1, height: 32, background: 'var(--bg-muted)', borderRadius: 8 }} className="animate-pulse" />
                      <div style={{ width: 48, height: 14, background: 'var(--bg-muted)', borderRadius: 4 }} className="animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : totalLeads === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '32px 20px', color: 'var(--fg-subtle)' }}>
                  <Layers size={32} style={{ opacity: 0.25 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-muted)', margin: 0 }}>
                    {selectedId === UNIFIED_ID ? 'Nenhum lead encontrado no período' : 'Este funil ainda não tem leads'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: 0, textAlign: 'center', maxWidth: 280 }}>
                    {selectedId === UNIFIED_ID
                      ? 'Tente ampliar o período ou verifique as integrações de captura.'
                      : 'Configure as tags de identificação e aguarde novos leads chegarem, ou ajuste o período selecionado.'}
                  </p>
                  {selectedId !== UNIFIED_ID && (
                    <button type="button" onClick={() => { setEditFunnel(funnels.find(f => f.id === selectedId) ?? null); setShowForm(true); }}
                      style={{ marginTop: 4, padding: '6px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', fontSize: 12, color: 'var(--fg-muted)', cursor: 'pointer' }}>
                      Editar funil
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {(() => {
                    // "% do pico" — every stage relative to the single biggest stage shown.
                    const peak = Math.max(...funnelStages.map(s => s.count), 1);

                    // Bar WIDTH uses a tiered local scale instead of one global max: a big drop
                    // between consecutive stages (e.g. Leads → MQL) starts a new tier, so a long
                    // tail of similar-magnitude stages (MQL..Vendas, all in the low hundreds)
                    // stays visually readable instead of rendering as near-invisible slivers next
                    // to a much bigger top-of-funnel number.
                    const tierStarts: number[] = [0];
                    funnelStages.forEach((s, idx) => {
                      if (idx === 0) return;
                      const prevCount = funnelStages[idx - 1].count;
                      const ratio = prevCount > 0 ? s.count / prevCount : 1;
                      if (ratio < 0.3) tierStarts.push(idx);
                    });
                    const tierMaxes: number[] = new Array(funnelStages.length).fill(1);
                    tierStarts.forEach((start, i) => {
                      const end = i + 1 < tierStarts.length ? tierStarts[i + 1] : funnelStages.length;
                      const tMax = Math.max(...funnelStages.slice(start, end).map(s => s.count), 1);
                      for (let j = start; j < end; j++) tierMaxes[j] = tMax;
                    });

                    // The first one or two stages (traffic → leads) render as a funnel taper —
                    // a trapezoid narrowing into a full triangle — everything after is a plain bar.
                    const trapezoidIndex = showUsersStage ? 0 : -1;
                    const triangleIndex  = showUsersStage ? 1 : 0;

                    return funnelStages.map((stage, i) => {
                      const prev      = i > 0 ? funnelStages[i - 1] : null;
                      const pctOfPeakNum = (stage.count / peak) * 100;
                      // Below 10% show one decimal — MQL/SQL/Demo/etc. are often all within a point
                      // of each other (e.g. 2.5% vs 2.4%) and would be indistinguishable rounded to an integer.
                      const pctOfPeak = pctOfPeakNum < 10 ? pctOfPeakNum.toFixed(1) : Math.round(pctOfPeakNum).toString();
                      const widthPct  = Math.max(4, Math.round((stage.count / tierMaxes[i]) * 100));
                      const rate      = prev ? convRate(stage.count, prev.count) : null;
                      const delta     = prev ? stage.count - prev.count : null;
                      const rateNum   = prev && prev.count > 0 ? (stage.count / prev.count) * 100 : null;
                      const rateColor = rateNum === null ? 'var(--fg-muted)' : rateNum >= 70 ? '#22c55e' : rateNum >= 30 ? '#f59e0b' : '#ef4444';
                      const Icon      = stage.icon;
                      const clickable = !!stage.stageKey && stage.count > 0;
                      // Symmetric tapers (inset equally from both sides) — bars are centered,
                      // so each stage narrows toward the same central axis as the one below it.
                      const clipPath  = i === trapezoidIndex
                        ? 'polygon(0% 0%, 100% 0%, 92.5% 100%, 7.5% 100%)'
                        : i === triangleIndex
                          ? 'polygon(0% 0%, 100% 0%, 50% 100%)'
                          : undefined;

                      return (
                        <div key={stage.key}>
                          {rate && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '5px 0' }}>
                              <div style={{ width: 152, flexShrink: 0 }} />
                              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                  padding: '3px 10px', borderRadius: 999, background: 'var(--bg-muted)', fontSize: 11,
                                }}>
                                  <ArrowDown size={10} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
                                  <span style={{ fontWeight: 700, color: rateColor }}>{rate}</span>
                                  <span style={{ color: 'var(--fg-subtle)' }}>convertem</span>
                                  <span style={{ color: 'var(--fg-subtle)' }}>·</span>
                                  <span style={{ color: 'var(--fg-muted)' }}>{fmtDelta(delta!)}</span>
                                </span>
                              </div>
                              <div style={{ width: 64, flexShrink: 0 }} />
                            </div>
                          )}
                          <div
                            onClick={clickable ? () => setDrillStage(stage.stageKey!) : undefined}
                            title={clickable ? `Ver leads que chegaram em ${stage.label}` : undefined}
                            style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: clickable ? 'pointer' : 'default', borderRadius: 10, padding: '4px 6px', margin: '-4px -6px', transition: 'background .12s' }}
                            onMouseEnter={clickable ? e => (e.currentTarget.style.background = 'var(--bg-hover)') : undefined}
                            onMouseLeave={clickable ? e => (e.currentTarget.style.background = 'transparent') : undefined}
                          >
                            <div style={{ width: 152, flexShrink: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 30, height: 30, borderRadius: 9, background: stage.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Icon size={14} color="white" />
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)' }}>{stage.label}</span>
                              </div>
                              <p style={{ margin: '2px 0 0 38px', fontSize: 11, color: 'var(--fg-subtle)' }}>{pctOfPeak}% do pico</p>
                            </div>

                            <div style={{ flex: 1, height: 44, position: 'relative' }}>
                              <div style={{
                                position: 'absolute', top: 0, bottom: 0, left: '50%',
                                width: `${widthPct}%`, transform: 'translateX(-50%)',
                                background: stage.color, clipPath, borderRadius: clipPath ? 0 : 9,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'width .7s ease',
                              }}>
                                {widthPct > 15 && <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{fmtNum(stage.count)}</span>}
                              </div>
                            </div>

                            <div style={{ width: 64, textAlign: 'right', flexShrink: 0 }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(stage.count)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* CRM status distribution */}
          {fc && !statsLoading && (
            <div className="ds-card">
              <div className="ds-card-head">
                <span className="ttl" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Users size={14} className="ico" /> Distribuição por Status (CRM)
                  <TooltipInfo text="Status ATUAL de cada lead do período — uma foto de agora. Um lead que passou por MQL/SQL e depois foi Perdido aparece só em 'Perdido' aqui, mesmo já tendo contado nessas etapas no Funil de Conversão acima." />
                </span>
              </div>
              <div style={{ padding: '14px 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
                {([
                  { key: 'LEAD',         label: 'Lead',           color: '#64748b' },
                  { key: 'MQL',          label: 'MQL',            color: '#6366f1' },
                  { key: 'SQL',          label: 'SQL',            color: '#818cf8' },
                  { key: 'SCHEDULED',    label: 'Agendado',       color: '#f59e0b' },
                  { key: 'DEMO',         label: 'Demo',           color: '#f97316' },
                  { key: 'PROPOSAL',     label: 'Proposta',       color: '#a855f7' },
                  { key: 'CLIENT',       label: 'Cliente',        color: '#22c55e' },
                  { key: 'LOST',         label: 'Perdido',        color: '#ef4444' },
                  { key: 'DISQUALIFIED', label: 'Desqualificado', color: '#94a3b8' },
                ] as const).map(s => (
                  <div key={s.key} style={{ background: `${s.color}12`, border: `1px solid ${s.color}30`, borderRadius: 'var(--r-md)', padding: '10px 12px', textAlign: 'center' }}>
                    <p style={{ fontSize: 22, fontWeight: 700, color: s.color, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                      {(fc[s.key] || 0).toLocaleString('pt-BR')}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--fg-muted)', margin: 0 }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ad platform breakdowns */}
          {(() => {
            const funnelCampaignIds = selectedId !== UNIFIED_ID && activeFunnel?.campaignIds?.length
              ? new Set(activeFunnel.campaignIds)
              : null;
            const visibleMeta   = funnelCampaignIds
              ? metaCampaigns.filter(c => funnelCampaignIds.has(c.id))
              : metaCampaigns;
            const visibleGoogle = funnelCampaignIds
              ? googleCampaigns.filter(c => funnelCampaignIds.has(c.id))
              : googleCampaigns;
            if (!visibleMeta.length && !visibleGoogle.length) return null;
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {visibleMeta.length > 0 && (
                  <div className="ds-card">
                    <div className="ds-card-head"><span className="ttl">Meta Ads</span></div>
                    <div style={{ padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: 'Investimento', value: fmtBRL(visibleMeta.reduce((s, c) => s + c.spend, 0)) },
                        { label: 'Impressões',   value: fmtNum(visibleMeta.reduce((s, c) => s + c.impressions, 0)) },
                        { label: 'Cliques',      value: fmtNum(visibleMeta.reduce((s, c) => s + c.clicks, 0)) },
                        { label: 'CTR médio',    value: `${(visibleMeta.reduce((s, c) => s + c.ctr, 0) / visibleMeta.length).toFixed(2)}%` },
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'var(--fg-muted)' }}>{row.label}</span>
                          <span style={{ fontWeight: 600, color: 'var(--fg-primary)' }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {visibleGoogle.length > 0 && (
                  <div className="ds-card">
                    <div className="ds-card-head"><span className="ttl">Google Ads</span></div>
                    <div style={{ padding: '12px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: 'Investimento', value: fmtBRL(visibleGoogle.reduce((s, c) => s + c.spend, 0)) },
                        { label: 'Impressões',   value: fmtNum(visibleGoogle.reduce((s, c) => s + c.impressions, 0)) },
                        { label: 'Cliques',      value: fmtNum(visibleGoogle.reduce((s, c) => s + c.clicks, 0)) },
                        { label: 'Conversões',   value: fmtNum(visibleGoogle.reduce((s, c) => s + c.conversions, 0)) },
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: 'var(--fg-muted)' }}>{row.label}</span>
                          <span style={{ fontWeight: 600, color: 'var(--fg-primary)' }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

      </div>

    </div>
    </>
  );
};

export default FunnelView;
