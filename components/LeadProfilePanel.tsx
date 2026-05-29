import React, { useState, useEffect, useRef } from 'react';
import {
  X, ArrowLeft, Flame, User, Mail,
  Tag, Link2, Calendar, ArrowRight, DollarSign, LayoutList,
  RefreshCw, ChevronDown, Plus, Check, PenLine,
} from 'lucide-react';
import { LeadProfile, LeadStatus, LeadCustomFieldDef } from '../types';
import { DataService } from '../services/dataService';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUSES: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'LEAD',         label: 'Lead',           color: 'var(--sl-400)' },
  { value: 'MQL',          label: 'MQL',            color: 'var(--af-500)' },
  { value: 'SQL',          label: 'SQL',            color: '#818cf8' },
  { value: 'SCHEDULED',    label: 'Agendado',       color: '#f59e0b' },
  { value: 'DEMO',         label: 'Demo',           color: '#f97316' },
  { value: 'PROPOSAL',     label: 'Proposta',       color: '#a855f7' },
  { value: 'CLIENT',       label: 'Cliente',        color: 'var(--green-500)' },
  { value: 'LOST',         label: 'Perdido',        color: 'var(--red-500)' },
  { value: 'DISQUALIFIED', label: 'Desqualificado', color: 'var(--fg-subtle)' },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s])) as Record<LeadStatus, typeof STATUSES[0]>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', opts ?? { day: '2-digit', month: 'short', year: 'numeric' });
}

function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Small reusable pieces ────────────────────────────────────────────────────

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
    <span style={{ marginTop: 2, color: 'var(--fg-subtle)', flexShrink: 0 }}>{icon}</span>
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 13, color: 'var(--fg-primary)', margin: 0, wordBreak: 'break-all' }}>{value ?? '—'}</p>
    </div>
  </div>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--fg-muted)' }}>{icon}</span>
      <h3 style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>{title}</h3>
    </div>
    <div style={{ padding: 16, background: 'var(--bg-surface)' }}>{children}</div>
  </div>
);

// ─── Status changer dropdown ──────────────────────────────────────────────────

const StatusChanger: React.FC<{
  current: LeadStatus;
  email: string;
  leadId?: string;
  onChanged: (next: LeadStatus) => void;
}> = ({ current, email, leadId, onChanged }) => {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const s = STATUS_MAP[current];

  const handleSelect = async (next: LeadStatus) => {
    if (next === current) { setOpen(false); return; }
    setLoading(true);
    setOpen(false);
    try {
      if (leadId) {
        await DataService.updateLeadStatusById(leadId, next);
      } else {
        await DataService.updateLeadStatus(email, next);
      }
      onChanged(next);
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 'var(--r-full)',
          fontSize: 12, fontWeight: 600,
          border: `1px solid ${s.color}`,
          background: `${s.color}18`,
          color: s.color,
          cursor: 'pointer', opacity: loading ? 0.5 : 1,
        }}
      >
        {loading ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : s.label}
        {!loading && <ChevronDown size={11} />}
      </button>
      {open && (
        <div style={{
          position: 'absolute', left: 0, top: '100%', marginTop: 4, zIndex: 60,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: 'var(--shadow-md)', overflow: 'hidden', minWidth: 160,
        }}>
          {STATUSES.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 16px',
                fontSize: 12, fontWeight: opt.value === current ? 700 : 500,
                color: opt.value === current ? opt.color : 'var(--fg-secondary)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                transition: 'background .1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Tags editor ─────────────────────────────────────────────────────────────

const TagsEditor: React.FC<{ email: string; leadId?: string; tags: string[]; onChange: (tags: string[]) => void }> = ({ email, leadId, tags, onChange }) => {
  const [adding, setAdding] = useState(false);
  const [value, setValue]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const handleAdd = async () => {
    const tag = value.trim();
    if (!tag) { setAdding(false); setValue(''); return; }
    try {
      const { tags: next } = leadId
        ? await DataService.addLeadTagById(leadId, tag)
        : await DataService.addLeadTag(email, tag);
      onChange(next);
    } catch { /* ignore */ }
    setValue('');
    setAdding(false);
  };

  const handleRemove = async (tag: string) => {
    try {
      const { tags: next } = leadId
        ? await DataService.removeLeadTagById(leadId, tag)
        : await DataService.removeLeadTag(email, tag);
      onChange(next);
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {tags.map(t => (
        <span key={t} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 'var(--r-full)',
          fontSize: 11, background: 'var(--bg-muted)', color: 'var(--fg-secondary)',
        }}>
          {t}
          <button type="button" onClick={() => handleRemove(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--fg-subtle)', display: 'flex' }}>
            <X size={10} />
          </button>
        </span>
      ))}
      {adding ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setValue(''); } }}
            style={{
              width: 80, padding: '2px 8px', borderRadius: 'var(--r-full)',
              fontSize: 11, background: 'var(--bg-subtle)', border: '1px solid var(--border)',
              color: 'var(--fg-primary)', outline: 'none',
            }}
            placeholder="nova tag"
          />
          <button type="button" onClick={handleAdd} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green-500)', display: 'flex' }}><Check size={12} /></button>
          <button type="button" onClick={() => { setAdding(false); setValue(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', display: 'flex' }}><X size={12} /></button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 2,
            padding: '2px 8px', borderRadius: 'var(--r-full)',
            fontSize: 11, border: '1px dashed var(--border)',
            color: 'var(--fg-subtle)', background: 'transparent', cursor: 'pointer',
          }}
        >
          <Plus size={10} /> Tag
        </button>
      )}
    </div>
  );
};

