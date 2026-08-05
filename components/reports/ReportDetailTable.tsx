import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DataService } from '../../services/dataService';
import { DrillDownResult, LeadCustomFieldDef, PipedriveStage, ReportQueryContext } from '../../types';

const PAGE_SIZE = 20;

interface ReportDetailTableProps {
  metricKey: string;
  groupBy: string | null;
  reportContext: ReportQueryContext;
}

interface ColumnDef {
  key: string;
  label: string;
  minWidth: number;
  align?: 'right';
  render: (row: Record<string, unknown>) => React.ReactNode;
}

const STATUS_LABELS: Record<string, string> = {
  LEAD: 'Lead',
  MQL: 'MQL',
  SQL: 'SQL',
  SCHEDULED: 'Agendado',
  DEMO: 'Demo',
  PROPOSAL: 'Proposta',
  OPPORTUNITY: 'Proposta',
  CLIENT: 'Cliente',
  LOST: 'Perdido',
  DISQUALIFIED: 'Desqualificado',
  open: 'Aberto',
  won: 'Ganho',
  lost: 'Perdido',
  deleted: 'Excluído',
};

const normalize = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const displayValue = (value: unknown, empty = '—'): string => {
  if (value === null || value === undefined || value === '') return empty;
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || empty;
  if (typeof value === 'object') return empty;
  return String(value);
};

const fmtCurrency = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  }).format(parsed);
};

const fmtNumber = (value: unknown): string => new Intl.NumberFormat('pt-BR').format(Number(value ?? 0));

const fmtDate = (value: unknown): string => {
  if (!value) return '—';
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('pt-BR');
};

function customFieldValue(
  row: Record<string, unknown>,
  defs: LeadCustomFieldDef[],
  aliases: string[],
  empty = '—',
): string {
  const customFields = row.customFields;
  if (!customFields || typeof customFields !== 'object' || Array.isArray(customFields)) return empty;

  const values = customFields as Record<string, unknown>;
  const normalizedAliases = aliases.map(normalize);
  const matchingDefs = defs.filter(def => {
    const name = normalize(def.name);
    const label = normalize(def.label);
    return normalizedAliases.some(alias => name === alias || label === alias || name.includes(alias) || label.includes(alias));
  });

  for (const def of matchingDefs) {
    const value = displayValue(values[def.name], '');
    if (value) return value;
  }

  for (const [key, rawValue] of Object.entries(values)) {
    const normalizedKey = normalize(key);
    if (!normalizedAliases.some(alias => normalizedKey === alias || normalizedKey.includes(alias))) continue;
    const value = displayValue(rawValue, '');
    if (value) return value;
  }
  return empty;
}

const textCell = (value: unknown, fallback = '—') => {
  const text = displayValue(value, fallback);
  return <span title={text}>{text}</span>;
};

const tagCell = (value: unknown) => {
  const tags = Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  if (tags.length === 0) return '—';
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {tags.map(tag => (
        <span key={tag} style={{ padding: '2px 7px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-muted)', color: 'var(--fg-secondary)', fontSize: 10, fontWeight: 650 }}>
          {tag}
        </span>
      ))}
    </div>
  );
};

