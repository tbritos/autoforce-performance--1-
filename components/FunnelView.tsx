import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, RefreshCw, Download, Calendar,
  TrendingUp, DollarSign, Users, CheckCircle, Eye,
  MousePointerClick, Filter, ArrowDown, X, ChevronRight,
  Layers,
} from 'lucide-react';
import { DataService } from '../services/dataService';
import {
  FunnelDef, FunnelStats, MetaCampaign, GoogleAdsCampaign,
} from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelFormState {
  name:            string;
  description:     string;
  color:           string;
  leadTags:        string[];
  impressionPages: string[];
  campaignIds:     string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNIFIED_ID = '__unified__';

const PALETTE = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#f97316', '#6366f1',
];

const emptyForm = (): FunnelFormState => ({
  name: '', description: '', color: '#3b82f6',
  leadTags: [], impressionPages: [], campaignIds: [],
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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
}> = ({ label, placeholder, options, values, onChange, allowNew = true, chipColor = 'var(--accent)' }) => {
  const [search, setSearch]   = React.useState('');
  const [open,   setOpen]     = React.useState(false);
  const containerRef           = React.useRef<HTMLDivElement>(null);

  const filtered = options.filter(
    o => o.toLowerCase().includes(search.toLowerCase()) && !values.includes(o)
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
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{v}</span>
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
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Funnel form panel ────────────────────────────────────────────────────────

const FunnelFormPanel: React.FC<{
  initial:    FunnelFormState;
  editId:     string | null;
  onSave:     (form: FunnelFormState) => Promise<void>;
  onClose:    () => void;
  saving:     boolean;
}> = ({ initial, editId, onSave, onClose, saving }) => {
  const [form, setForm] = useState<FunnelFormState>(initial);
  const setText = (k: 'name' | 'description') => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const [allTags,      setAllTags]      = useState<string[]>([]);
  const [allPages,     setAllPages]     = useState<string[]>([]);
  const [campaigns,       setCampaigns]       = useState<{ id: string; name: string; platform: string }[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignSearch,   setCampaignSearch]   = useState('');

  useEffect(() => { setForm(initial); }, [initial]);

  useEffect(() => {
    DataService.getAllLeadTags().then(setAllTags).catch(() => {});
    DataService.getLandingPagesGA()
      .then(pages => setAllPages(pages.map(p => p.path)))
      .catch(() => {});

    // Load campaigns from Meta + Google APIs (last 365 days to include paused ones)
    setCampaignsLoading(true);
    const end   = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    Promise.all([
      DataService.getMetaCampaigns(start, end).catch(() => []),
      DataService.getGoogleAdsCampaigns(start, end).catch(() => []),
    ]).then(([meta, google]) => {
      const metaList   = (Array.isArray(meta)   ? meta   : []).map(c => ({ id: c.id, name: c.name, platform: 'Meta' }));
      const googleList = (Array.isArray(google) ? google : []).map(c => ({ id: c.id, name: c.name, platform: 'Google' }));
      setCampaigns([...metaList, ...googleList]);
    }).finally(() => setCampaignsLoading(false));
  }, []);

  const iStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', fontSize: 12, boxSizing: 'border-box',
    background: 'var(--bg-subtle)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)', color: 'var(--fg-primary)', outline: 'none',
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'var(--fg-subtle)',
    textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px',
  };

  return (
    <div style={{
      width: 320, flexShrink: 0,
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      display: 'flex', flexDirection: 'column',
      alignSelf: 'flex-start', position: 'sticky', top: 24,
      maxHeight: 'calc(100vh - 80px)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>
          {editId ? 'Editar funil' : 'Novo funil'}
        </p>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)' }}>
          <X size={15} />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>

        {/* Nome + Descrição */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500, margin: '0 0 4px' }}>Nome *</p>
            <input style={iStyle} value={form.name} onChange={setText('name')} placeholder="Ex: Ebook Máquina de Vendas" />
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500, margin: '0 0 4px' }}>Descrição</p>
            <input style={iStyle} value={form.description} onChange={setText('description')} placeholder="Opcional" />
          </div>
        </div>

        {/* Cor */}
        <div>
          <p style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500, margin: '0 0 6px' }}>Cor</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PALETTE.map(c => (
              <button key={c} type="button" onClick={() => setForm(prev => ({ ...prev, color: c }))}
                style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: form.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
            ))}
          </div>
        </div>

        {/* Segmentação */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={sectionTitle}>Segmentação</p>

          <SelectPicker
            label="Tags de identificação"
            placeholder="Buscar ou criar tag..."
            options={allTags}
            values={form.leadTags}
            onChange={v => setForm(prev => ({ ...prev, leadTags: v }))}
            chipColor="var(--accent)"
          />

          <SelectPicker
            label="Páginas GA4 (impressões)"
            placeholder="Buscar página..."
            options={allPages}
            values={form.impressionPages}
            onChange={v => setForm(prev => ({ ...prev, impressionPages: v }))}
            allowNew={false}
            chipColor="#06b6d4"
          />
        </div>

        {/* Campanhas */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={sectionTitle}>Campanhas (investimento)</p>
          <input
            value={campaignSearch}
            onChange={e => setCampaignSearch(e.target.value)}
            placeholder="Filtrar campanhas..."
            style={iStyle}
          />
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {campaigns
              .filter(c => c.name.toLowerCase().includes(campaignSearch.toLowerCase()))
              .map(c => {
                const checked = form.campaignIds.includes(c.id);
                return (
                  <label key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                    borderRadius: 'var(--r-md)', cursor: 'pointer',
                    background: checked ? 'var(--accent-soft)' : 'transparent',
                  }}>
                    <input type="checkbox" checked={checked}
                      onChange={() => setForm(prev => ({
                        ...prev,
                        campaignIds: checked
                          ? prev.campaignIds.filter(id => id !== c.id)
                          : [...prev.campaignIds, c.id],
                      }))}
                      style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 11, color: checked ? 'var(--accent)' : 'var(--fg-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--fg-subtle)', flexShrink: 0, background: 'var(--bg-muted)', padding: '1px 5px', borderRadius: 4 }}>
                      {c.platform}
                    </span>
                  </label>
                );
              })}
            {campaignsLoading && (
              <p style={{ fontSize: 11, color: 'var(--fg-subtle)', padding: '6px 8px' }}>Carregando campanhas...</p>
            )}
            {!campaignsLoading && campaigns.length === 0 && (
              <p style={{ fontSize: 11, color: 'var(--fg-subtle)', padding: '6px 8px' }}>Nenhuma campanha encontrada.</p>
            )}
          </div>
          {form.campaignIds.length > 0 && (
            <p style={{ fontSize: 10, color: 'var(--accent)', margin: 0 }}>
              ✓ {form.campaignIds.length} campanha{form.campaignIds.length > 1 ? 's' : ''} selecionada{form.campaignIds.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Footer fixo */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button type="button" onClick={onClose}
          style={{ flex: 1, padding: '8px 0', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', fontSize: 12, color: 'var(--fg-muted)', cursor: 'pointer' }}>
          Cancelar
        </button>
        <button type="button" disabled={saving || !form.name.trim()} onClick={() => onSave(form)}
          style={{ flex: 1, padding: '8px 0', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)', fontSize: 12, fontWeight: 600, color: 'white', cursor: 'pointer', opacity: saving || !form.name.trim() ? 0.5 : 1 }}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
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
        name:            form.name.trim(),
        description:     form.description.trim() || undefined,
        color:           form.color,
        leadTags:        form.leadTags,
        impressionPages: form.impressionPages,
        campaignIds:     form.campaignIds,
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

  const fc = stats?.funnelCounts;

  // Cumulative counts — each stage includes all leads that reached it or beyond
  const totalLeads      = stats?.totalLeads ?? 0;
  const totalMQL        = fc ? (fc.MQL || 0) + (fc.SQL || 0) + (fc.SCHEDULED || 0) + (fc.DEMO || 0) + (fc.PROPOSAL || 0) + (fc.CLIENT || 0) : 0;
  const totalSQL        = fc ? (fc.SQL || 0) + (fc.SCHEDULED || 0) + (fc.DEMO || 0) + (fc.PROPOSAL || 0) + (fc.CLIENT || 0) : 0;
  const totalScheduled  = fc ? (fc.SCHEDULED || 0) + (fc.DEMO || 0) + (fc.PROPOSAL || 0) + (fc.CLIENT || 0) : 0;
  const totalDemo       = fc ? (fc.DEMO || 0) + (fc.PROPOSAL || 0) + (fc.CLIENT || 0) : 0;
  const totalProposal   = fc ? (fc.PROPOSAL || 0) + (fc.CLIENT || 0) : 0;
  const totalClients    = fc ? (fc.CLIENT || 0) : 0;

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

  const funnelStages = [
    ...(showUsersStage ? [{ key: 'users', label: 'Usuários', count: stats?.gaUsers ?? 0, color: '#cbd5e1', icon: Eye }] : []),
    { key: 'leads',       label: 'Leads',       count: totalLeads,             color: '#3b82f6', icon: Users },
    { key: 'mql',         label: 'MQLs',        count: totalMQL,               color: '#6366f1', icon: TrendingUp },
    { key: 'sql',         label: 'SQLs',        count: totalSQL,               color: '#818cf8', icon: Filter },
    { key: 'scheduled',   label: 'Agendamentos',count: totalScheduled,         color: '#f59e0b', icon: Calendar },
    { key: 'demo',        label: 'Demos',       count: totalDemo,              color: '#f97316', icon: MousePointerClick },
    { key: 'proposal',    label: 'Propostas',   count: totalProposal,          color: '#a855f7', icon: CheckCircle },
    { key: 'clients',     label: 'Vendas',      count: totalClients,           color: '#22c55e', icon: DollarSign },
  ];
  const maxCount = Math.max(...funnelStages.map(s => s.count), 1);


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
    name:            editFunnel.name,
    description:     editFunnel.description || '',
    color:           editFunnel.color,
    leadTags:        editFunnel.leadTags        ?? [],
    impressionPages: editFunnel.impressionPages ?? [],
    campaignIds:     editFunnel.campaignIds     ?? [],
  } : emptyForm();

  return (
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
              <span className="ttl"><Layers size={14} className="ico" /> Funil de Conversão</span>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {funnelStages.map((stage, i) => {
                    const prev = i > 0 ? funnelStages[i - 1] : null;
                    const pct  = Math.max(2, Math.round((stage.count / maxCount) * 100));
                    const rate = prev ? convRate(stage.count, prev.count) : null;
                    const Icon = stage.icon;
                    return (
                      <div key={stage.key}>
                        {rate && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 4px 144px' }}>
                            <ArrowDown size={11} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
                              Taxa: <span style={{ fontWeight: 600, color: 'var(--fg-primary)' }}>{rate}</span>
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 136, flexShrink: 0 }}>
                            <div style={{ width: 26, height: 26, borderRadius: 6, background: `${stage.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Icon size={13} style={{ color: stage.color }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-secondary)' }}>{stage.label}</span>
                          </div>
                          <div style={{ flex: 1, height: 32, background: 'var(--bg-muted)', borderRadius: 8, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`,
                              background: stage.color, borderRadius: 8,
                              display: 'flex', alignItems: 'center', paddingLeft: 10,
                              transition: 'width .7s ease',
                            }}>
                              {pct > 12 && <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{fmtNum(stage.count)}</span>}
                            </div>
                          </div>
                          <div style={{ width: 60, textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(stage.count)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* CRM status distribution */}
          {fc && !statsLoading && (
            <div className="ds-card">
              <div className="ds-card-head">
                <span className="ttl"><Users size={14} className="ico" /> Distribuição por Status (CRM)</span>
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

        {/* Form panel */}
        {showForm && (
          <FunnelFormPanel
            initial={formInitial}
            editId={editFunnel?.id ?? null}
            onSave={handleSave}
            onClose={() => setShowForm(false)}
            saving={formSaving}
          />
        )}
      </div>
    </div>
  );
};

export default FunnelView;
