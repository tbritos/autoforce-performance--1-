import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Lock, Globe } from 'lucide-react';
import { DataService } from '../services/dataService';
import { ChartConfig, DrillDownClickParams, MetricDef, MetricSource, Report, ReportFilterCondition, ReportQueryContext, ReportWidgetType } from '../types';
import { WidgetRenderer } from './reports/WidgetRenderer';
import { ReportDrillDownModal } from './reports/ReportDrillDownModal';
import { ReportDetailTable } from './reports/ReportDetailTable';
import { ReportFilterBar } from './reports/ReportFilterBar';
import { SOURCE_LABELS, DIMENSION_LABELS, CHART_TYPE_META } from './reports/reportLabels';

const DATE_PRESET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'custom', label: 'Personalizado' },
  { value: 'last_7_days', label: 'Últimos 7 dias' },
  { value: 'last_30_days', label: 'Últimos 30 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Último mês' },
  { value: 'this_quarter', label: 'Este trimestre' },
  { value: 'last_quarter', label: 'Último trimestre' },
];

const ReportBuilderView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [report, setReport] = useState<Report | null>(null);
  const [metrics, setMetrics] = useState<MetricDef[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [drillDown, setDrillDown] = useState<DrillDownClickParams | null>(null);
  const [reportFilters, setReportFilters] = useState<ReportFilterCondition[]>([]);
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportDatePreset, setReportDatePreset] = useState('custom');
  const [chartType, setChartType] = useState<ReportWidgetType>('BAR_CHART');
  const [metricKey, setMetricKey] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [tableColumns, setTableColumns] = useState<string[] | null>(null);

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
      setMetrics(m);
      // formato antigo (mapa {campo:valor}) de relatórios salvos antes dessa
      // mudança não é um array — trata como "sem filtro" em vez de quebrar.
      setReportFilters(Array.isArray(r.filters) ? r.filters : []);
      setReportDateFrom(r.dateFrom?.slice(0, 10) ?? '');
      setReportDateTo(r.dateTo?.slice(0, 10) ?? '');
      setReportDatePreset(r.datePreset ?? 'custom');
      setChartType(r.chartType ?? 'BAR_CHART');
      setMetricKey(r.metricKey ?? '');
      setGroupBy(r.groupBy ?? '');
      setTableColumns(Array.isArray(r.tableColumns) ? r.tableColumns : null);
    });
  }, [id]);

  const metric = metrics.find(m => m.key === metricKey) ?? null;

  const handleMetricChange = (key: string) => {
    setMetricKey(key);
    setTableColumns(null);
    const m = metrics.find(x => x.key === key);
    if (groupBy && !(m?.groupableDimensions ?? []).includes(groupBy)) setGroupBy('');
    setDirty(true);
  };

  // Deriva a config final do gráfico sem mexer no estado bruto — assim voltar
  // de KPI_CARD pra Barra/Linha/Pizza não perde o "Ver por" que já tinha sido escolhido.
  const chartConfig: ChartConfig | null = metric ? {
    type: chartType,
    title: groupBy && chartType !== 'KPI_CARD' ? `${metric.label} por ${DIMENSION_LABELS[groupBy] ?? groupBy}` : metric.label,
    metricKey,
    groupBy: chartType === 'KPI_CARD' ? null : (groupBy || null),
  } : null;

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await DataService.updateReport(id, {
        name,
        filters: reportFilters.length > 0 ? reportFilters : null,
        dateFrom: reportContext.dateFrom,
        dateTo: reportContext.dateTo,
        datePreset: reportContext.datePreset,
        metricKey: metricKey || null,
        groupBy: chartType === 'KPI_CARD' ? null : (groupBy || null),
        chartType,
        tableColumns,
      });
      setReport(updated);
      setReportFilters(Array.isArray(updated.filters) ? updated.filters : []);
      setReportDateFrom(updated.dateFrom?.slice(0, 10) ?? '');
      setReportDateTo(updated.dateTo?.slice(0, 10) ?? '');
      setReportDatePreset(updated.datePreset ?? 'custom');
      setChartType(updated.chartType ?? 'BAR_CHART');
      setMetricKey(updated.metricKey ?? '');
      setGroupBy(updated.groupBy ?? '');
      setTableColumns(Array.isArray(updated.tableColumns) ? updated.tableColumns : null);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 420px', minWidth: 0, maxWidth: '100%' }}>
          <button type="button" onClick={() => navigate('/reports')}
            style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowLeft size={15} />
          </button>
          <input value={name} onChange={e => { setName(e.target.value); setDirty(true); }} disabled={!canEdit}
            title={name}
            style={{ flex: '1 1 auto', width: '100%', minWidth: 0, fontSize: 19, fontWeight: 700, color: 'var(--fg-primary)', background: 'transparent', border: 'none', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={handleTogglePrivacy} disabled={!canEdit || privacySaving}
            title={!canEdit ? 'Só o dono deste relatório pode alterar a privacidade' : report.isPublic ? 'Visível pra todo o time — clique pra tornar privado' : 'Privado — só você pode ver — clique pra compartilhar com o time'}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 12, fontWeight: 600, cursor: !canEdit ? 'not-allowed' : 'pointer', opacity: !canEdit ? 0.6 : 1 }}>
            {report.isPublic ? <Globe size={14} /> : <Lock size={14} />}
            {report.isPublic ? 'Compartilhado' : 'Privado'}
          </button>
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

      <div className="ds-card" style={{ padding: 16, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Tipo de gráfico</span>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {(Object.keys(CHART_TYPE_META) as ReportWidgetType[]).map(t => {
              const meta = CHART_TYPE_META[t];
              const Icon = meta.icon;
              return (
                <button key={t} type="button" disabled={!canEdit} onClick={() => { setChartType(t); setDirty(true); }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 14px',
                    borderRadius: 8, cursor: canEdit ? 'pointer' : 'not-allowed', fontSize: 11, fontWeight: 600,
                    border: `1px solid ${chartType === t ? 'var(--accent)' : 'var(--border)'}`,
                    background: chartType === t ? 'var(--accent-soft)' : 'transparent',
                    color: 'var(--fg-primary)', opacity: canEdit ? 1 : 0.6,
                  }}>
                  <Icon size={16} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Medir por</span>
            <select value={metricKey} disabled={!canEdit}
              onChange={e => handleMetricChange(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', fontSize: 13, outline: 'none' }}>
              <option value="">Escolha uma métrica...</option>
              {(Object.keys(SOURCE_LABELS) as MetricSource[]).map(s => {
                const sourceMetrics = metrics.filter(m => m.source === s);
                if (sourceMetrics.length === 0) return null;
                return (
                  <optgroup key={s} label={SOURCE_LABELS[s]}>
                    {sourceMetrics.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </optgroup>
                );
              })}
            </select>
          </label>

          {metric && chartType !== 'KPI_CARD' && metric.groupableDimensions.length > 0 && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Ver por</span>
              <select value={groupBy} disabled={!canEdit}
                onChange={e => { setGroupBy(e.target.value); setDirty(true); }}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', fontSize: 13, outline: 'none' }}>
                <option value="">Nenhum (total)</option>
                {metric.groupableDimensions.map(d => (
                  <option key={d} value={d}>{DIMENSION_LABELS[d] ?? d}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {chartConfig ? (
        <>
          <div className="ds-card" style={{ height: 480, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <WidgetRenderer widget={chartConfig} reportContext={reportContext} onDrillDown={setDrillDown} />
          </div>
          <ReportDetailTable
            metricKey={metricKey}
            groupBy={chartConfig.groupBy}
            reportContext={reportContext}
            configuredColumns={tableColumns}
            canEdit={canEdit}
            onColumnsChange={next => { setTableColumns(next); setDirty(true); }}
          />
        </>
      ) : (
        <div className="ds-card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--fg-subtle)' }}>
          <p style={{ fontSize: 13, margin: 0 }}>Escolha uma métrica em "Medir por" para ver o gráfico.</p>
        </div>
      )}

      <ReportDrillDownModal params={drillDown} onClose={() => setDrillDown(null)} />
    </div>
  );
};

export default ReportBuilderView;
