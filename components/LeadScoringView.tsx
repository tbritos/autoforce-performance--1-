import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, Target, RefreshCw, ShieldCheck } from 'lucide-react';
import { DataService } from '../services/dataService';
import {
  listLeadScoringRules, createLeadScoringRule, updateLeadScoringRule, deleteLeadScoringRule,
  applyLeadScoringRulesToExisting, fetchFieldValues,
  installRecommendedLeadScoringRules,
  LeadScoringRule, ScoringCondition,
} from '../services/dataService';

// ── Constants ────────────────────────────────────────────────────────────────

type FieldOperator = 'equals' | 'not_equals' | 'contains' | 'is_set' | 'is_not_set' | 'gte' | 'lte';
type ScoringField = { value: string; label: string; type?: 'text' | 'number' };

const OPERATORS: FieldOperator[] = ['equals', 'not_equals', 'contains', 'is_set', 'is_not_set'];
const OPERATOR_LABELS: Record<FieldOperator, string> = {
  equals: 'é',
  not_equals: 'não é',
  contains: 'contém',
  is_set: 'está preenchido',
  is_not_set: 'não está preenchido',
  gte: 'é maior ou igual a',
  lte: 'é menor ou igual a',
};

const STANDARD_FIELDS: ScoringField[] = [
  { value: 'researchIcpSignal', label: 'Classificação de ICP' },
  { value: 'researchBusinessType', label: 'Tipo de empresa pesquisado' },
  { value: 'phone', label: 'Telefone' },
  { value: 'siteUrl', label: 'Site da empresa' },
  { value: 'conversionCount', label: 'Quantidade de conversões', type: 'number' },
  { value: 'aiScore', label: 'Score da Lara', type: 'number' },
  { value: 'firstSource', label: 'Origem' },
  { value: 'firstMedium', label: 'Mídia' },
  { value: 'firstCampaign', label: 'Campanha' },
  { value: 'firstLandingPage', label: 'Landing Page' },
  { value: 'company', label: 'Empresa' },
  { value: 'jobTitle', label: 'Cargo' },
  { value: 'city', label: 'Cidade' },
  { value: 'state', label: 'Estado' },
  { value: 'status', label: 'Status' },
  { value: 'assignedTo', label: 'Responsável' },
  { value: 'tags', label: 'Tags' },
];

function genId() { return Math.random().toString(36).slice(2, 10); }

// ── FieldValueCombobox ───────────────────────────────────────────────────────
// Mesmo padrão do FieldCombobox de SegmentView.tsx — busca valores reais via
// DataService.fetchFieldValues(field), com opção de digitar texto livre.

function FieldValueCombobox({ field, value, onChange }: { field: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [rect, setRect]       = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetchFieldValues(field)
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
      position: 'fixed', top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 220), zIndex: 9999,
      background: 'var(--bg-surface)', border: '1.5px solid var(--border)', borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: 260, display: 'flex', flexDirection: 'column', overflow: 'hidden',
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
          <button key={opt} type="button"
            onClick={() => { onChange(opt); setOpen(false); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', cursor: 'pointer', fontSize: 13,
              background: value === opt ? 'var(--bg-muted)' : 'transparent',
              color: value === opt ? 'var(--accent)' : 'var(--fg-primary)',
              fontWeight: value === opt ? 600 : 400,
            }}
          >
            {opt}
          </button>
        ))}
      </div>
      {showCustom && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '6px 10px', flexShrink: 0 }}>
          <button type="button" onClick={() => { onChange(search.trim()); setOpen(false); }}
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
    <div style={{ position: 'relative', minWidth: 160 }}>
      <button ref={triggerRef} type="button" onClick={handleOpen}
        style={{
          width: '100%', padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13,
          background: 'var(--bg-surface)', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          color: value ? 'var(--fg-primary)' : 'var(--fg-muted)',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || 'Selecionar...'}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }}>
          <path d={open ? 'M1 5L5 1L9 5' : 'M1 1L5 5L9 1'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}

// ── RuleBuilder ──────────────────────────────────────────────────────────────

type BuilderProps = {
  rule: LeadScoringRule | null;
  fields: ScoringField[];
  onClose: () => void;
  onSaved: () => void;
};

