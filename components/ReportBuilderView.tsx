import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { GridLayout, useContainerWidth } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  ArrowLeft, Plus, Save, Trash2, X, Settings2, Lock, Globe,
  BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, Table2, Hash,
} from 'lucide-react';
import { DataService } from '../services/dataService';
import { DrillDownClickParams, MetricDef, MetricSource, Report, ReportFilterCondition, ReportLayoutItem, ReportQueryContext, ReportWidget, ReportWidgetType } from '../types';
import { WidgetRenderer } from './reports/WidgetRenderer';
import { ReportDrillDownModal } from './reports/ReportDrillDownModal';
import { ReportFilterBar } from './reports/ReportFilterBar';
import { SOURCE_LABELS, DIMENSION_LABELS } from './reports/reportLabels';

const WIDGET_TYPE_META: Record<ReportWidgetType, { label: string; icon: React.ElementType; defaultW: number; defaultH: number }> = {
  KPI_CARD:   { label: 'Card (número)', icon: Hash,          defaultW: 3, defaultH: 3 },
  LINE_CHART: { label: 'Gráfico de Linha', icon: LineChartIcon, defaultW: 6, defaultH: 6 },
  BAR_CHART:  { label: 'Gráfico de Barra', icon: BarChart3,     defaultW: 6, defaultH: 6 },
  PIE_CHART:  { label: 'Gráfico de Pizza', icon: PieChartIcon,  defaultW: 6, defaultH: 6 },
  TABLE:      { label: 'Tabela',           icon: Table2,        defaultW: 6, defaultH: 6 },
};