export const ReportDetailTable: React.FC<ReportDetailTableProps> = ({ metricKey, groupBy, reportContext }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DrillDownResult | null>(null);
  const [stages, setStages] = useState<PipedriveStage[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<LeadCustomFieldDef[]>([]);

  useEffect(() => {
    Promise.all([
      DataService.getPipedriveStages().catch(() => [] as PipedriveStage[]),
      DataService.listCustomFieldDefs().catch(() => [] as LeadCustomFieldDef[]),
    ]).then(([nextStages, nextDefs]) => {
      setStages(nextStages);
      setCustomFieldDefs(nextDefs);
    });
  }, []);

  useEffect(() => { setPage(1); }, [metricKey, groupBy, reportContext]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    DataService.drillDownReportMetric({
      metricKey,
      groupBy,
      dimension: null,
      filters: reportContext.filters,
      dateFrom: reportContext.dateFrom,
      dateTo: reportContext.dateTo,
      datePreset: reportContext.datePreset,
      title: 'Registros do relatório',
      page,
      pageSize: PAGE_SIZE,
    })
      .then(next => { if (!cancelled) setResult(next); })
      .catch(() => {
        if (!cancelled) setResult({ supported: true, entity: null, total: 0, page: 1, pageSize: PAGE_SIZE, rows: [] });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [metricKey, groupBy, reportContext, page]);

  const pipelineNames = useMemo(() => {
    const map = new Map<number, string>();
    stages.forEach(stage => map.set(stage.pipeline_id, stage.pipeline_name));
    return map;
  }, [stages]);

  const columns = useMemo<ColumnDef[]>(() => {
    if (result?.entity === 'lead') {
      return [
        { key: 'title', label: 'Título', minWidth: 220, render: row => textCell(row.dealTitle || row.company || row.name || row.email) },
        { key: 'stage', label: 'Etapa', minWidth: 150, render: row => textCell(row.pipedriveStageName || STATUS_LABELS[String(row.toStatus ?? row.status)] || row.toStatus || row.status) },
        { key: 'status', label: 'Status', minWidth: 110, render: row => textCell(STATUS_LABELS[String(row.pipedriveDealStatus ?? row.status)] || row.pipedriveDealStatus || row.status) },
        { key: 'setup', label: 'Valor de setup', minWidth: 135, align: 'right', render: row => fmtCurrency(row.pipedriveSetupValue) },
        { key: 'dealValue', label: 'Valor do negócio', minWidth: 145, align: 'right', render: row => fmtCurrency(row.pipedriveDealValue) },
        { key: 'owner', label: 'Proprietário', minWidth: 150, render: row => textCell(row.assignedTo) },
        {
          key: 'pipeline', label: 'Funil', minWidth: 170, render: row => {
            const pipelineId = Number(row.pipedrivePipelineId);
            return textCell(pipelineNames.get(pipelineId) || (Number.isFinite(pipelineId) ? `Pipeline #${pipelineId}` : null));
          },
        },
        { key: 'tags', label: 'Etiqueta', minWidth: 135, render: row => tagCell(row.tags) },
        { key: 'qualifier', label: 'Qualificador', minWidth: 135, render: row => textCell(customFieldValue(row, customFieldDefs, ['qualificador'], 'N/A'), 'N/A') },
        { key: 'brand', label: 'Marca', minWidth: 170, render: row => textCell(customFieldValue(row, customFieldDefs, ['marca representada', 'marca'])) },
        { key: 'segment', label: 'Segmentação', minWidth: 175, render: row => textCell(customFieldValue(row, customFieldDefs, ['segmentacao', 'segmento', 'tipo de operacao', 'tipo operacao'])) },
      ];
    }
    if (result?.entity === 'revenue_entry') {
      return [
        { key: 'title', label: 'Título', minWidth: 240, render: row => textCell(row.businessName || row.leadEmail) },
        { key: 'status', label: 'Status', minWidth: 110, render: () => 'Ganho' },
        { key: 'setup', label: 'Valor de setup', minWidth: 140, align: 'right', render: row => fmtCurrency(row.setupValue) },
        { key: 'dealValue', label: 'Valor do negócio', minWidth: 150, align: 'right', render: row => fmtCurrency(row.mrrValue) },
        { key: 'owner', label: 'Proprietário', minWidth: 160, render: row => textCell(row.closedBy) },
        { key: 'origin', label: 'Origem', minWidth: 140, render: row => textCell(row.origin) },
        { key: 'date', label: 'Data', minWidth: 120, render: row => fmtDate(row.date) },
      ];
    }
    if (result?.entity === 'campaign_metric') {
      return [
        { key: 'campaign', label: 'Campanha', minWidth: 250, render: row => textCell(row.campaignName) },
        { key: 'platform', label: 'Plataforma', minWidth: 130, render: row => textCell(row.platform) },
        { key: 'spend', label: 'Investimento', minWidth: 140, align: 'right', render: row => fmtCurrency(row.spend) },
        { key: 'impressions', label: 'Impressões', minWidth: 120, align: 'right', render: row => fmtNumber(row.impressions) },
        { key: 'clicks', label: 'Cliques', minWidth: 100, align: 'right', render: row => fmtNumber(row.clicks) },
        { key: 'leads', label: 'Leads', minWidth: 100, align: 'right', render: row => fmtNumber(row.leads) },
        { key: 'conversions', label: 'Conversões', minWidth: 120, align: 'right', render: row => fmtNumber(row.conversions) },
        { key: 'date', label: 'Data', minWidth: 120, render: row => fmtDate(row.date) },
      ];
    }
    if (result?.entity === 'email_campaign') {
      return [
        { key: 'name', label: 'Campanha', minWidth: 250, render: row => textCell(row.name) },
        { key: 'source', label: 'Fonte', minWidth: 140, render: row => textCell(row.source) },
        { key: 'sends', label: 'Enviados', minWidth: 110, align: 'right', render: row => fmtNumber(row.sends) },
        { key: 'opens', label: 'Aberturas', minWidth: 110, align: 'right', render: row => fmtNumber(row.opens) },
        { key: 'clicks', label: 'Cliques', minWidth: 100, align: 'right', render: row => fmtNumber(row.clicks) },
        { key: 'date', label: 'Data', minWidth: 120, render: row => fmtDate(row.date) },
      ];
    }
    return [];
  }, [result?.entity, pipelineNames, customFieldDefs]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const sectionLabel = result?.entity === 'lead' ? 'LEADS' : result?.entity === 'revenue_entry' ? 'NEGÓCIOS' : 'REGISTROS';

  const handleRowClick = (row: Record<string, unknown>) => {
    if (result?.entity === 'lead' && row.id) navigate(`/leads/${row.id}`);
    if (result?.entity === 'revenue_entry' && row.leadId) navigate(`/leads/${row.leadId}`);
    else if (result?.entity === 'revenue_entry' && row.dealUrl) window.open(row.dealUrl as string, '_blank', 'noopener');
  };

  const rowClickable = (row: Record<string, unknown>) => (
    (result?.entity === 'lead' && !!row.id)
    || (result?.entity === 'revenue_entry' && (!!row.leadId || !!row.dealUrl))
  );

  return (
    <div className="ds-card" style={{ marginTop: 16, overflow: 'hidden' }}>
      <div style={{ minHeight: 48, padding: '0 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ height: 48, display: 'flex', alignItems: 'center', borderBottom: '2px solid var(--accent)', color: 'var(--accent)', fontSize: 12, fontWeight: 750 }}>
          {sectionLabel}
        </div>
        <span style={{ color: 'var(--fg-subtle)', fontSize: 12 }}>
          {result?.supported === false ? '' : result ? `${result.total.toLocaleString('pt-BR')} registro${result.total === 1 ? '' : 's'}` : 'Carregando...'}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        {result?.supported === false ? (
          <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13 }}>{result.reason}</div>
        ) : loading ? (
          <div style={{ minWidth: 900, padding: '8px 0' }}>
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <div key={rowIndex} style={{ display: 'flex', gap: 18, padding: '12px 16px' }}>
                {[22, 16, 12, 14, 18].map((width, cellIndex) => <div key={cellIndex} style={{ width: `${width}%`, height: 12, background: 'var(--bg-muted)', borderRadius: 4 }} />)}
              </div>
            ))}
          </div>
        ) : !result || result.rows.length === 0 ? (
          <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 13 }}>Nenhum registro encontrado com os filtros deste relatório.</div>
        ) : (
          <table style={{ minWidth: columns.reduce((sum, col) => sum + col.minWidth, 0), width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <colgroup>{columns.map(col => <col key={col.key} style={{ width: col.minWidth }} />)}</colgroup>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} style={{ position: 'sticky', top: 0, zIndex: 1, padding: '9px 12px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-secondary)', fontSize: 11, fontWeight: 700, textAlign: col.align ?? 'left', whiteSpace: 'nowrap' }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, rowIndex) => {
                const clickable = rowClickable(row);
                return (
                  <tr key={(row.id as string) ?? rowIndex} onClick={clickable ? () => handleRowClick(row) : undefined} style={{ cursor: clickable ? 'pointer' : 'default' }}>
                    {columns.map(col => (
                      <td key={col.key} style={{ padding: '10px 12px', borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--fg-secondary)', background: rowIndex % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-subtle)', fontSize: 12, textAlign: col.align ?? 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {result && result.supported !== false && result.total > PAGE_SIZE && (
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>Página {page} de {totalPages}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" aria-label="Página anterior" disabled={page === 1 || loading} onClick={() => setPage(current => Math.max(1, current - 1))} style={{ width: 30, height: 30, border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', color: 'var(--fg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page === 1 || loading ? 'not-allowed' : 'pointer', opacity: page === 1 || loading ? 0.45 : 1 }}>
              <ChevronLeft size={14} />
            </button>
            <button type="button" aria-label="Próxima página" disabled={page === totalPages || loading} onClick={() => setPage(current => Math.min(totalPages, current + 1))} style={{ width: 30, height: 30, border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', color: 'var(--fg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page === totalPages || loading ? 'not-allowed' : 'pointer', opacity: page === totalPages || loading ? 0.45 : 1 }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