function RuleBuilder({ rule, fields, onClose, onSaved }: BuilderProps) {
  const isEdit = !!rule;
  const [name, setName]           = useState(rule?.name ?? '');
  const [logic, setLogic]         = useState<'AND' | 'OR'>(rule?.logic ?? 'AND');
  const [points, setPoints]       = useState(rule?.points ?? 10);
  const [isActive, setIsActive]   = useState(rule?.isActive ?? true);
  const [conditions, setConditions] = useState<ScoringCondition[]>(rule?.conditions ?? []);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const addCondition = () => {
    setConditions(cs => [...cs, { id: genId(), field: fields[0]?.value ?? '', operator: 'equals', value: '' }]);
  };

  const updateCondition = (id: string, patch: Partial<ScoringCondition>) => {
    setConditions(cs => cs.map(c => c.id === id ? {
      ...c,
      ...patch,
      ...(patch.field ? { value: '', operator: 'equals' as FieldOperator } : {}),
    } : c));
  };

  const removeCondition = (id: string) => setConditions(cs => cs.filter(c => c.id !== id));

  const handleSave = async () => {
    if (!name.trim()) { setError('Nome é obrigatório'); return; }
    if (conditions.length === 0) { setError('Adicione pelo menos uma condição'); return; }
    if (conditions.some(c => c.operator !== 'is_set' && c.operator !== 'is_not_set' && !c.value)) {
      setError('Preencha o valor de todas as condições'); return;
    }
    setSaving(true); setError('');
    try {
      if (isEdit) {
        await updateLeadScoringRule(rule!.id, { name, logic, conditions, points, isActive });
      } else {
        await createLeadScoringRule({ name, logic, conditions, points, isActive });
      }
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar regra'); }
    finally { setSaving(false); }
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1200 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(680px,95vw)', maxHeight: '90vh', background: 'var(--bg-surface)', borderRadius: 16,
        zIndex: 1201, display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.28)', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--fg-primary)' }}>
            {isEdit ? 'Editar regra de score' : 'Nova regra de score'}
          </h2>
          <button onClick={onClose} style={{ background: 'var(--bg-muted)', border: 'none', cursor: 'pointer', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)', marginBottom: 6 }}>Nome *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Ex: Concessionária + Gestor"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--fg-primary)', outline: 'none', background: 'var(--bg-surface)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)', marginBottom: 6 }}>Pontos *</label>
              <input type="number" value={points} onChange={e => setPoints(Number(e.target.value))}
                style={{ width: 90, boxSizing: 'border-box', padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--fg-primary)', outline: 'none', background: 'var(--bg-surface)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-secondary)' }}>O lead deve atender</span>
            <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {(['AND', 'OR'] as const).map(l => (
                <button key={l} type="button" onClick={() => setLogic(l)} style={{
                  padding: '5px 16px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                  background: logic === l ? 'var(--accent)' : 'var(--bg-surface)',
                  color: logic === l ? '#fff' : 'var(--fg-muted)',
                }}>
                  {l === 'AND' ? 'TODAS' : 'QUALQUER'}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>das condições abaixo</span>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', fontSize: 13, color: 'var(--fg-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              Ativa
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {conditions.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13, border: '1.5px dashed var(--border)', borderRadius: 10 }}>
                Nenhuma condição adicionada ainda
              </div>
            )}

            {conditions.map(cond => {
              const noValue = cond.operator === 'is_set' || cond.operator === 'is_not_set';
              const fieldType = fields.find(field => field.value === cond.field)?.type ?? 'text';
              const availableOperators = fieldType === 'number'
                ? (['equals', 'gte', 'lte', 'is_set', 'is_not_set'] as FieldOperator[])
                : OPERATORS;
              return (
                <div key={cond.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <select value={cond.field} onChange={e => updateCondition(cond.id, { field: e.target.value })}
                    style={{ padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--fg-primary)', background: 'var(--bg-surface)', cursor: 'pointer', outline: 'none' }}>
                    {fields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>

                  <select value={cond.operator} onChange={e => updateCondition(cond.id, { operator: e.target.value as FieldOperator })}
                    style={{ padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--fg-primary)', background: 'var(--bg-surface)', cursor: 'pointer', outline: 'none' }}>
                    {availableOperators.map(o => <option key={o} value={o}>{OPERATOR_LABELS[o]}</option>)}
                  </select>

                  {!noValue && fieldType === 'number' && (
                    <input type="number" value={cond.value} onChange={e => updateCondition(cond.id, { value: e.target.value })}
                      placeholder="Digite o valor"
                      style={{ minWidth: 160, padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--fg-primary)', background: 'var(--bg-surface)', outline: 'none' }}
                    />
                  )}

                  {!noValue && fieldType !== 'number' && (
                    <FieldValueCombobox field={cond.field} value={cond.value} onChange={v => updateCondition(cond.id, { value: v })} />
                  )}

                  <button type="button" onClick={() => removeCondition(cond.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: 4, borderRadius: 6, display: 'flex', marginLeft: 'auto' }}>
                    <X size={14} />
                  </button>
                </div>
              );
            })}

            <button type="button" onClick={addCondition} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              border: '1.5px dashed var(--border)', borderRadius: 9, fontSize: 13, fontWeight: 600,
              color: 'var(--fg-muted)', background: 'none', cursor: 'pointer', width: 'fit-content',
            }}>
              <Plus size={14} /> Adicionar condição
            </button>
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--bg-subtle)' }}>
          <span style={{ fontSize: 12, color: 'var(--red-500)' }}>{error}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', fontSize: 13, fontWeight: 600, color: 'var(--fg-secondary)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: 'var(--accent)', fontSize: 13, fontWeight: 600, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar regra'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── LeadScoringView (main export) ────────────────────────────────────────────

export const LeadScoringView: React.FC = () => {
  const [rules, setRules]     = useState<LeadScoringRule[]>([]);
  const [fields, setFields]   = useState<ScoringField[]>(STANDARD_FIELDS);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<LeadScoringRule | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [applying, setApplying]       = useState(false);
  const [installing, setInstalling]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRules(await listLeadScoringRules()); }
    catch { setRules([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    DataService.listCustomFieldDefs()
      .then(defs => setFields([...STANDARD_FIELDS, ...defs.map(d => ({ value: d.name, label: d.label }))]))
      .catch(() => {});
  }, [load]);

  const openCreate = () => { setEditingRule(null); setBuilderOpen(true); };
  const openEdit   = (rule: LeadScoringRule) => { setEditingRule(rule); setBuilderOpen(true); };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta regra de score?')) return;
    setDeletingId(id);
    try { await deleteLeadScoringRule(id); await load(); }
    catch { alert('Erro ao excluir regra'); }
    finally { setDeletingId(null); }
  };

  const handleApplyExisting = async () => {
    if (!confirm('Recalcular a pontuação de todos os leads pelas regras ativas? O score atual será substituído pelo resultado correto das regras.')) return;
    setApplying(true);
    try {
      const result = await applyLeadScoringRulesToExisting();
      alert(
        `Concluído. ${result.updated} score(s) alterado(s) em ${result.evaluated} leads.\n\n` +
        `Nota de corte: ${result.threshold}\n` +
        `Acima do corte: ${result.bands.qualified}\n` +
        `Nutrição (40–69): ${result.bands.nurture}\n` +
        `Baixa prioridade (0–39): ${result.bands.low}`
      );
    } catch (e) {
      alert('Erro ao aplicar regras: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setApplying(false);
    }
  };

  const handleInstallRecommended = async () => {
    if (!confirm('Configurar o modelo ICP AutoForce? As regras atuais serão preservadas, mas ficarão inativas. Depois você poderá recalcular toda a base com segurança.')) return;
    setInstalling(true);
    try {
      await installRecommendedLeadScoringRules();
      await load();
      alert('Modelo ICP AutoForce configurado. Confira as regras e clique em “Recalcular todos os leads” para aplicar à base.');
    } catch (e) {
      alert('Erro ao configurar o modelo: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setInstalling(false);
    }
  };

  const fieldLabel = (field: string) => fields.find(f => f.value === field)?.label ?? field;

  return (
    <div style={{ padding: '24px', minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--fg-primary)' }}>
            Regras de Pontuação
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>
            Calculadas na entrada e atualizadas quando pesquisa, cadastro ou conversões do lead mudam
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleApplyExisting} disabled={applying || rules.length === 0} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px',
            background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 9,
            fontSize: 13, fontWeight: 600, color: 'var(--fg-secondary)', cursor: rules.length === 0 ? 'not-allowed' : 'pointer',
            opacity: applying || rules.length === 0 ? 0.6 : 1,
          }}>
            {applying ? <RefreshCw size={15} className="animate-spin" /> : <Target size={15} />} Recalcular todos os leads
          </button>
          <button onClick={openCreate} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
            background: '#111827', border: 'none', borderRadius: 9,
            fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
          }}>
            <Plus size={15} /> Nova Regra
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap',
        padding: '18px 20px', marginBottom: 20, borderRadius: 12,
        border: '1px solid #bfdbfe', background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: '1 1 480px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={19} color="#2563eb" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#172554' }}>Modelo ICP AutoForce · nota de corte 70</div>
            <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.55, color: '#475569' }}>
              Prioriza concessionárias, grupos automotivos, montadoras e revendas com cargo decisor. Pesquisa, dados de contato e engajamento reforçam a nota; leads fora do ICP e cargos sem poder de decisão recebem penalidade.
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, fontWeight: 600 }}>
              <span style={{ color: '#166534' }}>70–100 · pronto para segmentação</span>
              <span style={{ color: '#92400e' }}>40–69 · nutrição</span>
              <span style={{ color: '#64748b' }}>0–39 · baixa prioridade</span>
            </div>
          </div>
        </div>
        <button onClick={handleInstallRecommended} disabled={installing} style={{
          padding: '9px 16px', border: '1px solid #93c5fd', borderRadius: 9, background: '#fff',
          color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: installing ? 'not-allowed' : 'pointer',
          opacity: installing ? 0.65 : 1, whiteSpace: 'nowrap',
        }}>
          {installing ? 'Configurando...' : 'Configurar modelo recomendado'}
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 20, border: '1px solid var(--border)', height: 140 }} className="animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 6 }}>
            Nenhuma regra de score criada ainda
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', maxWidth: 420, margin: '0 auto' }}>
            Ex: se a Origem for "meta_ads" e o Cargo for "gestor", o lead ganha 10 pontos automaticamente
          </div>
          <button onClick={openCreate} style={{ marginTop: 20, padding: '9px 20px', background: '#111827', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
            Criar primeira regra
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
          {rules.map(rule => (
            <div key={rule.id} style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '18px 20px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12, opacity: rule.isActive ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rule.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-subtle)', marginTop: 2 }}>
                    {rule.isActive ? 'Ativa' : 'Inativa'} · lógica {rule.logic}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: 'var(--accent-soft)', borderRadius: 99, flexShrink: 0 }}>
                  <Target size={11} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{rule.points > 0 ? '+' : ''}{rule.points}</span>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--fg-muted)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {rule.conditions.slice(0, 3).map((c, i) => (
                  <span key={c.id ?? i} style={{ padding: '2px 7px', background: 'var(--bg-muted)', borderRadius: 99, fontSize: 10, fontWeight: 500 }}>
                    {fieldLabel(c.field)} {OPERATOR_LABELS[c.operator]}{c.value ? ` ${c.value}` : ''}
                  </span>
                ))}
                {rule.conditions.length > 3 && (
                  <span style={{ padding: '2px 7px', background: 'var(--bg-muted)', borderRadius: 99, fontSize: 10, color: 'var(--fg-subtle)' }}>
                    +{rule.conditions.length - 3}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                <button onClick={() => openEdit(rule)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'none', fontSize: 12, fontWeight: 600, color: 'var(--fg-primary)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                  <Edit2 size={12} /> Editar
                </button>
                <button onClick={() => handleDelete(rule.id)} disabled={deletingId === rule.id} title="Excluir" style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', fontSize: 12, color: deletingId === rule.id ? 'var(--fg-subtle)' : 'var(--fg-muted)', cursor: deletingId === rule.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {builderOpen && (
        <RuleBuilder
          rule={editingRule}
          fields={fields}
          onClose={() => setBuilderOpen(false)}
          onSaved={() => { setBuilderOpen(false); load(); }}
        />
      )}
    </div>
  );
};