const DATE_PRESET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'custom', label: 'Personalizado' },
  { value: 'last_7_days', label: 'Últimos 7 dias' },
  { value: 'last_30_days', label: 'Últimos 30 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Último mês' },
  { value: 'this_quarter', label: 'Este trimestre' },
  { value: 'last_quarter', label: 'Último trimestre' },
];

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
    onSave({
      id: initial?.id ?? newId(),
      type,
      title: title.trim() || metric.label,
      metricKey: metric.key,
      groupBy: groupBy || null,
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
  const [privacySaving, setPrivacySaving] = useState(false);
  const [drillDown, setDrillDown] = useState<DrillDownClickParams | null>(null);
  const [reportFilters, setReportFilters] = useState<ReportFilterCondition[]>([]);
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportDatePreset, setReportDatePreset] = useState('custom');

  const canEdit = report?.canEdit ?? true;

  const reportContext: ReportQueryContext = useMemo(() => ({
    filters: reportFilters.length > 0 ? reportFilters : null,
    dateFrom: reportDatePreset === 'custom' && reportDateFrom ? reportDateFrom : null,
    dateTo: reportDatePreset === 'custom' && reportDateTo ? reportDateTo : null,
    datePreset: reportDatePreset !== 'custom' ? reportDatePreset : null,
  }), [reportFilters, reportDateFrom, reportDateTo, reportDatePreset]);

  useEffect(() => {
    if (!id) return;
    Promise.all([DataService.getReport(id), DataService.getReportMetrics()]).then(([r, m]) => {
      setReport(r);
      setName(r.name);
      setLayout(r.layout ?? []);
      setWidgets(r.widgets ?? []);
      setMetrics(m);
      // formato antigo (mapa {campo:valor}) de relatórios salvos antes dessa
      // mudança não é um array — trata como "sem filtro" em vez de quebrar.
      setReportFilters(Array.isArray(r.filters) ? r.filters : []);
      setReportDateFrom(r.dateFrom?.slice(0, 10) ?? '');
      setReportDateTo(r.dateTo?.slice(0, 10) ?? '');
      setReportDatePreset(r.datePreset ?? 'custom');
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
      const updated = await DataService.updateReport(id, {
        name, layout, widgets,
        filters: reportFilters.length > 0 ? reportFilters : null,
        dateFrom: reportContext.dateFrom,
        dateTo: reportContext.dateTo,
        datePreset: reportContext.datePreset,
      });
      setReport(updated);
      setLayout(updated.layout ?? []);
      setWidgets(updated.widgets ?? []);
      setReportFilters(Array.isArray(updated.filters) ? updated.filters : []);
      setReportDateFrom(updated.dateFrom?.slice(0, 10) ?? '');
      setReportDateTo(updated.dateTo?.slice(0, 10) ?? '');
      setReportDatePreset(updated.datePreset ?? 'custom');
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePrivacy = async () => {
    if (!id || !report || privacySaving) return;
    setPrivacySaving(true);
    try {
      const result = await DataService.updateReportPrivacy(id, !report.isPublic);
      setReport(prev => prev ? { ...prev, isPublic: result.isPublic } : prev);
    } finally {
      setPrivacySaving(false);
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
          <input value={name} onChange={e => { setName(e.target.value); setDirty(true); }} disabled={!canEdit}
            style={{ fontSize: 19, fontWeight: 700, color: 'var(--fg-primary)', background: 'transparent', border: 'none', outline: 'none', minWidth: 200 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={handleTogglePrivacy} disabled={!canEdit || privacySaving}
            title={!canEdit ? 'Só o dono deste relatório pode alterar a privacidade' : report.isPublic ? 'Visível pra todo o time — clique pra tornar privado' : 'Privado — só você pode ver — clique pra compartilhar com o time'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 12, fontWeight: 600, cursor: !canEdit ? 'not-allowed' : 'pointer', opacity: !canEdit ? 0.6 : 1 }}>
            {report.isPublic ? <Globe size={14} /> : <Lock size={14} />}
            {report.isPublic ? 'Compartilhado' : 'Privado'}
          </button>
          {canEdit && (
            <button type="button" onClick={() => setModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={15} /> Adicionar Widget
            </button>
          )}
          {canEdit && (
            <button type="button" onClick={handleSave} disabled={saving || !dirty}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: !dirty || saving ? 'default' : 'pointer', opacity: !dirty || saving ? 0.6 : 1 }}>
              <Save size={15} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
      </div>

      <div className="ds-card" style={{ padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Período</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <select value={reportDatePreset} disabled={!canEdit}
              onChange={e => { setReportDatePreset(e.target.value); setDirty(true); }}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', fontSize: 13, outline: 'none' }}>
              {DATE_PRESET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {reportDatePreset === 'custom' && (
              <>
                <input type="date" value={reportDateFrom} disabled={!canEdit}
                  onChange={e => { setReportDateFrom(e.target.value); setDirty(true); }}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', fontSize: 13, outline: 'none' }} />
                <input type="date" value={reportDateTo} disabled={!canEdit}
                  onChange={e => { setReportDateTo(e.target.value); setDirty(true); }}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', fontSize: 13, outline: 'none' }} />
              </>
            )}
          </div>
          {reportDatePreset !== 'custom' && (
            <span style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 6, display: 'block' }}>
              Período recalculado automaticamente toda vez que o relatório for aberto.
            </span>
          )}
        </div>

        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Filtros</span>
          <div style={{ marginTop: 6 }}>
            <ReportFilterBar
              conditions={reportFilters}
              onChange={next => { setReportFilters(next); setDirty(true); }}
              metrics={metrics}
              disabled={!canEdit}
            />
          </div>
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
            dragConfig={{ enabled: canEdit }}
            resizeConfig={{ enabled: canEdit }}
            onLayoutChange={handleLayoutChange}
          >
            {widgets.map(w => (
              <div key={w.id} className="ds-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {canEdit && (
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
                )}
                <WidgetRenderer widget={w} reportContext={reportContext} onDrillDown={setDrillDown} />
              </div>
            ))}
          </GridLayout>
        )}
      </div>

      <ReportDrillDownModal params={drillDown} onClose={() => setDrillDown(null)} />
    </div>
  );
};

export default ReportBuilderView;