// ─── Notes editor ─────────────────────────────────────────────────────────────

const NotesEditor: React.FC<{ email: string; leadId?: string; notes: string | null }> = ({ email, leadId, notes: initialNotes }) => {
  const [notes, setNotes]   = useState(initialNotes ?? '');
  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (leadId) {
        await DataService.updateLeadNotesById(leadId, notes);
      } else {
        await DataService.updateLeadNotes(email, notes);
      }
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
          <PenLine size={12} /> Anotações
        </p>
        {dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--af-500)', background: 'none', border: 'none', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            {saving ? <RefreshCw size={11} /> : saved ? <Check size={11} style={{ color: 'var(--green-500)' }} /> : null}
            {saving ? 'Salvando...' : saved ? 'Salvo' : 'Salvar'}
          </button>
        )}
      </div>
      <textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); setDirty(true); setSaved(false); }}
        rows={4}
        placeholder="Adicione anotações sobre este lead..."
        style={{
          width: '100%', background: 'var(--bg-subtle)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--fg-primary)',
          outline: 'none', resize: 'none', boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
};

// ─── Main panel ───────────────────────────────────────────────────────────────

const ProfileFieldsEditor: React.FC<{
  profile: LeadProfile;
  onChange: (next: LeadProfile) => void;
}> = ({ profile, onChange }) => {
  const [form, setForm] = useState({
    name: profile.name ?? '',
    phone: profile.phone ?? '',
    company: profile.company ?? '',
    jobTitle: profile.jobTitle ?? '',
    city: profile.city ?? '',
    state: profile.state ?? '',
    assignedTo: profile.assignedTo ?? '',
    score: profile.score != null ? String(profile.score) : '',
    isHot: profile.isHot,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [dirty, setDirty]   = useState(false);

  useEffect(() => {
    setForm({
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      company: profile.company ?? '',
      jobTitle: profile.jobTitle ?? '',
      city: profile.city ?? '',
      state: profile.state ?? '',
      assignedTo: profile.assignedTo ?? '',
      score: profile.score != null ? String(profile.score) : '',
      isHot: profile.isHot,
    });
    setDirty(false);
  }, [profile.id]);

  const setField = (field: keyof typeof form, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await DataService.updateLeadProfileById(profile.id, {
        name: form.name,
        phone: form.phone,
        company: form.company,
        jobTitle: form.jobTitle,
        city: form.city,
        state: form.state,
        assignedTo: form.assignedTo,
        isHot: form.isHot,
        score: form.score.trim() === '' ? null : Number(form.score),
      });
      onChange({ ...profile, ...updated });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-subtle)',
    color: 'var(--fg-primary)',
    fontSize: 12,
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--fg-subtle)',
    marginBottom: 5,
  };

  const TextField = ({ field, label, type = 'text' }: { field: keyof typeof form; label: string; type?: string }) => (
    <label style={{ display: 'block' }}>
      <p style={labelStyle}>{label}</p>
      <input
        type={type}
        value={String(form[field] ?? '')}
        onChange={e => setField(field, e.target.value)}
        style={inputStyle}
      />
    </label>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <InfoRow icon={<Mail size={13} />} label="Email" value={profile.email} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <TextField field="name" label="Nome" />
        <TextField field="phone" label="Telefone" />
        <TextField field="company" label="Empresa" />
        <TextField field="jobTitle" label="Cargo" />
        <TextField field="city" label="Cidade" />
        <TextField field="state" label="Estado" />
        <TextField field="assignedTo" label="Responsavel" />
        <TextField field="score" label="Score" type="number" />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--fg-muted)' }}>
        <input type="checkbox" checked={form.isHot} onChange={e => setField('isHot', e.target.checked)} />
        Lead quente
      </label>
      {(dirty || saved) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
          {dirty && (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? .6 : 1 }}
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              {saving ? 'Salvando...' : 'Salvar dados'}
            </button>
          )}
          {saved && !dirty && <span style={{ fontSize: 13, color: 'var(--green-500)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><Check size={13} /> Salvo</span>}
        </div>
      )}
    </div>
  );
};

