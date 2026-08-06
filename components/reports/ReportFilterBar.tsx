import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, SlidersHorizontal } from 'lucide-react';
import { DataService } from '../../services/dataService';
import { MetricDef, MetricSource, FilterOperator, ReportFilterCondition } from '../../types';
import { SOURCE_LABELS, DIMENSION_LABELS } from './reportLabels';

const ENUM_FILTER_FIELDS = new Set(['status', 'toStatus']);
const NUMERIC_FILTER_FIELDS = new Set(['pipedrivePipelineId', 'pipedriveStageId']);
const EXACT_MATCH_FILTER_FIELDS = new Set(['tag']);

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: 'é',
  not_equals: 'não é',
  contains: 'contém',
  is_set: 'está preenchido',
  is_not_set: 'não está preenchido',
};

function allowedOperatorsFor(field: string): FilterOperator[] {
  const ALL: FilterOperator[] = ['equals', 'not_equals', 'contains', 'is_set', 'is_not_set'];
  return (ENUM_FILTER_FIELDS.has(field) || NUMERIC_FILTER_FIELDS.has(field) || EXACT_MATCH_FILTER_FIELDS.has(field))
    ? ALL.filter(o => o !== 'contains')
    : ALL;
}

function genId() { return Math.random().toString(36).slice(2, 10); }

function fieldLabel(field: string): string {
  return DIMENSION_LABELS[field] ?? field;
}

function dimensionsFor(metrics: MetricDef[], source: MetricSource): string[] {
  const set = new Set<string>();
  metrics.filter(m => m.source === source).forEach(m => m.filterableDimensions.forEach(d => set.add(d)));
  return Array.from(set);
}

// ── ReportFieldValueCombobox ────────────────────────────────────────────────
// Mesmo padrão do FieldCombobox de SegmentView.tsx, mas buscando valores reais
// por fonte+campo (5 fontes de dado, não só Lead).

function ReportFieldValueCombobox({ source, field, value, onChange, disabled }: {
  source: MetricSource; field: string; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    DataService.fetchReportFieldValues(source, field)
      .then(setOptions)
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [source, field]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !dropRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (disabled) return;
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(v => !v);
    setSearch('');
  };

  const filtered = options.filter(o => !search || o.label.toLowerCase().includes(search.toLowerCase()));
  const showCustom = search.trim() && !options.some(o => o.value.toLowerCase() === search.trim().toLowerCase());
  const currentLabel = options.find(o => o.value === value)?.label ?? value;

  const dropdown = open && rect ? createPortal(
    <div ref={dropRef} style={{
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 200),
      zIndex: 9999,
      background: 'var(--bg-surface)', border: '1.5px solid var(--border)', borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      maxHeight: 260, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar ou digitar..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--fg-primary)', outline: 'none', background: 'var(--bg-surface)' }}
        />
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && <div style={{ padding: 14, fontSize: 12, color: 'var(--fg-muted)', textAlign: 'center' }}>Carregando...</div>}
        {!loading && filtered.length === 0 && !showCustom && (
          <div style={{ padding: 14, fontSize: 12, color: 'var(--fg-muted)', textAlign: 'center' }}>
            {search ? 'Nenhum resultado' : 'Sem valores cadastrados'}
          </div>
        )}
        {filtered.map(opt => (
          <button key={opt.value} type="button"
            onClick={() => { onChange(opt.value); setOpen(false); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
              border: 'none', cursor: 'pointer', fontSize: 13,
              background: value === opt.value ? 'var(--bg-muted)' : 'transparent',
              color: value === opt.value ? 'var(--accent)' : 'var(--fg-primary)',
              fontWeight: value === opt.value ? 600 : 400,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {showCustom && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '6px 10px', flexShrink: 0 }}>
          <button type="button"
            onClick={() => { onChange(search.trim()); setOpen(false); }}
            style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-muted)', border: '1px dashed var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--fg-muted)', cursor: 'pointer', textAlign: 'left' }}
          >
            Usar &ldquo;{search.trim()}&rdquo;
          </button>
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ position: 'relative', minWidth: 150 }}>
      <button ref={triggerRef} type="button" onClick={handleOpen} disabled={disabled}
        style={{
          width: '100%', padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 8,
          fontSize: 13, background: 'var(--bg-surface)', cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          color: value ? 'var(--fg-primary)' : 'var(--fg-muted)',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentLabel || 'Selecionar...'}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }}>
          <path d={open ? 'M1 5L5 1L9 5' : 'M1 1L5 5L9 1'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}

