import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { GridLayout, useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  ArrowLeft, Plus, Save, Trash2, X, Settings2,
  BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Table2, Hash,
} from 'lucide-react';
import { DataService } from '../services/dataService';
import { MetricDef, MetricSource, Report, ReportLayoutItem, ReportWidget, ReportWidgetType } from '../types';
import { WidgetRenderer } from './reports/WidgetRenderer';

const SOURCE_LABELS: Record<MetricSource, string> = {
  leads: 'Leads / Funil',
  revenue: 'Receita',
  campaigns: 'Campanhas (Meta/Google Ads)',
  ga4: 'GA4 / Landing Pages',
  email: 'E-mail (RD Station)',
};

const WIDGET_TYPE_META: Record<ReportWidgetType, { label: string; icon: React.ElementType; defaultW: number; defaultH: number }> = {
  KPI_CARD:   { label: 'Card (número)', icon: Hash,          defaultW: 3, defaultH: 3 },
  LINE_CHART: { label: 'Gráfico de Linha', icon: LineChartIcon, defaultW: 6, defaultH: 6 },
  BAR_CHART:  { label: 'Gráfico de Barra', icon: BarChart3,     defaultW: 6, defaultH: 6 },
  PIE_CHART:  { label: 'Gráfico de Pizza', icon: PieChartIcon,  defaultW: 6, defaultH: 6 },
  TABLE:      { label: 'Tabela',           icon: Table2,        defaultW: 6, defaultH: 6 },
};

const DIMENSION_LABELS: Record<string, string> = {
  date_day: 'Dia', date_week: 'Semana', date_month: 'Mês',
  status: 'Status', toStatus: 'Novo Status', firstSource: 'Origem', firstMedium: 'Mídia',
  assignedTo: 'Responsável', origin: 'Origem', closedBy: 'Vendedor', originType: 'Tipo',
  platform: 'Plataforma', campaignId: 'Campanha', path: 'Página', name: 'Nome',
  source: 'Fonte', pipedriveStageName: 'Estágio', pipedrivePipelineId: 'Pipeline', pipedriveStageId: 'ID do Estágio',
};

function newId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `w_${Date.now()}_${Math.random().toString(36).slice(2)}`);
}

function nextPosition(layout: ReportLayoutItem[]): { x: number; y: number } {
  const maxY = layout.reduce((m, item) => Math.max(m, item.y + item.h), 0);
  return { x: 0, y: maxY };
}

// ─── Add/Edit widget modal ───────────────────────────────────────────────────

interface WidgetModalProps {
  metrics: MetricDef[];
  initial?: ReportWidget | null;
  onCancel: () => void;
  onSave: (widget: ReportWidget) => void;
}

