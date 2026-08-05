import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Columns3, X } from 'lucide-react';
import { DataService } from '../../services/dataService';
import { DrillDownResult, LeadCustomFieldDef, ReportQueryContext } from '../../types';

const PAGE_SIZE = 20;

interface ReportDetailTableProps {
  metricKey: string;
  groupBy: string | null;
  reportContext: ReportQueryContext;
  configuredColumns: string[] | null;
  canEdit: boolean;
  onColumnsChange: (columns: string[]) => void;
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

const MARKETING_STAGE_LABELS: Record<string, string> = {
  NOVO: 'Novo',
  QUALIFICACAO: 'Qualificação',
  NUTRICAO: 'Nutrição',
  AGUARDANDO_FOLLOWUP: 'Aguardando follow-up',
  CONVERSA_RESOLVIDA: 'Conversa resolvida',
  AGENDA_ENVIADA: 'Agenda enviada',
  REUNIAO_AGENDADA: 'Reunião agendada',
  SEM_INTERESSE: 'Sem interesse',
};

const DEFAULT_COLUMN_KEYS: Record<string, string[]> = {
  lead: ['company', 'name', 'email', 'phone', 'status', 'marketingStage', 'owner', 'tags', 'source', 'medium', 'campaign', 'brand', 'segment', 'firstSeenAt'],
  revenue_entry: ['businessName', 'setup', 'mrr', 'closedBy', 'origin', 'originType', 'date'],
  campaign_metric: ['campaign', 'platform', 'spend', 'impressions', 'clicks', 'leads', 'conversions', 'date'],
  email_campaign: ['name', 'source', 'sends', 'opens', 'clicks', 'date'],
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

function customFieldByKey(row: Record<string, unknown>, key: string): string {
  const customFields = row.customFields;
  if (!customFields || typeof customFields !== 'object' || Array.isArray(customFields)) return '—';
  return displayValue((customFields as Record<string, unknown>)[key]);
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

export const ReportDetailTable: React.FC<ReportDetailTableProps> = ({
  metricKey, groupBy, reportContext, configuredColumns, canEdit, onColumnsChange,
}) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<DrillDownResult | null>(null);
  const [customFieldDefs, setCustomFieldDefs] = useState<LeadCustomFieldDef[]>([]);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);

  useEffect(() => {
    DataService.listCustomFieldDefs()
      .then(setCustomFieldDefs)
      .catch(() => setCustomFieldDefs([]));
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

  const availableColumns = useMemo<ColumnDef[]>(() => {
    if (result?.entity === 'lead') {
      const extraCustomColumns: ColumnDef[] = customFieldDefs
        .filter(def => {
          const field = normalize(`${def.name} ${def.label}`);
          return !field.includes('qualificador')
            && !field.includes('marca')
            && !field.includes('segment')
            && !field.includes('tipo de operacao')
            && !field.includes('tipo operacao');
        })
        .map(def => ({
          key: `custom:${def.name}`,
          label: def.label,
          minWidth: 165,
          render: row => textCell(customFieldByKey(row, def.name)),
        }));
      return [
        { key: 'company', label: 'Empresa', minWidth: 190, render: row => textCell(row.company) },
        { key: 'name', label: 'Nome', minWidth: 170, render: row => textCell(row.name) },
        { key: 'email', label: 'E-mail', minWidth: 220, render: row => textCell(row.email) },
        { key: 'phone', label: 'Telefone', minWidth: 145, render: row => textCell(row.phone) },
        { key: 'jobTitle', label: 'Cargo', minWidth: 160, render: row => textCell(row.jobTitle) },
        { key: 'status', label: 'Status', minWidth: 120, render: row => textCell(STATUS_LABELS[String(row.status)] || row.status) },
        { key: 'marketingStage', label: 'Etapa da Lara', minWidth: 175, render: row => textCell(MARKETING_STAGE_LABELS[String(row.marketingStage)] || row.marketingStage) },
        { key: 'owner', label: 'Responsável', minWidth: 150, render: row => textCell(row.assignedTo) },
        { key: 'tags', label: 'Etiquetas', minWidth: 150, render: row => tagCell(row.tags) },
        { key: 'brand', label: 'Marca', minWidth: 170, render: row => textCell(customFieldValue(row, customFieldDefs, ['marca representada', 'marca'])) },
        { key: 'segment', label: 'Segmentação', minWidth: 175, render: row => textCell(customFieldValue(row, customFieldDefs, ['segmentacao', 'segmento', 'tipo de operacao', 'tipo operacao'])) },
        { key: 'source', label: 'Origem', minWidth: 140, render: row => textCell(row.firstSource) },
        { key: 'medium', label: 'Mídia', minWidth: 130, render: row => textCell(row.firstMedium) },
        { key: 'campaign', label: 'Campanha', minWidth: 180, render: row => textCell(row.firstCampaign) },
        { key: 'city', label: 'Cidade', minWidth: 150, render: row => textCell(row.city) },
        { key: 'state', label: 'Estado', minWidth: 95, render: row => textCell(row.state) },
        { key: 'site', label: 'Site', minWidth: 220, render: row => textCell(row.siteUrl) },
        { key: 'score', label: 'Score comercial', minWidth: 130, align: 'right', render: row => fmtNumber(row.score) },
        { key: 'aiScore', label: 'Score da Lara', minWidth: 120, align: 'right', render: row => row.aiScore === null || row.aiScore === undefined ? '—' : fmtNumber(row.aiScore) },
        { key: 'firstSeenAt', label: 'Data de entrada', minWidth: 135, render: row => fmtDate(row.firstSeenAt) },
        { key: 'lastSeenAt', label: 'Última atividade', minWidth: 140, render: row => fmtDate(row.lastSeenAt) },
        ...extraCustomColumns,
      ];
    }
    if (result?.entity === 'revenue_entry') {
      return [
        { key: 'businessName', label: 'Empresa', minWidth: 220, render: row => textCell(row.businessName) },
        { key: 'leadEmail', label: 'E-mail do lead', minWidth: 220, render: row => textCell(row.leadEmail) },
        { key: 'setup', label: 'Setup', minWidth: 140, align: 'right', render: row => fmtCurrency(row.setupValue) },
        { key: 'mrr', label: 'MRR', minWidth: 140, align: 'right', render: row => fmtCurrency(row.mrrValue) },
        { key: 'closedBy', label: 'Vendedor', minWidth: 160, render: row => textCell(row.closedBy) },
        { key: 'origin', label: 'Origem', minWidth: 140, render: row => textCell(row.origin) },
        { key: 'originType', label: 'Tipo de origem', minWidth: 140, render: row => textCell(row.originType) },
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
  }, [result?.entity, customFieldDefs]);

  const selectedColumnKeys = useMemo(() => {
    const availableKeys = new Set(availableColumns.map(column => column.key));
    const configured = configuredColumns ?? [];
    if (configured.length > 0 && configured.every(key => availableKeys.has(key))) return configured;
    const defaults = DEFAULT_COLUMN_KEYS[result?.entity ?? ''] ?? [];
    return defaults.filter(key => availableKeys.has(key));
  }, [availableColumns, configuredColumns, result?.entity]);

  const columns = useMemo(() => {
    const byKey = new Map(availableColumns.map(column => [column.key, column]));
    return selectedColumnKeys.map(key => byKey.get(key)).filter((column): column is ColumnDef => !!column);
  }, [availableColumns, selectedColumnKeys]);

  const toggleColumn = (key: string) => {
    if (!canEdit) return;
    if (selectedColumnKeys.includes(key)) {
      if (selectedColumnKeys.length === 1) return;
      onColumnsChange(selectedColumnKeys.filter(current => current !== key));
    } else {
      onColumnsChange([...selectedColumnKeys, key]);
    }
  };

  const moveColumn = (key: string, direction: -1 | 1) => {
    if (!canEdit) return;
    const index = selectedColumnKeys.indexOf(key);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedColumnKeys.length) return;
    const next = [...selectedColumnKeys];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onColumnsChange(next);
  };

  const resetColumns = () => {
    const defaults = DEFAULT_COLUMN_KEYS[result?.entity ?? ''] ?? [];
    onColumnsChange(defaults.filter(key => availableColumns.some(column => column.key === key)));
  };

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
    <div className="ds-card" style={{ marginTop: 16, overflow: 'visible' }}>
      <div style={{ position: 'relative', minHeight: 48, padding: '0 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ height: 48, display: 'flex', alignItems: 'center', borderBottom: '2px solid var(--accent)', color: 'var(--accent)', fontSize: 12, fontWeight: 750 }}>
          {sectionLabel}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--fg-subtle)', fontSize: 12 }}>
            {result?.supported === false ? '' : result ? `${result.total.toLocaleString('pt-BR')} registro${result.total === 1 ? '' : 's'}` : 'Carregando...'}
          </span>
          {canEdit && availableColumns.length > 0 && (
            <button
              type="button"
              onClick={() => setColumnPickerOpen(open => !open)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', borderRadius: 7, border: '1px solid var(--border)', background: columnPickerOpen ? 'var(--accent-soft)' : 'var(--bg-surface)', color: columnPickerOpen ? 'var(--accent)' : 'var(--fg-secondary)', fontSize: 12, fontWeight: 650, cursor: 'pointer' }}
            >
              <Columns3 size={14} /> Colunas
            </button>
          )}
        </div>

        {columnPickerOpen && canEdit && (
          <div style={{ position: 'absolute', zIndex: 20, top: 42, right: 12, width: 'min(360px, calc(100vw - 64px))', maxHeight: 520, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-surface)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden' }}>
            <div style={{ padding: '13px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ color: 'var(--fg-primary)', fontSize: 13, fontWeight: 750 }}>Organizar colunas</div>
                <div style={{ color: 'var(--fg-subtle)', fontSize: 11, marginTop: 2 }}>Use as setas para mudar a ordem.</div>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setColumnPickerOpen(false)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 7, background: 'var(--bg-muted)', color: 'var(--fg-muted)', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '10px 10px 4px', overflowY: 'auto' }}>
              <div style={{ padding: '0 4px 7px', color: 'var(--fg-subtle)', fontSize: 10, fontWeight: 750, textTransform: 'uppercase' }}>Colunas exibidas</div>
              {columns.map((column, index) => (
                <div key={column.key} style={{ minHeight: 38, padding: '5px 7px', display: 'flex', alignItems: 'center', gap: 7, borderRadius: 8, background: index % 2 === 0 ? 'var(--bg-subtle)' : 'transparent' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent)', color: '#fff', flexShrink: 0 }}><Check size={12} /></span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg-secondary)', fontSize: 12 }} title={column.label}>{column.label}</span>
                  <button type="button" aria-label={`Mover ${column.label} para a esquerda`} disabled={index === 0} onClick={() => moveColumn(column.key, -1)} style={{ width: 25, height: 25, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--fg-muted)', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.35 : 1 }}><ChevronUp size={13} /></button>
                  <button type="button" aria-label={`Mover ${column.label} para a direita`} disabled={index === columns.length - 1} onClick={() => moveColumn(column.key, 1)} style={{ width: 25, height: 25, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', color: 'var(--fg-muted)', cursor: index === columns.length - 1 ? 'not-allowed' : 'pointer', opacity: index === columns.length - 1 ? 0.35 : 1 }}><ChevronDown size={13} /></button>
                  <button type="button" aria-label={`Remover ${column.label}`} disabled={columns.length === 1} onClick={() => toggleColumn(column.key)} style={{ width: 25, height: 25, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--fg-subtle)', cursor: columns.length === 1 ? 'not-allowed' : 'pointer', opacity: columns.length === 1 ? 0.35 : 1 }}><X size={13} /></button>
                </div>
              ))}

              {availableColumns.length > columns.length && (
                <>
                  <div style={{ padding: '14px 4px 7px', color: 'var(--fg-subtle)', fontSize: 10, fontWeight: 750, textTransform: 'uppercase' }}>Adicionar colunas</div>
                  {availableColumns.filter(column => !selectedColumnKeys.includes(column.key)).map(column => (
                    <button key={column.key} type="button" onClick={() => toggleColumn(column.key)} style={{ width: '100%', minHeight: 36, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 8, background: 'transparent', color: 'var(--fg-secondary)', fontSize: 12, textAlign: 'left', cursor: 'pointer' }}>
                      <span style={{ width: 20, height: 20, border: '1px solid var(--border)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-subtle)', flexShrink: 0 }}>+</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{column.label}</span>
                    </button>
                  ))}
                </>
              )}
            </div>

            <div style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
              <button type="button" onClick={resetColumns} style={{ border: 'none', background: 'transparent', color: 'var(--fg-muted)', fontSize: 11, cursor: 'pointer' }}>Restaurar padrão</button>
              <span style={{ color: 'var(--fg-subtle)', fontSize: 10 }}>Clique em Salvar para manter</span>
            </div>
          </div>
        )}
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