// ── ReportFilterBar ──────────────────────────────────────────────────────────

export function ReportFilterBar({ conditions, onChange, metrics, disabled }: {
  conditions: ReportFilterCondition[];
  onChange: (next: ReportFilterCondition[]) => void;
  metrics: MetricDef[];
  disabled?: boolean;
}) {
  const sources = Array.from(new Set(metrics.map(m => m.source)));

  const addCondition = () => {
    const source = sources[0];
    const field = dimensionsFor(metrics, source)[0] ?? '';
    onChange([...conditions, { id: genId(), source, field, operator: 'equals', value: '' }]);
  };

  const updateCondition = (id: string, patch: Partial<ReportFilterCondition>) => {
    onChange(conditions.map(c => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch };
      if (patch.source && patch.source !== c.source) {
        next.field = dimensionsFor(metrics, patch.source)[0] ?? '';
        next.operator = 'equals';
        next.value = '';
      } else if (patch.field && patch.field !== c.field) {
        const ops = allowedOperatorsFor(patch.field);
        next.operator = ops.includes(c.operator) ? c.operator : ops[0];
        next.value = '';
      } else if (patch.operator && patch.operator !== c.operator) {
        if (patch.operator === 'is_set' || patch.operator === 'is_not_set') next.value = '';
      }
      return next;
    }));
  };

  const removeCondition = (id: string) => onChange(conditions.filter(c => c.id !== id));
  const clearAll = () => onChange([]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {conditions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SlidersHorizontal size={13} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-primary)' }}>
            {conditions.length} filtro{conditions.length !== 1 ? 's' : ''} aplicado{conditions.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 12, color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conditions
              .filter(c => c.operator === 'is_set' || c.operator === 'is_not_set' || c.value)
              .map(c => `${fieldLabel(c.field)} ${OPERATOR_LABELS[c.operator]}${c.value ? ` ${c.value}` : ''}`)
              .join(' · ')}
          </span>
          {!disabled && (
            <button type="button" onClick={clearAll} title="Limpar todos os filtros"
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: 4, borderRadius: 6, display: 'flex', flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {conditions.map((cond, idx) => {
          const dims = dimensionsFor(metrics, cond.source);
          const operators = allowedOperatorsFor(cond.field);
          const noValue = cond.operator === 'is_set' || cond.operator === 'is_not_set';

          return (
            <div key={cond.id} style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
              {/* dot + line connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', marginTop: 15, flexShrink: 0 }} />
                {idx < conditions.length - 1 && (
                  <div style={{ width: 1.5, flex: 1, background: 'var(--border)', marginTop: 2 }} />
                )}
              </div>

              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                <select value={cond.source} disabled={disabled}
                  onChange={e => updateCondition(cond.id, { source: e.target.value as MetricSource })}
                  style={{ padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--fg-primary)', background: 'var(--bg-surface)', cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none' }}>
                  {sources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
                </select>

                <select value={cond.field} disabled={disabled}
                  onChange={e => updateCondition(cond.id, { field: e.target.value })}
                  style={{ padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--fg-primary)', background: 'var(--bg-surface)', cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none' }}>
                  {dims.map(d => <option key={d} value={d}>{fieldLabel(d)}</option>)}
                </select>

                <select value={cond.operator} disabled={disabled}
                  onChange={e => updateCondition(cond.id, { operator: e.target.value as FilterOperator })}
                  style={{ padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--fg-primary)', background: 'var(--bg-surface)', cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none' }}>
                  {operators.map(o => <option key={o} value={o}>{OPERATOR_LABELS[o]}</option>)}
                </select>

                {!noValue && cond.field && (
                  <ReportFieldValueCombobox
                    source={cond.source} field={cond.field} value={cond.value} disabled={disabled}
                    onChange={v => updateCondition(cond.id, { value: v })}
                  />
                )}

                {!disabled && (
                  <button type="button" onClick={() => removeCondition(cond.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: 4, borderRadius: 6, display: 'flex', flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!disabled && (
        <button type="button" onClick={addCondition} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          border: '1.5px dashed var(--border)', borderRadius: 9, fontSize: 13, fontWeight: 600,
          color: 'var(--accent)', background: 'none', cursor: 'pointer', width: 'fit-content',
        }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Plus size={10} />
          </span>
          Adicionar filtro
        </button>
      )}

      {conditions.length === 0 && disabled && (
        <div style={{ fontSize: 12, color: 'var(--fg-muted)', fontStyle: 'italic' }}>
          Nenhum filtro aplicado
        </div>
      )}
    </div>
  );
}