const WidgetModal: React.FC<WidgetModalProps> = ({ metrics, initial, onCancel, onSave }) => {
  const [step, setStep] = useState<1 | 2>(initial ? 2 : 1);
  const [source, setSource] = useState<MetricSource | null>(
    initial ? (metrics.find(m => m.key === initial.metricKey)?.source ?? null) : null
  );
  const [metricKey, setMetricKey] = useState(initial?.metricKey ?? '');
  const [type, setType] = useState<ReportWidgetType>(initial?.type ?? 'KPI_CARD');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [groupBy, setGroupBy] = useState<string>(initial?.groupBy ?? '');
  const [dateFrom, setDateFrom] = useState(initial?.dateFrom?.slice(0, 10) ?? '');
  const [dateTo, setDateTo] = useState(initial?.dateTo?.slice(0, 10) ?? '');
  const [filterEntries, setFilterEntries] = useState<Array<{ key: string; value: string }>>(
    initial?.filters ? Object.entries(initial.filters).map(([key, value]) => ({ key, value })) : []
  );

  const metric = metrics.find(m => m.key === metricKey) ?? null;
  const sourceMetrics = useMemo(() => metrics.filter(m => m.source === source), [metrics, source]);

  const handlePickMetric = (m: MetricDef) => {
    setMetricKey(m.key);
    if (!title) setTitle(m.label);
    setGroupBy('');
    setStep(2);
  };

  const handleSave = () => {
    if (!metric) return;
    const filters: Record<string, string> = {};
    for (const { key, value } of filterEntries) {
      if (key && value) filters[key] = value;
    }
    onSave({
      id: initial?.id ?? newId(),
      type,
      title: title.trim() || metric.label,
      metricKey: metric.key,
      groupBy: groupBy || null,
      filters: Object.keys(filters).length ? filters : null,
      dateFrom: metric.dateField && dateFrom ? dateFrom : null,
      dateTo: metric.dateField && dateTo ? dateTo : null,
    });
  };

  return createPortal(
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="ds-card" style={{ width: 'min(560px, 100%)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>
            {initial ? 'Editar Widget' : step === 1 ? 'Escolha a fonte de dados' : 'Configurar Widget'}
          </span>
          <button type="button" onClick={onCancel} style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto' }}>
          {step === 1 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              {(Object.keys(SOURCE_LABELS) as MetricSource[]).map(s => (
                <button key={s} type="button" onClick={() => setSource(s)}
                  style={{
                    textAlign: 'left', padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${source === s ? 'var(--accent)' : 'var(--border)'}`,
                    background: source === s ? 'var(--accent-soft)' : 'transparent',
                    fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)',
                  }}>
                  {SOURCE_LABELS[s]}
                </button>
              ))}
              {source && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 8 }}>Métrica</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {sourceMetrics.map(m => (
                      <button key={m.key} type="button" onClick={() => handlePickMetric(m)}
                        style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)' }}>{m.label}</div>
                        {m.description && <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{m.description}</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {metric && (
                <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                  Métrica: <strong style={{ color: 'var(--fg-primary)' }}>{metric.label}</strong>
                  {!initial && (
                    <button type="button" onClick={() => setStep(1)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}>
                      trocar
                    </button>
                  )}
                </div>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Título</span>
                <input value={title} onChange={e => setTitle(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', fontSize: 13, outline: 'none' }} />
              </label>

              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Tipo de visualização</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6, marginTop: 6 }}>
                  {(Object.keys(WIDGET_TYPE_META) as ReportWidgetType[]).map(t => {
                    const meta = WIDGET_TYPE_META[t];
                    const Icon = meta.icon;
                    return (
                      <button key={t} type="button" onClick={() => setType(t)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 6px',
                          borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          border: `1px solid ${type === t ? 'var(--accent)' : 'var(--border)'}`,
                          background: type === t ? 'var(--accent-soft)' : 'transparent',
                          color: 'var(--fg-primary)',
                        }}>
                        <Icon size={16} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {metric && metric.groupableDimensions.length > 0 && type !== 'KPI_CARD' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Agrupar por</span>
                  <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', fontSize: 13, outline: 'none' }}>
                    <option value="">Nenhum (total)</option>
                    {metric.groupableDimensions.map(d => (
                      <option key={d} value={d}>{DIMENSION_LABELS[d] ?? d}</option>
                    ))}
                  </select>
                </label>
              )}

              {metric && metric.dateField && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>De</span>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', fontSize: 13, outline: 'none' }} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Até</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', fontSize: 13, outline: 'none' }} />
                  </label>
                </div>
              )}
              {metric && !metric.dateField && (
                <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: 0 }}>
                  Essa métrica não tem filtro de período — sempre mostra o dado mais recente.
                </p>
              )}

              {metric && metric.filterableDimensions.length > 0 && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Filtros (opcional)</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                    {filterEntries.map((f, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6 }}>
                        <select value={f.key} onChange={e => setFilterEntries(prev => prev.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                          style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', fontSize: 12 }}>
                          <option value="">Campo...</option>
                          {metric.filterableDimensions.map(d => <option key={d} value={d}>{DIMENSION_LABELS[d] ?? d}</option>)}
                        </select>
                        <input value={f.value} onChange={e => setFilterEntries(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                          placeholder="valor" style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', fontSize: 12 }} />
                        <button type="button" onClick={() => setFilterEntries(prev => prev.filter((_, j) => j !== i))}
                          style={{ background: 'transparent', border: 'none', color: 'var(--fg-subtle)', cursor: 'pointer' }}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setFilterEntries(prev => [...prev, { key: '', value: '' }])}
                      style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      + adicionar filtro
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {step === 2 && (
          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button type="button" onClick={handleSave} disabled={!metric}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: metric ? 'pointer' : 'default', opacity: metric ? 1 : 0.6 }}>
              {initial ? 'Salvar Alterações' : 'Adicionar Widget'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

// ─── Main builder view ────────────────────────────────────────────────────────

const ReportBuilderView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { width, containerRef, mounted } = useContainerWidth();

  const [report, setReport] = useState<Report | null>(null);
  const [metrics, setMetrics] = useState<MetricDef[]>([]);
  const [layout, setLayout] = useState<ReportLayoutItem[]>([]);
  const [widgets, setWidgets] = useState<ReportWidget[]>([]);
  const [name, setName] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<ReportWidget | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([DataService.getReport(id), DataService.getReportMetrics()]).then(([r, m]) => {
      setReport(r);
      setName(r.name);
      setLayout(r.layout ?? []);
      setWidgets(r.widgets ?? []);
      setMetrics(m);
    });
  }, [id]);

  const handleAddWidget = (widget: ReportWidget) => {
    const meta = WIDGET_TYPE_META[widget.type];
    setWidgets(prev => {
      const exists = prev.some(w => w.id === widget.id);
      return exists ? prev.map(w => w.id === widget.id ? widget : w) : [...prev, widget];
    });
    setLayout(prev => {
      if (prev.some(l => l.i === widget.id)) return prev;
      const pos = nextPosition(prev);
      return [...prev, { i: widget.id, x: pos.x, y: pos.y, w: meta.defaultW, h: meta.defaultH }];
    });
    setDirty(true);
    setModalOpen(false);
    setEditingWidget(null);
  };

  const handleRemoveWidget = (widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
    setLayout(prev => prev.filter(l => l.i !== widgetId));
    setDirty(true);
  };

  const handleLayoutChange = (newLayout: Layout) => {
    setLayout(newLayout.map(l => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h })));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await DataService.updateReport(id, { name, layout, widgets });
      setReport(updated);
      setLayout(updated.layout ?? []);
      setWidgets(updated.widgets ?? []);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  if (!report) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-subtle)' }}>Carregando...</div>;
  }

  return (
    <div style={{ padding: '20px 24px 64px' }} className="animate-fade-in-up">
      {(modalOpen || editingWidget) && (
        <WidgetModal
          metrics={metrics}
          initial={editingWidget}
          onCancel={() => { setModalOpen(false); setEditingWidget(null); }}
          onSave={handleAddWidget}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={() => navigate('/reports')}
            style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowLeft size={15} />
          </button>
          <input value={name} onChange={e => { setName(e.target.value); setDirty(true); }}
            style={{ fontSize: 19, fontWeight: 700, color: 'var(--fg-primary)', background: 'transparent', border: 'none', outline: 'none', minWidth: 200 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => setModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={15} /> Adicionar Widget
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !dirty}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: !dirty || saving ? 'default' : 'pointer', opacity: !dirty || saving ? 0.6 : 1 }}>
            <Save size={15} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div ref={containerRef} style={{ minHeight: 200 }}>
        {mounted && widgets.length === 0 && (
          <div className="ds-card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--fg-subtle)' }}>
            <p style={{ fontSize: 13, margin: 0 }}>Nenhum widget ainda. Clique em "Adicionar Widget" para começar a montar o relatório.</p>
          </div>
        )}
        {mounted && widgets.length > 0 && (
          <GridLayout
            width={width}
            layout={layout}
            gridConfig={{ cols: 12, rowHeight: 36, margin: [12, 12], containerPadding: null, maxRows: Infinity }}
            onLayoutChange={handleLayoutChange}
          >
            {widgets.map(w => (
              <div key={w.id} className="ds-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2, zIndex: 2 }}>
                  <button type="button" onClick={() => setEditingWidget(w)}
                    style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Settings2 size={11} />
                  </button>
                  <button type="button" onClick={() => handleRemoveWidget(w.id)}
                    style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', color: 'var(--red-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
                <WidgetRenderer widget={w} />
              </div>
            ))}
          </GridLayout>
        )}
      </div>
    </div>
  );
};

export default ReportBuilderView;
