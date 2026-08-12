import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Edit2, Trash2, Users, X, Download } from 'lucide-react';
import { createPortal } from 'react-dom';
import * as DataService from '../services/dataService';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'LEAD',          label: 'Lead',          color: '#64748b' },
  { value: 'MQL',           label: 'MQL',           color: '#3b82f6' },
  { value: 'SQL',           label: 'SQL',           color: '#818cf8' },
  { value: 'SCHEDULED',     label: 'Agendado',      color: '#f59e0b' },
  { value: 'PROPOSAL',      label: 'Proposta',      color: '#a855f7' },
  { value: 'CLIENT',        label: 'Cliente',       color: '#10b981' },
  { value: 'LOST',          label: 'Perdido',       color: '#ef4444' },
  { value: 'DISQUALIFIED',  label: 'Desqualificado',color: '#9ca3af' },
];

const SEGMENT_FIELDS = [
  { value: 'status',          label: 'Status',              type: 'status_multi' },
  { value: 'isHot',           label: 'Lead Quente',         type: 'bool'         },
  { value: 'firstSource',     label: 'Fonte',               type: 'string'       },
  { value: 'firstMedium',     label: 'UTM Medium',          type: 'string'       },
  { value: 'tags',            label: 'Tags',                type: 'tag'          },
  { value: 'company',         label: 'Empresa',             type: 'string'       },
  { value: 'assignedTo',      label: 'Responsável',         type: 'string'       },
  { value: 'score',           label: 'Score',               type: 'number'       },
  { value: 'firstSeenAt',     label: 'Criado há (dias)',    type: 'days'         },
  { value: 'lastSeenAt',      label: 'Última atividade',   type: 'days'         },
  { value: 'conversionCount', label: 'Nº de conversões',   type: 'conv_count'   },
] as const;

type FieldType = 'string' | 'status_multi' | 'bool' | 'number' | 'days' | 'tag' | 'conv_count';

const OPERATORS_BY_TYPE: Record<FieldType, { value: string; label: string }[]> = {
  string: [
    { value: 'equals',     label: 'é igual a'          },
    { value: 'not_equals', label: 'não é igual a'       },
    { value: 'contains',   label: 'contém'              },
    { value: 'is_set',     label: 'está preenchido'     },
    { value: 'is_not_set', label: 'não está preenchido' },
  ],
  status_multi: [
    { value: 'in',     label: 'é um de'         },
    { value: 'not_in', label: 'não é nenhum de' },
  ],
  bool: [
    { value: 'is_true',  label: 'é verdadeiro (sim)' },
    { value: 'is_false', label: 'é falso (não)'      },
  ],
  number: [
    { value: 'gte',    label: 'maior ou igual a' },
    { value: 'lte',    label: 'menor ou igual a' },
    { value: 'equals', label: 'igual a'          },
  ],
  days: [
    { value: 'in_last_days',    label: 'nos últimos X dias' },
    { value: 'before_days_ago', label: 'há mais de X dias'  },
  ],
  tag: [
    { value: 'contains_tag',     label: 'tem a tag'     },
    { value: 'not_contains_tag', label: 'não tem a tag' },
  ],
  conv_count: [
    { value: 'gte', label: 'tem pelo menos' },
    { value: 'lte', label: 'tem no máximo'  },
  ],
};

const COLOR_PRESETS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#a855f7','#ec4899','#64748b'];