const CustomFieldEditor: React.FC<{
  email: string;
  leadId?: string;
  def: LeadCustomFieldDef;
  value: unknown;
  onChange: (fieldName: string, value: unknown) => void;
}> = ({ email, leadId, def, value, onChange }) => {
  const initial = value === undefined || value === null ? '' : String(value);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(value === undefined || value === null ? '' : String(value));
  }, [value]);

  const normalizeValue = () => {
    if (def.fieldType === 'number') {
      if (draft.trim() === '') return null;
      const parsed = Number(draft);
      return Number.isNaN(parsed) ? null : parsed;
    }
    if (def.fieldType === 'boolean') {
      if (draft === '') return null;
      return draft === 'true';
    }
    return draft.trim() === '' ? null : draft.trim();
  };

  const save = async () => {
    if (def.required && draft.trim() === '') return;
    const next = normalizeValue();
    const current = value === undefined || value === '' ? null : value;
    if (JSON.stringify(next) === JSON.stringify(current)) return;

    setSaving(true);
    setSaved(false);
    try {
      if (leadId) {
        await DataService.updateLeadCustomFieldById(leadId, def.name, next);
      } else {
        await DataService.updateLeadCustomField(email, def.name, next);
      }
      onChange(def.name, next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } finally {
      setSaving(false);
    }
  };

  const controlStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${def.required && draft.trim() === '' ? 'var(--red-500)' : 'var(--border)'}`,
    background: 'var(--bg-subtle)',
    color: 'var(--fg-primary)',
    fontSize: 12,
    outline: 'none',
  };

  const commonProps = {
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setDraft(e.target.value);
      setSaved(false);
    },
    onBlur: save,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (e.key === 'Enter') e.currentTarget.blur();
    },
    style: controlStyle,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <LayoutList size={13} style={{ marginTop: 24, color: 'var(--fg-subtle)', flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
          <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: 0 }}>{def.label}{def.required ? ' *' : ''}</p>
          <span style={{ fontSize: 11, color: saved ? 'var(--green-500)' : 'var(--fg-subtle)' }}>
            {saving ? 'Salvando...' : saved ? 'Salvo' : ''}
          </span>
        </div>

        {def.fieldType === 'select' ? (
          <select {...commonProps}>
            <option value="">Selecione</option>
            {def.options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : def.fieldType === 'boolean' ? (
          <select {...commonProps}>
            <option value="">Selecione</option>
            <option value="true">Sim</option>
            <option value="false">Nao</option>
          </select>
        ) : (
          <input
            {...commonProps}
            type={def.fieldType === 'number' ? 'number' : def.fieldType === 'date' ? 'date' : def.fieldType === 'url' ? 'url' : 'text'}
            placeholder={def.placeholder ?? undefined}
          />
        )}
        {def.required && draft.trim() === '' && (
          <p style={{ margin: '5px 0 0', fontSize: 11, color: 'var(--red-500)' }}>Campo obrigatorio</p>
        )}
      </div>
    </div>
  );
};

interface Props {
  email?: string;
  leadId?: string;
  onClose?: () => void;
  onStatusChange?: () => void;
  variant?: 'panel' | 'page';
}

const LeadProfilePanel: React.FC<Props> = ({ email, leadId, onClose, onStatusChange, variant = 'panel' }) => {
  const [profile, setProfile]         = useState<LeadProfile | null>(null);
  const [fieldDefs, setFieldDefs]     = useState<LeadCustomFieldDef[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingAllConversions, setLoadingAllConversions] = useState(false);
  const isPage = variant === 'page';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      leadId ? DataService.getLeadProfileById(leadId) : DataService.getLeadProfile(email ?? ''),
      DataService.listCustomFieldDefs(),
    ]).then(([p, defs]) => {
      if (cancelled) return;
      setProfile(p);
      setFieldDefs(defs.filter(d => d.visible));
    }).catch(err => {
      console.error('Erro ao carregar perfil:', err);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [email, leadId]);

  const handleStatusChanged = (next: LeadStatus) => {
    if (profile) setProfile({ ...profile, status: next });
    onStatusChange?.();
  };

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPage && e.target === e.currentTarget) onClose?.();
  };

  const missingRequiredFields = profile
    ? fieldDefs.filter(def => {
        if (!def.required) return false;
        const value = (profile.customFields as Record<string, unknown>)?.[def.name];
        return value === undefined || value === null || value === '';
      })
    : [];

  // ─── Page variant (full-width, 2-column) ─────────────────────────────────────
  if (isPage) {
    return (
      <div className="animate-fade-in-up" style={{ padding: '24px 28px 64px', maxWidth: 1480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          {onClose && (
            <button type="button" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
              <ArrowLeft size={15} /> Leads
            </button>
          )}
          {loading || !profile ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ height: 40, width: 40, borderRadius: '50%', background: 'var(--bg-muted)' }} className="animate-pulse" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ height: 20, width: 180, background: 'var(--bg-muted)', borderRadius: 6 }} className="animate-pulse" />
                <div style={{ height: 13, width: 140, background: 'var(--bg-muted)', borderRadius: 4 }} className="animate-pulse" />
              </div>
            </div>
          ) : (
            <>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={18} style={{ color: 'var(--fg-muted)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>
                    {profile.name ?? 'Sem nome'}
                  </h1>
                  {profile.isHot && <Flame size={16} style={{ color: '#fb923c' }} />}
                  <StatusChanger current={profile.status} email={profile.email} leadId={profile.id} onChanged={handleStatusChanged} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '3px 0 0' }}>{profile.email}</p>
              </div>
            </>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ height: 160, background: 'var(--bg-muted)', borderRadius: 12 }} className="animate-pulse" />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ height: 100, background: 'var(--bg-muted)', borderRadius: 12 }} className="animate-pulse" />
              ))}
            </div>
          </div>
        ) : !profile ? (
          <p style={{ textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13, padding: '64px 0' }}>Perfil não encontrado</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>

            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Section title="Dados de Contato" icon={<User size={13} />}>
                <ProfileFieldsEditor profile={profile} onChange={setProfile} />
              </Section>

              {fieldDefs.length > 0 && (
                <Section title="Campos Personalizados" icon={<LayoutList size={13} />}>
                  {missingRequiredFields.length > 0 && (
                    <div style={{ marginBottom: 12, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,.25)', background: 'rgba(239,68,68,.08)', color: 'var(--red-500)', fontSize: 12 }}>
                      {missingRequiredFields.length} campo(s) obrigatorio(s) sem preenchimento.
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {fieldDefs.map(def => {
                      const val = (profile.customFields as Record<string, unknown>)?.[def.name];
                      return (
                        <CustomFieldEditor
                          key={def.id}
                          email={profile.email}
                          leadId={profile.id}
                          def={def}
                          value={val}
                          onChange={(fieldName, nextValue) => {
                            setProfile(current => current ? {
                              ...current,
                              customFields: { ...((current.customFields as Record<string, unknown>) ?? {}), [fieldName]: nextValue },
                            } : current);
                          }}
                        />
                      );
                    })}
                  </div>
                </Section>
              )}

              <Section title="Anotações" icon={<PenLine size={13} />}>
                <NotesEditor email={profile.email} leadId={profile.id} notes={profile.notes ?? null} />
              </Section>
            </div>

            {/* Right column — sticky */}
            <div style={{ position: 'sticky', top: 24, alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
              <Section title="Tags" icon={<Tag size={13} />}>
                <TagsEditor
                  email={profile.email}
                  leadId={profile.id}
                  tags={profile.tags}
                  onChange={next => setProfile(p => p ? { ...p, tags: next } : p)}
                />
              </Section>

              <Section title="Primeira Origem" icon={<Link2 size={13} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <InfoRow icon={<Link2 size={13} />}    label="Fonte"    value={profile.firstSource} />
                  <InfoRow icon={<Link2 size={13} />}    label="Mídia"    value={profile.firstMedium} />
                  <InfoRow icon={<Link2 size={13} />}    label="Campanha" value={profile.firstCampaign} />
                  <InfoRow icon={<Calendar size={13} />} label="Primeiro contato" value={fmt(profile.firstSeenAt)} />
                  {profile.firstLandingPage && (
                    <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: '0 0 4px' }}>Landing page</p>
                      <p style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }}>{profile.firstLandingPage}</p>
                    </div>
                  )}
                  {profile.pipedriveDealId && (
                    <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Deal Pipedrive:</span>
                      {profile.pipedriveDomain ? (
                        <a
                          href={`https://${profile.pipedriveDomain}.pipedrive.com/deal/${profile.pipedriveDealId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: 'var(--green-500)', fontFamily: 'monospace', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          #{profile.pipedriveDealId}
                          <Link2 size={11} />
                        </a>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--green-500)', fontFamily: 'monospace' }}>#{profile.pipedriveDealId}</span>
                      )}
                    </div>
                  )}
                </div>
              </Section>

              {profile.conversionsTotal > 0 && (
                <Section title={`Conversões (${profile.conversionsTotal})`} icon={<LayoutList size={13} />}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {profile.conversions.map((c, i) => (
                      <div key={c.id} style={{ display: 'flex', gap: 10, paddingBottom: i < profile.conversions.length - 1 ? 8 : 0, borderBottom: i < profile.conversions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fg-subtle)', marginTop: 5, flexShrink: 0 }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-primary)' }}>{c.formName ?? c.source}</span>
                            <span style={{ fontSize: 11, color: 'var(--fg-subtle)', flexShrink: 0 }}>{fmt(c.convertedAt, { day: '2-digit', month: 'short' })}</span>
                          </div>
                          {c.campaignName && <p style={{ fontSize: 11, color: 'var(--fg-muted)', margin: '2px 0 0' }}>{c.campaignName}</p>}
                          {(c.utmSource || c.utmMedium) && (
                            <p style={{ fontSize: 11, color: 'var(--fg-subtle)', fontFamily: 'monospace', margin: '2px 0 0' }}>
                              {[c.utmSource, c.utmMedium, c.utmCampaign].filter(Boolean).join(' / ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {profile.conversionsTotal > profile.conversions.length && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>
                        Exibindo {profile.conversions.length} de {profile.conversionsTotal}
                      </span>
                      <button
                        type="button"
                        disabled={loadingAllConversions}
                        onClick={async () => {
                          setLoadingAllConversions(true);
                          try {
                            const all = await DataService.getLeadAllConversions(profile.id);
                            setProfile(p => p ? { ...p, conversions: all } : p);
                          } finally {
                            setLoadingAllConversions(false);
                          }
                        }}
                        style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, opacity: loadingAllConversions ? 0.5 : 1 }}
                      >
                        {loadingAllConversions ? <RefreshCw size={11} className="animate-spin" /> : null}
                        Ver todas {profile.conversionsTotal}
                      </button>
                    </div>
                  )}
                </Section>
              )}

              {profile.statusHistoryTotal > 0 && (
                <Section title="Histórico de Status" icon={<ArrowRight size={13} />}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {profile.statusHistory.map((h, i) => {
                      const from = STATUS_MAP[h.fromStatus];
                      const to   = STATUS_MAP[h.toStatus];
                      return (
                        <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingBottom: i < profile.statusHistory.length - 1 ? 8 : 0, borderBottom: i < profile.statusHistory.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: from.color }}>{from.label}</span>
                            <ArrowRight size={10} style={{ color: 'var(--fg-subtle)' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: to.color }}>{to.label}</span>
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            {h.reason && <p style={{ fontSize: 11, color: 'var(--fg-muted)', margin: 0 }}>{h.reason}</p>}
                            <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: 0 }}>{fmt(h.changedAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {profile.statusHistoryTotal > profile.statusHistory.length && (
                    <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--fg-subtle)', textAlign: 'center' }}>
                      Exibindo os {profile.statusHistory.length} mais recentes de {profile.statusHistoryTotal}
                    </p>
                  )}
                </Section>
              )}

              {profile.revenueEntries.length > 0 && (
                <Section title="Venda Vinculada" icon={<DollarSign size={13} />}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {profile.revenueEntries.map(rev => (
                      <div key={rev.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: 12, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10 }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-primary)', margin: 0 }}>{rev.businessName}</p>
                          <p style={{ fontSize: 11, color: 'var(--fg-muted)', margin: '2px 0 0' }}>{rev.origin} · {fmt(rev.date)}</p>
                          {rev.product.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                              {rev.product.map(p => <span key={p} style={{ padding: '1px 6px', borderRadius: 4, fontSize: 11, background: 'var(--bg-muted)', color: 'var(--fg-muted)' }}>{p}</span>)}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {rev.mrrValue > 0 && <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-500)', margin: 0 }}>{brl(rev.mrrValue)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--fg-muted)' }}>/mês</span></p>}
                          {rev.setupValue > 0 && <p style={{ fontSize: 11, color: 'var(--fg-muted)', margin: '2px 0 0' }}>{brl(rev.setupValue)} setup</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <div style={{ fontSize: 11, color: 'var(--fg-subtle)', display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 8 }}>
                <span>Primeiro contato: {fmt(profile.firstSeenAt)}</span>
                <span>Último contato: {fmt(profile.lastSeenAt)}</span>
              </div>
            </div>

          </div>
        )}
      </div>
    );
  }

  // ─── Panel variant (slide-in from right) ─────────────────────────────────────
  return (
    <div
      onClick={handleBackdrop}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
    >
      <div style={{ position: 'relative', width: 520, height: '100%', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {loading || !profile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 18, width: 140, background: 'var(--bg-muted)', borderRadius: 6 }} className="animate-pulse" />
              <div style={{ height: 12, width: 200, background: 'var(--bg-muted)', borderRadius: 4 }} className="animate-pulse" />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={18} style={{ color: 'var(--fg-muted)' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>{profile.name ?? 'Sem nome'}</h2>
                  {profile.isHot && <Flame size={14} style={{ color: '#fb923c' }} />}
                </div>
                <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '2px 0 8px' }}>{profile.email}</p>
                <StatusChanger current={profile.status} email={profile.email} leadId={profile.id} onChanged={handleStatusChanged} />
              </div>
            </div>
          )}
          {onClose && (
            <button type="button" onClick={onClose} style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>
              <X size={16} />
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 110, background: 'var(--bg-muted)', borderRadius: 12 }} className="animate-pulse" />
            ))
          ) : !profile ? (
            <p style={{ textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13, padding: '64px 0' }}>Perfil não encontrado</p>
          ) : (
            <>
              <Section title="Dados de Contato" icon={<User size={13} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <ProfileFieldsEditor profile={profile} onChange={setProfile} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <Tag size={13} style={{ marginTop: 2, color: 'var(--fg-subtle)', flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: '0 0 6px' }}>Tags</p>
                      <TagsEditor email={profile.email} leadId={profile.id} tags={profile.tags} onChange={next => setProfile(p => p ? { ...p, tags: next } : p)} />
                    </div>
                  </div>
                </div>
              </Section>
              <Section title="Primeira Origem" icon={<Link2 size={13} />}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <InfoRow icon={<Link2 size={13} />}    label="Fonte"    value={profile.firstSource} />
                  <InfoRow icon={<Link2 size={13} />}    label="Mídia"    value={profile.firstMedium} />
                  <InfoRow icon={<Link2 size={13} />}    label="Campanha" value={profile.firstCampaign} />
                  <InfoRow icon={<Calendar size={13} />} label="Primeiro contato" value={fmt(profile.firstSeenAt)} />
                </div>
                {profile.firstLandingPage && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: '0 0 4px' }}>Landing page</p>
                    <p style={{ fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }}>{profile.firstLandingPage}</p>
                  </div>
                )}
              </Section>
              {profile.conversions.length > 0 && (
                <Section title={`Conversões (${profile.conversions.length})`} icon={<LayoutList size={13} />}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {profile.conversions.map((c, i) => (
                      <div key={c.id} style={{ display: 'flex', gap: 10, paddingBottom: i < profile.conversions.length - 1 ? 8 : 0, borderBottom: i < profile.conversions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fg-subtle)', marginTop: 5, flexShrink: 0 }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-primary)' }}>{c.formName ?? c.source}</span>
                            <span style={{ fontSize: 11, color: 'var(--fg-subtle)', flexShrink: 0 }}>{fmt(c.convertedAt, { day: '2-digit', month: 'short' })}</span>
                          </div>
                          {c.campaignName && <p style={{ fontSize: 11, color: 'var(--fg-muted)', margin: '2px 0 0' }}>{c.campaignName}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
              {fieldDefs.length > 0 && (
                <Section title="Campos Personalizados" icon={<LayoutList size={13} />}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {fieldDefs.map(def => {
                      const val = (profile.customFields as Record<string, unknown>)?.[def.name];
                      return (
                        <CustomFieldEditor key={def.id} email={profile.email} leadId={profile.id} def={def} value={val}
                          onChange={(fieldName, nextValue) => {
                            setProfile(current => current ? { ...current, customFields: { ...((current.customFields as Record<string, unknown>) ?? {}), [fieldName]: nextValue } } : current);
                          }}
                        />
                      );
                    })}
                  </div>
                </Section>
              )}
              <Section title="Anotações" icon={<PenLine size={13} />}>
                <NotesEditor email={profile.email} leadId={profile.id} notes={profile.notes ?? null} />
              </Section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-subtle)', paddingBottom: 8 }}>
                <span>Primeiro contato: {fmt(profile.firstSeenAt)}</span>
                <span>Último contato: {fmt(profile.lastSeenAt)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadProfilePanel;