const STATUS_META: Record<string, { label: string; color: string }> = {
  LEAD:          { label: 'Lead',          color: '#64748b' },
  MQL:           { label: 'MQL',           color: '#3b82f6' },
  SQL:           { label: 'SQL',           color: '#818cf8' },
  SCHEDULED:     { label: 'Agendado',      color: '#f59e0b' },
  PROPOSAL:      { label: 'Proposta',      color: '#a855f7' },
  CLIENT:        { label: 'Cliente',       color: '#10b981' },
  LOST:          { label: 'Perdido',       color: '#ef4444' },
  DISQUALIFIED:  { label: 'Desqualificado',color: '#9ca3af' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function genId() { return Math.random().toString(36).slice(2, 10); }

function getFieldMeta(fieldValue: string) {
  return SEGMENT_FIELDS.find(f => f.value === fieldValue) ?? null;
}

function getFieldType(fieldValue: string): FieldType {
  return (getFieldMeta(fieldValue)?.type ?? 'string') as FieldType;
}

function defaultOperator(type: FieldType): string {
  return OPERATORS_BY_TYPE[type][0].value;
}

function defaultValue(type: FieldType, operator: string): any {
  if (type === 'status_multi') return [];
  if (type === 'bool') return null;
  if (['is_set', 'is_not_set', 'is_true', 'is_false'].includes(operator)) return null;
  if (type === 'number' || type === 'days' || type === 'conv_count') return 1;
  return '';
}

const AVATAR_COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#a855f7','#ec4899','#14b8a6'];
function avatarColor(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = email.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── FieldCombobox ──────────────────────────────────────────────────────────────

function FieldCombobox({ field, value, onChange }: { field: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [rect, setRect]       = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    DataService.fetchFieldValues(field)
      .then(setOptions)
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [field]);

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
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(v => !v);
    setSearch('');
  };

  const filtered   = options.filter(o => !search || o.toLowerCase().includes(search.toLowerCase()));
  const showCustom = search.trim() && !options.some(o => o.toLowerCase() === search.toLowerCase());

  const dropdown = open && rect ? createPortal(
    <div ref={dropRef} style={{
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 220),
      zIndex: 9999,
      background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      maxHeight: 260, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, color: '#111827', outline: 'none' }}
        />
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && <div style={{ padding: 14, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Carregando...</div>}
        {!loading && filtered.length === 0 && !showCustom && (
          <div style={{ padding: 14, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
            {search ? 'Nenhum resultado' : 'Sem valores cadastrados'}
          </div>
        )}
        {filtered.map(opt => (
          <button key={opt} type="button"
            onClick={() => { onChange(opt); setOpen(false); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
              border: 'none', cursor: 'pointer', fontSize: 13,
              background: value === opt ? '#f0f4ff' : 'transparent',
              color: value === opt ? '#6366f1' : '#111827',
              fontWeight: value === opt ? 600 : 400,
            }}
            onMouseEnter={e => { if (value !== opt) e.currentTarget.style.background = '#f9fafb'; }}
            onMouseLeave={e => { if (value !== opt) e.currentTarget.style.background = 'transparent'; }}
          >
            {opt}
          </button>
        ))}
      </div>
      {showCustom && (
        <div style={{ borderTop: '1px solid #f0f0f0', padding: '6px 10px', flexShrink: 0 }}>
          <button type="button"
            onClick={() => { onChange(search.trim()); setOpen(false); }}
            style={{ width: '100%', padding: '6px 8px', background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 6, fontSize: 12, color: '#6b7280', cursor: 'pointer', textAlign: 'left' }}
          >
            Usar &ldquo;{search.trim()}&rdquo;
          </button>
        </div>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ position: 'relative', minWidth: 160 }}>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{
          width: '100%', padding: '6px 10px', border: '1.5px solid #e5e7eb', borderRadius: 8,
          fontSize: 13, background: '#fff', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          color: value ? '#111827' : '#9ca3af',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || 'Selecionar...'}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }}>
          <path d={open ? 'M1 5L5 1L9 5' : 'M1 1L5 5L9 1'} stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}

// ── ConditionValueInput ────────────────────────────────────────────────────────

function ConditionValueInput({ field, operator, value, onChange }: {
  field: string; operator: string; value: any; onChange: (v: any) => void;
}) {
  if (['is_set', 'is_not_set', 'is_true', 'is_false'].includes(operator)) return null;

  const type = getFieldType(field);

  if (type === 'status_multi') {
    const selected: string[] = Array.isArray(value) ? value : [];
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {STATUS_OPTIONS.map(s => {
          const active = selected.includes(s.value);
          return (
            <button key={s.value} type="button"
              onClick={() => onChange(active ? selected.filter(x => x !== s.value) : [...selected, s.value])}
              style={{
                padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${active ? s.color : '#e5e7eb'}`,
                background: active ? s.color + '22' : '#fff',
                color: active ? s.color : '#6b7280',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (type === 'days' || type === 'number' || type === 'conv_count') {
    const suffix = type === 'days' ? ' dias' : type === 'conv_count' ? ' conversões' : '';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="number" min={0} value={value ?? 1}
          onChange={e => onChange(Number(e.target.value))}
          style={{ width: 72, padding: '6px 10px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#111827', outline: 'none' }}
        />
        {suffix && <span style={{ fontSize: 12, color: '#6b7280' }}>{suffix}</span>}
      </div>
    );
  }

  // string and tag — combobox with options loaded from the API
  return <FieldCombobox field={field} value={value ?? ''} onChange={onChange} />;
}

// ── SegmentBuilder ─────────────────────────────────────────────────────────────

type BuilderProps = {
  segment: DataService.SegmentType | null;
  onClose: () => void;
  onSaved: () => void;
};

function SegmentBuilder({ segment, onClose, onSaved }: BuilderProps) {
  const isEdit = !!segment;
  const [name, setName]               = useState(segment?.name ?? '');
  const [description, setDescription] = useState(segment?.description ?? '');
  const [color, setColor]             = useState(segment?.color ?? '#6366f1');
  const [logic, setLogic]             = useState<'AND'|'OR'>(segment?.rules?.logic ?? 'AND');
  const [conditions, setConditions]   = useState<DataService.RuleCondition[]>(segment?.rules?.conditions ?? []);
  const [previewCount, setPreviewCount] = useState<number|null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const count = await DataService.previewSegment({ logic, conditions });
        setPreviewCount(count);
      } catch { setPreviewCount(null); }
      finally { setPreviewLoading(false); }
    }, 600);
  }, [logic, conditions]);

  const addCondition = () => {
    const field = SEGMENT_FIELDS[0].value;
    const type  = getFieldType(field);
    const op    = defaultOperator(type);
    setConditions(cs => [...cs, { id: genId(), field, operator: op, value: defaultValue(type, op) }]);
  };

  const updateCondition = (id: string, patch: Partial<DataService.RuleCondition>) => {
    setConditions(cs => cs.map(c => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch };
      if (patch.field && patch.field !== c.field) {
        const t = getFieldType(patch.field);
        next.operator = defaultOperator(t);
        next.value    = defaultValue(t, next.operator);
      } else if (patch.operator && patch.operator !== c.operator) {
        next.value = defaultValue(getFieldType(next.field), patch.operator);
      }
      return next;
    }));
  };

  const removeCondition = (id: string) => setConditions(cs => cs.filter(c => c.id !== id));

  const handleSave = async () => {
    if (!name.trim()) { setError('Nome é obrigatório'); return; }
    setSaving(true); setError('');
    try {
      const rules: DataService.SegmentRules = { logic, conditions };
      if (isEdit) {
        await DataService.updateSegment(segment!.id, { name, description, color, rules });
      } else {
        await DataService.createSegment({ name, description: description || null, color, rules });
      }
      onSaved();
    } catch (e: any) { setError(e?.message || 'Erro ao salvar segmento'); }
    finally { setSaving(false); }
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1200 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(680px,95vw)', maxHeight: '90vh', background: '#fff', borderRadius: 16,
        zIndex: 1201, display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.28)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
            {isEdit ? 'Editar segmento' : 'Novo segmento'}
          </h2>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Name + Color row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Nome *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Ex: Leads quentes do Meta"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, color: '#111827', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Cor</label>
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                {COLOR_PRESETS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)} style={{
                    width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: color === c ? '3px solid #111827' : '2px solid transparent', flexShrink: 0,
                  }} />
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Descrição (opcional)</label>
            <input value={description ?? ''} onChange={e => setDescription(e.target.value)}
              placeholder="Descreva o objetivo deste segmento..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#111827', outline: 'none' }}
            />
          </div>

          {/* Logic toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Os leads devem atender</span>
            <div style={{ display: 'flex', border: '1.5px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              {(['AND', 'OR'] as const).map(l => (
                <button key={l} type="button" onClick={() => setLogic(l)} style={{
                  padding: '5px 16px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: logic === l ? '#111827' : '#fff',
                  color: logic === l ? '#fff' : '#6b7280',
                }}>
                  {l === 'AND' ? 'TODAS' : 'QUALQUER'}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 13, color: '#6b7280' }}>das condições abaixo</span>
          </div>

          {/* Conditions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {conditions.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1.5px dashed #e5e7eb', borderRadius: 10 }}>
                Nenhuma condição adicionada — todos os leads serão incluídos
              </div>
            )}

            {conditions.map((cond, idx) => {
              const type      = getFieldType(cond.field);
              const operators = OPERATORS_BY_TYPE[type] ?? [];
              const noValue   = ['is_set','is_not_set','is_true','is_false'].includes(cond.operator);

              return (
                <div key={cond.id} style={{ padding: '12px', background: '#f9fafb', borderRadius: 10, border: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {/* Index bubble */}
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#6b7280', flexShrink: 0, marginTop: 6 }}>
                      {idx + 1}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        {/* Field selector */}
                        <select value={cond.field} onChange={e => updateCondition(cond.id, { field: e.target.value })}
                          style={{ padding: '6px 10px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#111827', background: '#fff', cursor: 'pointer', outline: 'none' }}>
                          {SEGMENT_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>

                        {/* Operator selector */}
                        <select value={cond.operator} onChange={e => updateCondition(cond.id, { operator: e.target.value })}
                          style={{ padding: '6px 10px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#111827', background: '#fff', cursor: 'pointer', outline: 'none' }}>
                          {operators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>

                        {/* Value */}
                        {!noValue && (
                          <ConditionValueInput
                            field={cond.field} operator={cond.operator}
                            value={cond.value} onChange={v => updateCondition(cond.id, { value: v })}
                          />
                        )}
                      </div>
                    </div>

                    {/* Remove button */}
                    <button type="button" onClick={() => removeCondition(cond.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, borderRadius: 6, display: 'flex', flexShrink: 0, marginTop: 4 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add condition button */}
            <button type="button" onClick={addCondition} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              border: '1.5px dashed #d1d5db', borderRadius: 9, fontSize: 13, fontWeight: 600,
              color: '#6b7280', background: '#fff', cursor: 'pointer', width: 'fit-content',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280'; }}
            >
              <Plus size={14} /> Adicionar condição
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: '#fafafa' }}>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            {previewLoading
              ? 'Calculando...'
              : previewCount !== null
                ? <span><strong style={{ color: '#111827', fontSize: 15 }}>{previewCount.toLocaleString('pt-BR')}</strong> lead{previewCount !== 1 ? 's' : ''} correspondem</span>
                : null
            }
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {error && <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>}
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', border: '1.5px solid #e5e7eb', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: '#111827', fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar segmento'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── SegmentLeadsModal ──────────────────────────────────────────────────────────

function SegmentLeadsModal({ segment, onClose }: { segment: DataService.SegmentType; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; leads: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  useEffect(() => { setPage(1); setData(null); }, [segment.id]);

  useEffect(() => {
    setLoading(true);
    DataService.getSegmentLeads(segment.id, page, pageSize)
      .then(setData)
      .catch(() => setData({ total: 0, leads: [] }))
      .finally(() => setLoading(false));
  }, [segment.id, page]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1200 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(900px,96vw)', maxHeight: '88vh', background: '#fff', borderRadius: 16,
        zIndex: 1201, display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.28)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: segment.color, flexShrink: 0 }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{segment.name}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {data && <span style={{ fontSize: 12, color: '#6b7280' }}>{data.total.toLocaleString('pt-BR')} leads</span>}
            <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Table header */}
        {!loading && data && data.leads.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr', padding: '8px 24px', background: '#f9fafb', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            {['Lead', 'Empresa', 'Fonte', 'Status'].map(col => (
              <span key={col} style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col}</span>
            ))}
          </div>
        )}

        {/* Rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '8px 0' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr', padding: '12px 24px', gap: 12 }}>
                  {[55, 40, 35, 28].map((w, j) => <div key={j} style={{ height: 13, width: `${w}%`, background: '#f0f0f0', borderRadius: 4 }} />)}
                </div>
              ))}
            </div>
          ) : !data || data.leads.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              Nenhum lead encontrado neste segmento.
            </div>
          ) : data.leads.map((lead: any, idx: number) => {
            const meta    = STATUS_META[lead.status] ?? { label: lead.status, color: '#6b7280' };
            const isEven  = idx % 2 === 0;
            const isUrl   = (s: string) => s.startsWith('http') || s.includes('://');
            const name    = lead.name && !isUrl(lead.name) ? lead.name : null;
            const initials = name
              ? name.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
              : lead.email.substring(0, 2).toUpperCase();

            return (
              <div key={lead.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.2fr 1fr', padding: '11px 24px', alignItems: 'center', background: isEven ? '#fff' : '#fafafa', borderBottom: '1px solid #f5f5f5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(lead.email), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name ?? lead.email}
                    </div>
                    {name && (
                      <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lead.email}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                  {lead.company || <span style={{ color: '#d1d5db' }}>—</span>}
                </div>
                <div style={{ paddingRight: 8 }}>
                  {lead.firstSource
                    ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, background: '#f0f9ff', color: '#0369a1' }}>{lead.firstSource}</span>
                    : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
                  }
                </div>
                <div>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, color: meta.color, background: meta.color + '1f' }}>
                    {meta.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: '#fff' }}>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            {data ? `${data.total.toLocaleString('pt-BR')} leads` : ''}
            {data && data.total > pageSize ? ` · Página ${page} de ${totalPages}` : ''}
          </span>
          {data && data.total > pageSize && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #e5e7eb', background: page === 1 ? '#f9fafb' : '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#d1d5db' : '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                ‹
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #e5e7eb', background: page === totalPages ? '#f9fafb' : '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#d1d5db' : '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                ›
              </button>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

// ── SegmentView (main export) ──────────────────────────────────────────────────

export const SegmentView: React.FC = () => {
  const [segments, setSegments]         = useState<DataService.SegmentType[]>([]);
  const [loading, setLoading]           = useState(true);
  const [builderOpen, setBuilderOpen]   = useState(false);
  const [editingSegment, setEditingSegment] = useState<DataService.SegmentType|null>(null);
  const [viewingSegment, setViewingSegment] = useState<DataService.SegmentType|null>(null);
  const [deletingId, setDeletingId]     = useState<string|null>(null);
  const [exportingId, setExportingId]   = useState<string|null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSegments(await DataService.listSegments()); }
    catch { setSegments([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditingSegment(null); setBuilderOpen(true); };
  const openEdit   = (seg: DataService.SegmentType) => { setEditingSegment(seg); setBuilderOpen(true); };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este segmento?')) return;
    setDeletingId(id);
    try { await DataService.deleteSegment(id); await load(); }
    catch { alert('Erro ao excluir segmento'); }
    finally { setDeletingId(null); }
  };

  const handleExport = async (seg: DataService.SegmentType) => {
    setExportingId(seg.id);
    try {
      const result = await DataService.exportSegment(seg.id);
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Não foi possível exportar este segmento.');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div style={{ padding: '24px', minHeight: '100%' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--fg-primary)' }}>
            Segmentos de Leads
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>
            Grupos dinâmicos baseados em condições — se atualizam automaticamente conforme os leads evoluem
          </p>
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
          background: '#111827', border: 'none', borderRadius: 9,
          fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
        }}>
          <Plus size={15} /> Novo Segmento
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', height: 150 }} className="animate-pulse" />
          ))}
        </div>
      ) : segments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 6 }}>
            Nenhum segmento criado ainda
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', maxWidth: 360, margin: '0 auto' }}>
            Crie segmentos dinâmicos para organizar seus leads por fonte, status, comportamento e muito mais
          </div>
          <button onClick={openCreate} style={{ marginTop: 20, padding: '9px 20px', background: '#111827', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
            Criar primeiro segmento
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
          {segments.map(seg => (
            <div key={seg.id} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '18px 20px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12, transition: 'box-shadow .15s' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              {/* Card top: color dot + name + count badge */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: seg.color, marginTop: 3, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {seg.name}
                    {seg.system && <span style={{ marginLeft: 7, padding: '2px 6px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 9, fontWeight: 800, verticalAlign: 'middle' }}>AUTOMÁTICO</span>}
                  </div>
                  {seg.description && (
                    <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {seg.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: seg.color + '18', borderRadius: 99, flexShrink: 0 }}>
                  <Users size={11} style={{ color: seg.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: seg.color }}>
                    {(seg as any).leadCount?.toLocaleString('pt-BR') ?? '—'}
                  </span>
                </div>
              </div>

              {/* Conditions summary */}
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {seg.system ? (
                  <span style={{ fontStyle: 'italic' }}>Base ativa menos descadastros da newsletter</span>
                ) : seg.rules.conditions.length === 0 ? (
                  <span style={{ fontStyle: 'italic' }}>Sem filtros — todos os leads</span>
                ) : seg.rules.conditions.slice(0, 3).map((c, i) => {
                  const meta = getFieldMeta(c.field);
                  return (
                    <span key={c.id ?? i} style={{ padding: '2px 7px', background: 'var(--bg-muted)', borderRadius: 99, fontSize: 10, fontWeight: 500 }}>
                      {meta?.label ?? c.field}
                    </span>
                  );
                })}
                {seg.rules.conditions.length > 3 && (
                  <span style={{ padding: '2px 7px', background: 'var(--bg-muted)', borderRadius: 99, fontSize: 10, color: 'var(--fg-subtle)' }}>
                    +{seg.rules.conditions.length - 3}
                  </span>
                )}
                {seg.rules.conditions.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--fg-subtle)', marginLeft: 2 }}>
                    · lógica {seg.rules.logic}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                <button onClick={() => setViewingSegment(seg)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'none', fontSize: 12, fontWeight: 600, color: 'var(--fg-primary)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                  <Users size={12} /> Ver leads
                </button>
                <button onClick={() => handleExport(seg)} disabled={exportingId === seg.id} title="Exportar leads deste segmento" style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', fontSize: 12, color: exportingId === seg.id ? '#d1d5db' : 'var(--fg-muted)', cursor: exportingId === seg.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Download size={13} />
                </button>
                {!seg.system && <>
                  <button onClick={() => openEdit(seg)} title="Editar" style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', fontSize: 12, color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDelete(seg.id)} disabled={deletingId === seg.id} title="Excluir" style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', fontSize: 12, color: deletingId === seg.id ? '#d1d5db' : 'var(--fg-muted)', cursor: deletingId === seg.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={13} />
                  </button>
                </>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {builderOpen && (
        <SegmentBuilder
          segment={editingSegment}
          onClose={() => setBuilderOpen(false)}
          onSaved={() => { setBuilderOpen(false); load(); }}
        />
      )}
      {viewingSegment && (
        <SegmentLeadsModal
          segment={viewingSegment}
          onClose={() => setViewingSegment(null)}
        />
      )}
    </div>
  );
};
