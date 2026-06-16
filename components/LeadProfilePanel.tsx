import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  X, ArrowLeft, User, Mail, Phone, Building2,
  Tag, Link2, Calendar, ArrowRight, DollarSign,
  RefreshCw, ChevronDown, Plus, Check, PenLine,
  Trash2, FileText, Download, Wrench, Activity,
  ExternalLink, GitBranch, Flame, LayoutList,
  CheckCircle, XCircle, MessageCircle, Send, Bot, UserCheck,
} from 'lucide-react';
import { LeadProfile, LeadStatus, LeadCustomFieldDef, PipedriveDealEvent, LeadConversion, WhatsAppConversationMessage, EmailSent } from '../types';
import { DataService } from '../services/dataService';

const isWppEmail = (email: string) => email.startsWith('wpp_') && email.endsWith('@autoforce.internal');
const displayEmail = (email: string) => isWppEmail(email) ? null : email;

// ─── Status config ─────────────────────────────────────────────────────────────

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
(STATUS_MAP as Record<string, typeof STATUSES[0]>)['OPPORTUNITY'] = { value: 'PROPOSAL', label: 'Proposta', color: '#a855f7' };

// ─── Helpers ───────────────────────────────────────────────────────────────────

const safeUrl = (url: string | null | undefined): string =>
  url && /^https?:\/\//i.test(url) ? url : '#';

function fmt(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', opts ?? { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDayKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getConversionMeta(c: LeadConversion): { label: string; color: string; bg: string; icon: React.ReactNode } {
  const n = (c.formName || c.source || '').toLowerCase();
  if (/newsletter|inscri[çc]/.test(n)) return { label: 'Inscrição', color: '#3b82f6', bg: '#eff6ff', icon: <Mail size={12} /> };
  if (/download|ebook|e-book|material|guia/.test(n)) return { label: 'Download', color: '#8b5cf6', bg: '#f5f3ff', icon: <Download size={12} /> };
  if (/webinar|evento/.test(n)) return { label: 'Evento', color: '#f59e0b', bg: '#fffbeb', icon: <Activity size={12} /> };
  if (/ferramenta|calculadora|roi/.test(n)) return { label: 'Ferramenta', color: '#06b6d4', bg: '#ecfeff', icon: <Wrench size={12} /> };
  return { label: 'Formulário', color: '#22c55e', bg: '#f0fdf4', icon: <FileText size={12} /> };
}

// ─── Status Changer ────────────────────────────────────────────────────────────

const StatusChanger: React.FC<{
  current: LeadStatus; email: string; leadId?: string; onChanged: (next: LeadStatus) => void;
}> = ({ current, email, leadId, onChanged }) => {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const s = STATUS_MAP[current] ?? STATUS_MAP['LEAD'];

  const handleSelect = async (next: LeadStatus) => {
    if (next === current) { setOpen(false); return; }
    setLoading(true); setOpen(false);
    try {
      if (leadId) await DataService.updateLeadStatusById(leadId, next);
      else        await DataService.updateLeadStatus(email, next);
      onChanged(next);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" disabled={loading} onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 'var(--r-full)', fontSize: 12, fontWeight: 600, border: `1px solid ${s.color}`, background: `${s.color}18`, color: s.color, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
        {loading ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : s.label}
        {!loading && <ChevronDown size={11} />}
      </button>
      {open && (
        <div style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, zIndex: 60, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-md)', overflow: 'hidden', minWidth: 160 }}>
          {STATUSES.map(opt => (
            <button key={opt.value} type="button" onClick={() => handleSelect(opt.value)}
              style={{ width: '100%', textAlign: 'left', padding: '9px 16px', fontSize: 12, fontWeight: opt.value === current ? 700 : 500, color: opt.value === current ? opt.color : 'var(--fg-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Tags Editor ───────────────────────────────────────────────────────────────

const TagsEditor: React.FC<{ email: string; leadId?: string; tags: string[]; onChange: (tags: string[]) => void }> = ({ email, leadId, tags, onChange }) => {
  const [adding, setAdding] = useState(false);
  const [value, setValue]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const handleAdd = async () => {
    const tag = value.trim();
    if (!tag) { setAdding(false); setValue(''); return; }
    try {
      const { tags: next } = leadId ? await DataService.addLeadTagById(leadId, tag) : await DataService.addLeadTag(email, tag);
      onChange(next);
    } catch { /* ignore */ }
    setValue(''); setAdding(false);
  };

  const handleRemove = async (tag: string) => {
    try {
      const { tags: next } = leadId ? await DataService.removeLeadTagById(leadId, tag) : await DataService.removeLeadTag(email, tag);
      onChange(next);
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {tags.map(t => (
        <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 'var(--r-full)', fontSize: 12, background: 'var(--bg-muted)', color: 'var(--fg-secondary)', border: '1px solid var(--border)' }}>
          {t}
          <button type="button" onClick={() => handleRemove(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--fg-subtle)', display: 'flex' }}><X size={10} /></button>
        </span>
      ))}
      {adding ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input ref={inputRef} type="text" value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setValue(''); } }}
            style={{ width: 90, padding: '3px 10px', borderRadius: 'var(--r-full)', fontSize: 12, background: 'var(--bg-subtle)', border: '1px solid var(--accent)', color: 'var(--fg-primary)', outline: 'none' }}
            placeholder="nova tag" />
          <button type="button" onClick={handleAdd} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green-500)', display: 'flex' }}><Check size={13} /></button>
          <button type="button" onClick={() => { setAdding(false); setValue(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', display: 'flex' }}><X size={13} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 'var(--r-full)', fontSize: 12, border: '1px dashed var(--border)', color: 'var(--fg-muted)', background: 'transparent', cursor: 'pointer' }}>
          <Plus size={11} /> Adicionar tag
        </button>
      )}
    </div>
  );
};

// ─── Pipedrive Timeline (inline for Activity tab) ──────────────────────────────

const PIPEDRIVE_EVENT_CONFIG: Record<string, { label: (ev: PipedriveDealEvent) => string; color: string; icon: React.ReactNode }> = {
  created:       { label: ev => `Negócio criado no Pipedrive${ev.dealTitle ? ` — ${ev.dealTitle}` : ''}`, color: '#3b82f6', icon: <GitBranch size={13} /> },
  stage_changed: { label: ev => `Avançou para ${ev.toStageName ?? 'próxima etapa'}`, color: '#f59e0b', icon: <ArrowRight size={13} /> },
  value_changed: { label: _ev => 'Valor do negócio atualizado', color: '#8b5cf6', icon: <DollarSign size={13} /> },
  won:           { label: _ev => 'Negócio ganho', color: '#22c55e', icon: <CheckCircle size={13} /> },
  lost:          { label: _ev => 'Negócio perdido', color: 'var(--red-500)', icon: <XCircle size={13} /> },
  reopened:      { label: _ev => 'Negócio reaberto', color: '#f59e0b', icon: <RefreshCw size={13} /> },
};

// ─── Conversion Detail Modal ───────────────────────────────────────────────────

const ConversionDetailModal: React.FC<{ conversion: LeadConversion; onClose: () => void }> = ({ conversion, onClose }) => {
  const meta = getConversionMeta(conversion);
  const payload   = conversion.rawData?.payload;
  const normalized = conversion.rawData?.normalized;

  return ReactDOM.createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {meta.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>{conversion.formName ?? conversion.source}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: meta.color }}>{meta.label} · {fmt(conversion.convertedAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Fonte', value: conversion.source },
              { label: 'Campanha', value: conversion.campaignName },
              { label: 'UTM Source', value: conversion.utmSource },
              { label: 'UTM Medium', value: conversion.utmMedium },
              { label: 'UTM Campaign', value: conversion.utmCampaign },
              { label: 'Página', value: conversion.landingPage },
            ].map(({ label, value }) => value ? (
              <div key={label}>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-subtle)' }}>{label}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-primary)', fontFamily: label === 'Página' ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value}</p>
              </div>
            ) : null)}
          </div>

          {/* Campos recebidos (payload normalizado) */}
          {normalized && Object.keys(normalized).length > 0 && (
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Dados recebidos</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {Object.entries(normalized).map(([section, fields]) => {
                  if (!fields || typeof fields !== 'object' || Object.keys(fields as object).length === 0) return null;
                  return (
                    <div key={section}>
                      <div style={{ padding: '6px 12px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{section}</span>
                      </div>
                      {Object.entries(fields as Record<string, unknown>).map(([key, val]) => val !== null && val !== undefined && val !== '' ? (
                        <div key={key} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                          <span style={{ fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'monospace' }}>{key}</span>
                          <span style={{ fontSize: 12, color: 'var(--fg-primary)', wordBreak: 'break-all' }}>{String(val)}</span>
                        </div>
                      ) : null)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payload bruto */}
          {payload && Object.keys(payload).length > 0 && (
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Payload original</p>
              <pre style={{ margin: 0, padding: 12, background: 'var(--bg-muted)', borderRadius: 10, fontSize: 11, color: 'var(--fg-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflowY: 'auto' }}>
                {JSON.stringify(payload, null, 2)}
              </pre>
            </div>
          )}

          {!payload && !normalized && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-muted)', textAlign: 'center', padding: '16px 0' }}>
              Dados detalhados não disponíveis para esta conversão.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  email?: string;
  leadId?: string;
  onClose?: () => void;
  onStatusChange?: () => void;
  variant?: 'panel' | 'page';
}

// ─── Main component ─────────────────────────────────────────────────────────────

const LeadProfilePanel: React.FC<Props> = ({ email, leadId, onClose, onStatusChange, variant = 'panel' }) => {
  const [profile, setProfile]       = useState<LeadProfile | null>(null);
  const [fieldDefs, setFieldDefs]   = useState<LeadCustomFieldDef[]>([]);
  const [loading, setLoading]       = useState(true);
  const [deleting, setDeleting]     = useState(false);
  const [activeTab, setActiveTab]   = useState<'dados' | 'conversoes' | 'atividade' | 'whatsapp' | 'emails'>('dados');
  const [editMode, setEditMode]     = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile]   = useState(false);
  const [notes, setNotes]           = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [isHotSaving, setIsHotSaving] = useState(false);
  const [loadingAllConversions, setLoadingAllConversions] = useState(false);
  const [pipedriveEvents, setPipedriveEvents] = useState<PipedriveDealEvent[] | null>(null);
  const [pipedriveUrl, setPipedriveUrl] = useState<string | null>(null);
  const [selectedConversion, setSelectedConversion] = useState<LeadConversion | null>(null);
  const [whatsAppMessages, setWhatsAppMessages] = useState<WhatsAppConversationMessage[] | null>(null);
  const [aiHandoff, setAiHandoff]               = useState<boolean>(false);
  const [handoffSaving, setHandoffSaving]       = useState(false);
  const [wppText, setWppText]                   = useState('');
  const [wppSending, setWppSending]             = useState(false);
  const wppBottomRef = useRef<HTMLDivElement>(null);
  const [emailsSent, setEmailsSent]             = useState<EmailSent[] | null>(null);
  const [loadingEmails, setLoadingEmails]       = useState(false);

  // Edit form state
  const [form, setForm] = useState({
    name: '', phone: '', company: '', jobTitle: '', city: '', state: '', assignedTo: '', score: '',
  });
  const [customForm, setCustomForm] = useState<Record<string, unknown>>({});

  const isPage = variant === 'page';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      leadId ? DataService.getLeadProfileById(leadId) : DataService.getLeadProfile(email ?? ''),
      DataService.listCustomFieldDefs().catch(() => [] as LeadCustomFieldDef[]),
    ]).then(([p, defs]) => {
      if (cancelled) return;
      setProfile(p);
      setWhatsAppMessages(null);
      setPipedriveEvents(null);
      setPipedriveUrl(null);
      setAiHandoff(p.aiHandoff ?? false);
      setNotes(p.notes ?? '');
      setFieldDefs(defs.filter(d => d.visible));
      setForm({
        name: p.name ?? '', phone: p.phone ?? '', company: p.company ?? '',
        jobTitle: p.jobTitle ?? '', city: p.city ?? '', state: p.state ?? '',
        assignedTo: p.assignedTo ?? '', score: p.score != null ? String(p.score) : '',
      });
      setCustomForm((p.customFields as Record<string, unknown>) ?? {});
    }).catch(console.error).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [email, leadId]);

  // Load Pipedrive events as soon as profile is available (sidebar + atividade tab)
  useEffect(() => {
    if (!profile?.pipedriveDealId || pipedriveEvents !== null) return;
    DataService.getPipedriveEvents(profile.id).then(({ events, dealUrl }) => {
      setPipedriveEvents(events);
      setPipedriveUrl(dealUrl);
    }).catch(() => setPipedriveEvents([]));
  }, [profile?.pipedriveDealId, profile?.id, pipedriveEvents]);

  useEffect(() => {
    if (!profile?.id || whatsAppMessages !== null) return;
    DataService.getWhatsAppConversation(profile.id)
      .then(setWhatsAppMessages)
      .catch(() => setWhatsAppMessages([]));
  }, [profile?.id, whatsAppMessages]);

  useEffect(() => {
    if (whatsAppMessages && whatsAppMessages.length > 0) {
      wppBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [whatsAppMessages]);

  useEffect(() => {
    if (activeTab !== 'emails' || !profile?.email || loadingEmails) return;
    if (emailsSent !== null) return;
    setLoadingEmails(true);
    DataService.getLeadEmails(profile.email)
      .then(setEmailsSent)
      .catch(() => setEmailsSent([]))
      .finally(() => setLoadingEmails(false));
  }, [activeTab, profile?.email, emailsSent, loadingEmails]);

  const handleHandoffToggle = async () => {
    if (!profile || handoffSaving) return;
    const next = !aiHandoff;
    setHandoffSaving(true);
    try {
      await DataService.setLeadAiHandoff(profile.id, next);
      setAiHandoff(next);
    } catch { /* silencioso */ } finally {
      setHandoffSaving(false);
    }
  };

  const handleWppSend = async () => {
    if (!profile || !wppText.trim() || wppSending) return;
    const text = wppText.trim();
    setWppSending(true);
    try {
      await DataService.sendWhatsAppMessage(profile.id, text);
      setWppText('');
      const msgs = await DataService.getWhatsAppConversation(profile.id);
      setWhatsAppMessages(msgs);
    } catch (err: any) {
      alert(err?.message ?? 'Erro ao enviar mensagem');
    } finally {
      setWppSending(false);
    }
  };

  const handleStatusChanged = (next: LeadStatus) => {
    if (profile) setProfile({ ...profile, status: next });
    onStatusChange?.();
  };

  const handleDelete = async () => {
    if (!profile) return;
    const name = profile.name ?? profile.email;
    if (!window.confirm(`Excluir o lead "${name}" permanentemente? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try { await DataService.deleteLeadById(profile.id); onClose?.(); }
    catch { alert('Não foi possível excluir o lead. Tente novamente.'); }
    finally { setDeleting(false); }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);
    try {
      const updated = await DataService.updateLeadProfileById(profile.id, {
        name: form.name || undefined,
        phone: form.phone || undefined,
        company: form.company || undefined,
        jobTitle: form.jobTitle || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        assignedTo: form.assignedTo || undefined,
        score: form.score.trim() === '' ? null : Number(form.score),
      });
      // Save custom fields
      for (const [key, val] of Object.entries(customForm)) {
        await DataService.updateLeadCustomFieldById(profile.id, key, val).catch(() => {});
      }
      setProfile(p => p ? { ...p, ...updated, customFields: customForm } : p);
      setEditMode(false);
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2000);
    } finally { setSavingProfile(false); }
  };

  const handleSaveNotes = async () => {
    if (!profile) return;
    setSavingNotes(true);
    try { await DataService.updateLeadNotesById(profile.id, notes); }
    finally { setSavingNotes(false); }
  };

  const handleToggleHot = async () => {
    if (!profile || isHotSaving) return;
    setIsHotSaving(true);
    try {
      await DataService.updateLeadProfileById(profile.id, { isHot: !profile.isHot });
      setProfile(p => p ? { ...p, isHot: !p.isHot } : p);
    } finally { setIsHotSaving(false); }
  };

  const handleLoadAllConversions = async () => {
    if (!profile) return;
    setLoadingAllConversions(true);
    try {
      const all = await DataService.getLeadAllConversions(profile.id);
      setProfile(p => p ? { ...p, conversions: all } : p);
    } finally { setLoadingAllConversions(false); }
  };

  // ─── PAGE VARIANT ────────────────────────────────────────────────────────────

  if (isPage) {
    const inputStyle: React.CSSProperties = {
      width: '100%', boxSizing: 'border-box', padding: '8px 12px',
      borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)',
      color: 'var(--fg-primary)', fontSize: 13, outline: 'none',
    };
    const fieldLabel: React.CSSProperties = { fontSize: 11, color: 'var(--fg-subtle)', marginBottom: 4, display: 'block' };

    // Unified activity timeline
    type ActivityEvent =
      | { kind: 'status';     date: string; id: string; from: LeadStatus; to: LeadStatus; reason: string | null; by: string | null }
      | { kind: 'conversion'; date: string; id: string; conversion: LeadConversion }
      | { kind: 'pipedrive';  date: string; id: string; event: PipedriveDealEvent }
      | { kind: 'created';    date: string; id: string };

    const buildTimeline = (): ActivityEvent[] => {
      const events: ActivityEvent[] = [];
      (profile?.statusHistory ?? []).forEach(h =>
        events.push({ kind: 'status', date: h.changedAt, id: h.id, from: h.fromStatus, to: h.toStatus, reason: h.reason, by: h.changedBy }));
      (profile?.conversions ?? []).forEach(c =>
        events.push({ kind: 'conversion', date: c.convertedAt, id: c.id, conversion: c }));
      (pipedriveEvents ?? []).forEach(e =>
        events.push({ kind: 'pipedrive', date: e.occurredAt, id: e.id, event: e }));
      if (profile?.firstSeenAt)
        events.push({ kind: 'created', date: profile.firstSeenAt, id: 'created' });
      return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };

    const groupByDay = (events: ActivityEvent[]): { day: string; items: ActivityEvent[] }[] => {
      const map = new Map<string, ActivityEvent[]>();
      for (const ev of events) {
        const d = new Date(ev.date).toDateString();
        if (!map.has(d)) map.set(d, []);
        map.get(d)!.push(ev);
      }
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      return Array.from(map.entries()).map(([d, items]) => ({
        day: d === today ? `Hoje · ${fmt(items[0].date, { day: '2-digit', month: 'short', year: 'numeric' })}` :
             d === yesterday ? `Ontem · ${fmt(items[0].date, { day: '2-digit', month: 'short', year: 'numeric' })}` :
             fmt(items[0].date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
        items,
      }));
    };

    const cardStyle: React.CSSProperties = {
      border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16,
    };
    const cardHead: React.CSSProperties = {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 20px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)',
    };
    const cardHeadTitle: React.CSSProperties = {
      fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.05em',
      display: 'flex', alignItems: 'center', gap: 8,
    };
    const tabBtn = (active: boolean): React.CSSProperties => ({
      padding: '10px 14px', border: 'none', background: 'transparent',
      borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
      color: active ? 'var(--accent)' : 'var(--fg-muted)',
      fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
    });

    return (
    <>
      <div style={{ background: 'var(--bg-app)', minHeight: '100vh' }}>

        {/* ── Top bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 28px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 30 }}>
          <button type="button" onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <ArrowLeft size={14} /> Leads
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" disabled title="Em breve"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-subtle)', fontSize: 13, fontWeight: 500, cursor: 'not-allowed', opacity: 0.5 }}>
              <User size={14} /> Puxar capivara
            </button>
            <button type="button" onClick={handleDelete} disabled={deleting}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--red-100)', background: 'transparent', color: 'var(--red-600)', fontSize: 13, fontWeight: 500, cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}>
              {deleting ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
              Excluir
            </button>
          </div>
        </div>

        <div style={{ padding: '24px 28px 64px', maxWidth: 1200, margin: '0 auto' }}>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[120, 400, 200].map((h, i) => (
                <div key={i} style={{ height: h, background: 'var(--bg-muted)', borderRadius: 16 }} className="animate-pulse" />
              ))}
            </div>
          ) : !profile ? (
            <p style={{ textAlign: 'center', color: 'var(--fg-muted)', padding: '80px 0', fontSize: 14 }}>Perfil não encontrado.</p>
          ) : (

            <>
              {/* ── Header card ── */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  {/* Avatar */}
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, var(--af-600), var(--af-800))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={28} style={{ color: 'white' }} />
                  </div>

                  {/* Name + info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg-primary)', margin: 0 }}>
                        {profile.name ?? 'Sem nome'}
                      </h1>
                      <StatusChanger current={profile.status} email={profile.email} leadId={profile.id} onChanged={handleStatusChanged} />
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: 'var(--fg-muted)' }}>
                      {displayEmail(profile.email)
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Mail size={13} /> {profile.email}</span>
                        : <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--fg-subtle)', fontStyle: 'italic' }}><Mail size={13} /> Sem email cadastrado</span>
                      }
                      {profile.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={13} /> {profile.phone}</span>}
                      {(profile.company || profile.jobTitle) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Building2 size={13} />
                          {[profile.company, profile.jobTitle].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lead Score */}
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-primary)' }}>{profile.score ?? 0}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--fg-secondary)' }}>Lead Score</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--fg-subtle)' }}>
                      {profile.score ? 'pontuado' : 'Ainda sem pontuação'}
                    </p>
                  </div>

                  {/* Lead quente toggle */}
                  <div style={{ flexShrink: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: isHotSaving ? 'wait' : 'pointer' }}>
                      <div
                        onClick={handleToggleHot}
                        style={{
                          width: 40, height: 22, borderRadius: 11,
                          background: profile.isHot ? '#f97316' : 'var(--sl-200)',
                          position: 'relative', transition: 'background .2s', cursor: 'pointer',
                        }}>
                        <div style={{
                          position: 'absolute', top: 3, left: profile.isHot ? 21 : 3,
                          width: 16, height: 16, borderRadius: '50%', background: 'white',
                          transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                        }} />
                      </div>
                      <span style={{ fontSize: 13, color: profile.isHot ? '#f97316' : 'var(--fg-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {profile.isHot && <Flame size={13} />} Lead quente
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* ── Body ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

                {/* Left: tabs */}
                <div>
                  {/* Tab nav */}
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
                    <button type="button" style={tabBtn(activeTab === 'dados')} onClick={() => setActiveTab('dados')}>
                      <User size={14} /> Dados
                    </button>
                    <button type="button" style={tabBtn(activeTab === 'conversoes')} onClick={() => setActiveTab('conversoes')}>
                      <LayoutList size={14} /> Conversões
                      {profile.conversionsTotal > 0 && (
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 'var(--r-full)', background: activeTab === 'conversoes' ? 'var(--accent-soft)' : 'var(--bg-muted)', color: activeTab === 'conversoes' ? 'var(--accent)' : 'var(--fg-muted)', fontWeight: 700 }}>
                          {profile.conversionsTotal}
                        </span>
                      )}
                    </button>
                    <button type="button" style={tabBtn(activeTab === 'atividade')} onClick={() => setActiveTab('atividade')}>
                      <Activity size={14} /> Atividade
                    </button>
                    <button type="button" style={tabBtn(activeTab === 'whatsapp')} onClick={() => setActiveTab('whatsapp')}>
                      <MessageCircle size={14} /> WhatsApp
                      {whatsAppMessages && whatsAppMessages.length > 0 && (
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 'var(--r-full)', background: activeTab === 'whatsapp' ? 'var(--accent-soft)' : 'var(--bg-muted)', color: activeTab === 'whatsapp' ? 'var(--accent)' : 'var(--fg-muted)', fontWeight: 700 }}>
                          {whatsAppMessages.length}
                        </span>
                      )}
                    </button>
                    <button type="button" style={tabBtn(activeTab === 'emails')} onClick={() => setActiveTab('emails')}>
                      <Mail size={14} /> Emails
                      {emailsSent && emailsSent.length > 0 && (
                        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 'var(--r-full)', background: activeTab === 'emails' ? 'var(--accent-soft)' : 'var(--bg-muted)', color: activeTab === 'emails' ? 'var(--accent)' : 'var(--fg-muted)', fontWeight: 700 }}>
                          {emailsSent.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* ── DADOS TAB ── */}
                  {activeTab === 'dados' && (
                    <>
                      {/* Dados de Contato */}
                      <div style={cardStyle}>
                        <div style={cardHead}>
                          <span style={cardHeadTitle}><User size={13} /> Dados de Contato</span>
                          {editMode ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" onClick={() => { setEditMode(false); }}
                                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 12, cursor: 'pointer' }}>
                                Cancelar
                              </button>
                              <button type="button" onClick={handleSaveProfile} disabled={savingProfile}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: savingProfile ? 0.6 : 1 }}>
                                {savingProfile ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={12} />}
                                Salvar
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setEditMode(true)}
                              style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-secondary)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                              Editar
                            </button>
                          )}
                        </div>
                        <div style={{ padding: 20 }}>
                          {/* Email (always read-only) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <Mail size={13} style={{ color: 'var(--fg-subtle)' }} />
                            <span style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
                              {displayEmail(profile.email) ?? <em style={{ color: 'var(--fg-subtle)' }}>Sem email cadastrado</em>}
                            </span>
                          </div>

                          {editMode ? (
                            // Edit mode
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                              {([
                                { key: 'name', label: 'Nome' }, { key: 'phone', label: 'Telefone' },
                                { key: 'company', label: 'Empresa' }, { key: 'jobTitle', label: 'Cargo' },
                                { key: 'city', label: 'Cidade' }, { key: 'state', label: 'Estado' },
                                { key: 'assignedTo', label: 'Responsável' }, { key: 'score', label: 'Score', type: 'number' },
                              ] as { key: keyof typeof form; label: string; type?: string }[]).map(({ key, label, type }) => (
                                <label key={key} style={{ display: 'block' }}>
                                  <span style={fieldLabel}>{label}</span>
                                  <input type={type ?? 'text'} value={form[key]}
                                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                    style={inputStyle} />
                                </label>
                              ))}
                              {fieldDefs.map(def => (
                                <label key={def.id} style={{ display: 'block' }}>
                                  <span style={fieldLabel}>{def.label}</span>
                                  <input type="text"
                                    value={customForm[def.name] != null ? String(customForm[def.name]) : ''}
                                    onChange={e => setCustomForm(cf => ({ ...cf, [def.name]: e.target.value }))}
                                    placeholder={def.label}
                                    style={inputStyle} />
                                </label>
                              ))}
                            </div>
                          ) : (
                            // Read-only mode
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                              {([
                                { key: 'name', label: 'Nome', value: profile.name },
                                { key: 'phone', label: 'Telefone', value: profile.phone },
                                { key: 'company', label: 'Empresa', value: profile.company },
                                { key: 'jobTitle', label: 'Cargo', value: profile.jobTitle },
                                { key: 'city', label: 'Cidade', value: profile.city },
                                { key: 'state', label: 'Estado', value: profile.state },
                                { key: 'assignedTo', label: 'Responsável', value: profile.assignedTo },
                              ]).map(({ key, label, value }) => (
                                <div key={key}>
                                  <span style={fieldLabel}>{label}</span>
                                  <div style={{ ...inputStyle, color: value ? 'var(--fg-primary)' : 'var(--fg-subtle)', background: 'var(--bg-subtle)' }}>
                                    {value ?? '—'}
                                  </div>
                                </div>
                              ))}
                              {fieldDefs.map(def => {
                                const val = (profile.customFields as Record<string, unknown>)?.[def.name];
                                return (
                                  <div key={def.id}>
                                    <span style={fieldLabel}>{def.label}</span>
                                    <div style={{ ...inputStyle, color: val ? 'var(--fg-primary)' : 'var(--fg-subtle)', background: 'var(--bg-subtle)' }}>
                                      {val != null && val !== '' ? String(val) : '—'}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Anotações */}
                      <div style={cardStyle}>
                        <div style={cardHead}>
                          <span style={cardHeadTitle}><PenLine size={13} /> Anotações</span>
                        </div>
                        <div style={{ padding: 20 }}>
                          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
                            placeholder="Adicione anotações sobre este lead..."
                            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                            <button type="button" onClick={handleSaveNotes} disabled={savingNotes}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: savingNotes ? 0.6 : 1 }}>
                              {savingNotes ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                              Salvar anotação
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── CONVERSÕES TAB ── */}
                  {activeTab === 'conversoes' && (
                    <div style={cardStyle}>
                      <div style={cardHead}>
                        <span style={cardHeadTitle}><LayoutList size={13} /> Conversões · {profile.conversionsTotal}</span>
                        <button type="button"
                          onClick={() => DataService.exportLeadsCsv({ search: profile.email })}
                          style={{ fontSize: 12, color: 'var(--fg-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                          Exportar
                        </button>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-subtle)' }}>
                              {['Conversão', 'Origem / UTM', 'Página', 'Data'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {profile.conversions.map((c, i) => {
                              const meta = getConversionMeta(c);
                              return (
                                <tr key={c.id}
                                  onClick={() => setSelectedConversion(c)}
                                  style={{ borderBottom: i < profile.conversions.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                  <td style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <div style={{ width: 28, height: 28, borderRadius: 7, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color, flexShrink: 0 }}>
                                        {meta.icon}
                                      </div>
                                      <div>
                                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--fg-primary)' }}>{c.formName ?? c.source}</p>
                                        <p style={{ margin: '1px 0 0', fontSize: 11, color: meta.color }}>{meta.label}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 16px' }}>
                                    <p style={{ margin: 0, color: 'var(--fg-secondary)' }}>{c.utmSource ? `${c.utmSource}${c.utmMedium ? ' / ' + c.utmMedium : ''}` : (c.campaignName ?? '—')}</p>
                                  </td>
                                  <td style={{ padding: '12px 16px' }}>
                                    <span style={{ fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'monospace' }}>{c.landingPage ?? '—'}</span>
                                  </td>
                                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', color: 'var(--fg-muted)', fontSize: 12 }}>
                                    {fmt(c.convertedAt, { day: '2-digit', month: 'short' })} · {fmtTime(c.convertedAt)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {profile.conversionsTotal > profile.conversions.length && (
                        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>Exibindo {profile.conversions.length} de {profile.conversionsTotal}</span>
                          <button type="button" onClick={handleLoadAllConversions} disabled={loadingAllConversions}
                            style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {loadingAllConversions ? <RefreshCw size={11} className="animate-spin" /> : null}
                            Ver todas {profile.conversionsTotal}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── ATIVIDADE TAB ── */}
                  {activeTab === 'atividade' && (
                    <div style={cardStyle}>
                      <div style={cardHead}>
                        <span style={cardHeadTitle}><Activity size={13} /> Linha do Tempo</span>
                      </div>
                      <div style={{ padding: '16px 20px' }}>
                        {profile.pipedriveDealId && pipedriveEvents === null && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: 'var(--fg-subtle)' }}>
                            <RefreshCw size={12} className="animate-spin" /> Carregando eventos do Pipedrive...
                          </div>
                        )}
                        {groupByDay(buildTimeline()).map(({ day, items }) => (
                          <div key={day} style={{ marginBottom: 24 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                              {day}
                              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {items.map(ev => {
                                let icon: React.ReactNode;
                                let title: React.ReactNode;
                                let subtitle: React.ReactNode;
                                let iconColor = 'var(--fg-muted)';
                                let iconBg = 'var(--bg-muted)';

                                if (ev.kind === 'status') {
                                  const from = STATUS_MAP[ev.from] ?? { label: ev.from, color: 'var(--fg-muted)' };
                                  const to   = STATUS_MAP[ev.to]   ?? { label: ev.to,   color: 'var(--fg-muted)' };
                                  iconColor = to.color; iconBg = `${to.color}18`;
                                  icon = <ArrowRight size={13} />;
                                  title = <span>Mudou de status <strong style={{ color: from.color }}>{from.label}</strong> → <strong style={{ color: to.color }}>{to.label}</strong></span>;
                                  subtitle = ev.reason ? <span>{ev.reason}</span> : null;
                                } else if (ev.kind === 'conversion') {
                                  const meta = getConversionMeta(ev.conversion);
                                  iconColor = meta.color; iconBg = meta.bg;
                                  icon = meta.icon;
                                  const isSubscription = meta.label === 'Inscrição';
                                  title = <span>{isSubscription ? 'Inscreveu-se em' : 'Converteu em'} <strong>{ev.conversion.formName ?? ev.conversion.source}</strong></span>;
                                  subtitle = (
                                    <span>
                                      {meta.label}
                                      {ev.conversion.landingPage && <> em <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{ev.conversion.landingPage}</code></>}
                                      {ev.conversion.utmSource && <> · {ev.conversion.utmSource}{ev.conversion.utmMedium ? ' / ' + ev.conversion.utmMedium : ''}</>}
                                    </span>
                                  );
                                } else if (ev.kind === 'pipedrive') {
                                  const cfg = PIPEDRIVE_EVENT_CONFIG[ev.event.eventType] ?? PIPEDRIVE_EVENT_CONFIG['created'];
                                  iconColor = cfg.color; iconBg = `${cfg.color}18`;
                                  icon = cfg.icon;
                                  title = <span>{cfg.label(ev.event)}</span>;
                                  subtitle = ev.event.source ? <span>pipeline <strong>{ev.event.source}</strong></span> : null;
                                } else {
                                  iconColor = 'var(--af-500)'; iconBg = 'var(--af-50)';
                                  icon = <User size={13} />;
                                  title = <span>Lead criado <span style={{ fontWeight: 400, color: 'var(--fg-muted)' }}>· status inicial <strong style={{ color: STATUS_MAP['LEAD'].color }}>Lead</strong></span></span>;
                                  subtitle = profile.firstSource ? <span>Primeira origem: <strong>{profile.firstSource}</strong>{profile.firstCampaign ? ` · campanha ${profile.firstCampaign}` : ''}</span> : null;
                                }

                                return (
                                  <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      {icon}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0, paddingTop: 5 }}>
                                      <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-primary)', fontWeight: 500 }}>{title}</p>
                                      {subtitle && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-muted)', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{subtitle}</p>}
                                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--fg-subtle)' }}>{fmtTime(ev.date)}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {buildTimeline().length === 0 && (
                          <p style={{ textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13, padding: '32px 0' }}>Nenhuma atividade registrada ainda.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── WHATSAPP TAB ── */}
                  {activeTab === 'whatsapp' && (() => {
                    const senderName = profile.assignedTo || 'Você';
                    const fmtPhoneDisplay = (p: string | null) => {
                      if (!p) return '';
                      const d = p.replace(/\D/g, '');
                      if (d.startsWith('55') && d.length === 13) return `+${d.slice(0,2)} ${d.slice(2,4)} ${d.slice(4,9)}-${d.slice(9)}`;
                      if (d.startsWith('55') && d.length === 12) return `+${d.slice(0,2)} ${d.slice(2,4)} ${d.slice(4,8)}-${d.slice(8)}`;
                      return p;
                    };
                    const wppGroups = (() => {
                      if (!whatsAppMessages) return [];
                      const today = new Date(); const yest = new Date(); yest.setDate(yest.getDate()-1);
                      const groups: {label:string; key:string; msgs: WhatsAppConversationMessage[]}[] = [];
                      for (const m of whatsAppMessages) {
                        const d = new Date(m.sentAt ?? m.receivedAt ?? m.createdAt);
                        const k = d.toDateString();
                        const label = k === today.toDateString() ? 'Hoje' : k === yest.toDateString() ? 'Ontem'
                          : d.toLocaleDateString('pt-BR', { day:'2-digit', month:'long' });
                        const last = groups[groups.length-1];
                        if (last && last.key === k) last.msgs.push(m); else groups.push({label, key:k, msgs:[m]});
                      }
                      return groups;
                    })();

                    return (
                      <div style={{ ...cardStyle, overflow: 'hidden' }}>
                        {/* ── Chat header ── */}
                        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-surface)' }}>
                          {/* Avatar */}
                          <div style={{ width:40, height:40, borderRadius:'50%', background:'#25d366', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <MessageCircle size={20} color="white" />
                          </div>
                          {/* Name + status */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ margin:0, fontSize:14, fontWeight:700, color:'var(--fg-primary)' }}>{profile.name ?? 'Sem nome'}</p>
                            <p style={{ margin:0, fontSize:12, color:'var(--fg-muted)', display:'flex', alignItems:'center', gap:5 }}>
                              <span style={{ width:7, height:7, borderRadius:'50%', background:'#25d366', display:'inline-block', flexShrink:0 }} />
                              online agora{profile.phone ? ` · ${fmtPhoneDisplay(profile.phone)}` : ''}
                            </p>
                          </div>
                          {/* Mode toggle */}
                          <div style={{ display:'flex', background:'var(--bg-muted)', borderRadius:8, padding:3, gap:2 }}>
                            <button type="button" onClick={() => { if (aiHandoff) handleHandoffToggle(); }}
                              disabled={handoffSaving}
                              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: !aiHandoff ? 'var(--accent)' : 'transparent', color: !aiHandoff ? 'white' : 'var(--fg-muted)', transition:'all .15s' }}>
                              <Bot size={12} /> IA
                            </button>
                            <button type="button" onClick={() => { if (!aiHandoff) handleHandoffToggle(); }}
                              disabled={handoffSaving}
                              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: aiHandoff ? 'var(--bg-surface)' : 'transparent', color: aiHandoff ? 'var(--fg-primary)' : 'var(--fg-muted)', boxShadow: aiHandoff ? 'var(--shadow-sm)' : 'none', transition:'all .15s' }}>
                              <UserCheck size={12} /> Eu respondo
                            </button>
                          </div>
                          {/* Refresh */}
                          <button type="button" title="Atualizar"
                            onClick={() => { setWhatsAppMessages(null); DataService.getWhatsAppConversation(profile.id).then(setWhatsAppMessages).catch(() => setWhatsAppMessages([])); }}
                            style={{ width:32, height:32, borderRadius:6, border:'1px solid var(--border)', background:'transparent', color:'var(--fg-muted)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <RefreshCw size={13} />
                          </button>
                        </div>

                        {/* ── Status bar ── */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 16px', background: aiHandoff ? '#fff7ed' : '#f0fdf4', borderBottom:`1px solid ${aiHandoff?'#fed7aa':'#bbf7d0'}`, fontSize:12 }}>
                          <span style={{ display:'flex', alignItems:'center', gap:6, color: aiHandoff ? '#92400e' : '#166534', fontWeight:500 }}>
                            <span style={{ width:6, height:6, borderRadius:'50%', background: aiHandoff?'#f97316':'#22c55e', flexShrink:0 }} />
                            {aiHandoff ? `Você está no controle — IA pausada` : `IA no controle — respondendo automaticamente`}
                          </span>
                          {!aiHandoff && (
                            <button type="button" onClick={handleHandoffToggle} disabled={handoffSaving}
                              style={{ fontSize:11, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontWeight:600, padding:0 }}>
                              Clique em "Eu respondo" para assumir
                            </button>
                          )}
                        </div>

                        {/* ── Messages ── */}
                        <div style={{ padding:'16px 12px', background:'#ece5dd', minHeight:320, maxHeight:460, overflowY:'auto', display:'flex', flexDirection:'column', gap:0 }}>
                          {whatsAppMessages === null ? (
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, height:260, color:'#666', fontSize:13 }}>
                              <RefreshCw size={14} className="animate-spin" /> Carregando conversa...
                            </div>
                          ) : whatsAppMessages.length === 0 ? (
                            <div style={{ display:'grid', placeItems:'center', height:260, color:'#888', fontSize:13, textAlign:'center' }}>
                              Nenhuma mensagem ainda. Envie a primeira!
                            </div>
                          ) : (
                            <>
                              {wppGroups.map(group => (
                                <div key={group.key}>
                                  {/* Date separator */}
                                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', margin:'12px 0 10px' }}>
                                    <span style={{ background:'rgba(255,255,255,.75)', color:'#555', fontSize:11, fontWeight:600, padding:'3px 12px', borderRadius:8, boxShadow:'0 1px 2px rgba(0,0,0,.1)' }}>
                                      {group.label}
                                    </span>
                                  </div>
                                  {/* Messages in this day */}
                                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                    {group.msgs.map(msg => {
                                      const out = msg.direction === 'outbound';
                                      const ts = fmtTime(msg.sentAt ?? msg.receivedAt ?? msg.createdAt);
                                      const body = msg.text || (msg.templateName ? `📋 ${msg.templateName}` : `(${msg.type})`);
                                      const isTemplate = !!msg.templateName;
                                      const attribution = out
                                        ? (isTemplate ? `Automação · ${msg.templateName}` : `Você · ${senderName}`)
                                        : null;
                                      const bubbleBg = out ? (isTemplate ? '#cfe9ba' : '#d9fdd3') : '#ffffff';
                                      const statusIcon = msg.status==='read' ? '✓✓' : msg.status==='delivered' ? '✓✓' : msg.status==='sent' ? '✓' : msg.status==='failed' ? '✗' : '';
                                      const statusColor = msg.status==='read' ? '#53bdeb' : msg.status==='failed' ? '#ef4444' : '#aaa';
                                      return (
                                        <div key={msg.id} style={{ display:'flex', justifyContent: out?'flex-end':'flex-start', padding:'0 8px', marginBottom:2 }}>
                                          <div style={{ maxWidth:'72%' }}>
                                            {attribution && (
                                              <p style={{ margin:'0 4px 2px', fontSize:10, color:'#666', textAlign:'right', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4 }}>
                                                {isTemplate ? <Bot size={9}/> : <UserCheck size={9}/>} {attribution}
                                              </p>
                                            )}
                                            <div style={{ background:bubbleBg, borderRadius: out?'12px 2px 12px 12px':'2px 12px 12px 12px', padding:'8px 10px', boxShadow:'0 1px 2px rgba(0,0,0,.12)', position:'relative' }}>
                                              <p style={{ margin:0, fontSize:13, lineHeight:1.45, whiteSpace:'pre-wrap', wordBreak:'break-word', color:'#111' }}>{body}</p>
                                              <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4, marginTop:4 }}>
                                                <span style={{ fontSize:10, color:'#666' }}>{ts}</span>
                                                {out && <span style={{ fontSize:10, color: statusColor, fontWeight:600 }}>{statusIcon}</span>}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                              <div ref={wppBottomRef} />
                            </>
                          )}
                        </div>

                        {/* ── Compose ── */}
                        <div style={{ borderTop:'1px solid var(--border)', background:'var(--bg-surface)' }}>
                          <div style={{ display:'flex', alignItems:'flex-end', gap:10, padding:'10px 14px' }}>
                            <textarea
                              value={wppText}
                              onChange={e => setWppText(e.target.value)}
                              onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); void handleWppSend(); } }}
                              placeholder="Digite uma mensagem..."
                              rows={1}
                              style={{ flex:1, resize:'none', border:'1px solid var(--border)', borderRadius:22, padding:'9px 16px', fontSize:13, fontFamily:'inherit', background:'var(--bg-app)', color:'var(--fg-primary)', outline:'none', lineHeight:1.5, maxHeight:100, overflowY:'auto' }}
                            />
                            <button type="button" onClick={handleWppSend}
                              disabled={!wppText.trim() || wppSending || !profile.phone}
                              title={!profile.phone ? 'Lead sem telefone cadastrado' : 'Enviar mensagem'}
                              style={{ width:40, height:40, borderRadius:'50%', border:'none', background:'var(--accent)', color:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, opacity:(!wppText.trim()||wppSending||!profile.phone)?0.4:1, transition:'opacity .15s' }}>
                              {wppSending ? <RefreshCw size={16} style={{animation:'spin 1s linear infinite'}}/> : <Send size={16}/>}
                            </button>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', padding:'0 16px 10px', fontSize:11, color:'var(--fg-subtle)' }}>
                            <span>Enter envia · Shift+Enter quebra linha</span>
                            <span style={{ display:'flex', alignItems:'center', gap:4 }}><UserCheck size={10}/> Enviando como <strong>{senderName}</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── EMAILS TAB ── */}
                  {activeTab === 'emails' && (
                    <div>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Mail size={16} color="white" />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{profile.name || profile.email}</div>
                            <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{profile.email}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setEmailsSent(null); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 12, cursor: 'pointer' }}
                        >
                          <RefreshCw size={12} /> Atualizar
                        </button>
                      </div>

                      {/* Métricas rápidas */}
                      {emailsSent && emailsSent.length > 0 && (() => {
                        const total     = emailsSent.length;
                        const opened    = emailsSent.filter(e => ['opened','clicked'].includes(e.status)).length;
                        const clicked   = emailsSent.filter(e => e.status === 'clicked').length;
                        const bounced   = emailsSent.filter(e => e.status === 'bounced').length;
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                            {([
                              { label: 'Enviados',  value: total,   color: '#6366f1' },
                              { label: 'Abertos',   value: opened,  color: '#10b981' },
                              { label: 'Clicados',  value: clicked, color: '#f59e0b' },
                              { label: 'Bounced',   value: bounced, color: '#ef4444' },
                            ] as { label: string; value: number; color: string }[]).map(stat => (
                              <div key={stat.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                                <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>{stat.label}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Lista de emails */}
                      {loadingEmails ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)', fontSize: 13 }}>
                          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                          <div>Carregando emails...</div>
                        </div>
                      ) : !emailsSent || emailsSent.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 48, color: 'var(--fg-muted)' }}>
                          <Mail size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Nenhum email enviado</div>
                          <div style={{ fontSize: 12 }}>Emails enviados por automações aparecem aqui com métricas de abertura e clique.</div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {emailsSent.map(email => {
                            const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
                              sent:       { label: 'Enviado',    color: '#6366f1', bg: '#eef2ff' },
                              delivered:  { label: 'Entregue',   color: '#10b981', bg: '#d1fae5' },
                              opened:     { label: 'Aberto',     color: '#10b981', bg: '#d1fae5' },
                              clicked:    { label: 'Clicado',    color: '#f59e0b', bg: '#fef3c7' },
                              bounced:    { label: 'Bounced',    color: '#ef4444', bg: '#fee2e2' },
                              complained: { label: 'Spam',       color: '#dc2626', bg: '#fee2e2' },
                              failed:     { label: 'Falhou',     color: '#9ca3af', bg: '#f3f4f6' },
                            };
                            const s = statusConfig[email.status] ?? statusConfig['sent'];
                            const sentDate = new Date(email.sentAt).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
                            return (
                              <div key={email.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject}</div>
                                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span>{sentDate}</span>
                                      {email.fromName && <span>· de {email.fromName}</span>}
                                    </div>
                                  </div>
                                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--r-full)', color: s.color, background: s.bg }}>
                                    {s.label}
                                  </span>
                                </div>
                                {(email.openedAt || email.clickedAt) && (
                                  <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 11, color: 'var(--fg-muted)' }}>
                                    {email.openedAt && <span>Aberto: {new Date(email.openedAt).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>}
                                    {email.clickedAt && <span>Clicado: {new Date(email.clickedAt).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Right sidebar ── */}
                <div style={{ position: 'sticky', top: 73, display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Tags */}
                  <div style={cardStyle}>
                    <div style={cardHead}>
                      <span style={cardHeadTitle}><Tag size={13} /> Tags</span>
                    </div>
                    <div style={{ padding: 16 }}>
                      <TagsEditor email={profile.email} leadId={profile.id} tags={profile.tags}
                        onChange={next => setProfile(p => p ? { ...p, tags: next } : p)} />
                    </div>
                  </div>

                  {/* Primeira Origem */}
                  <div style={cardStyle}>
                    <div style={cardHead}>
                      <span style={cardHeadTitle}><Link2 size={13} /> Primeira Origem</span>
                    </div>
                    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {[
                        { icon: <Link2 size={13} />, label: 'Fonte', value: profile.firstSource },
                        { icon: <Activity size={13} />, label: 'Mídia', value: profile.firstMedium },
                        { icon: <Tag size={13} />, label: 'Campanha', value: profile.firstCampaign },
                        { icon: <Calendar size={13} />, label: 'Primeiro contato', value: fmt(profile.firstSeenAt) },
                      ].map(({ icon, label, value }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ color: 'var(--fg-subtle)', marginTop: 2, flexShrink: 0 }}>{icon}</span>
                          <div>
                            <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-subtle)' }}>{label}</p>
                            <p style={{ margin: 0, fontSize: 13, color: value && value !== '—' ? 'var(--fg-primary)' : 'var(--fg-subtle)' }}>{value ?? '—'}</p>
                          </div>
                        </div>
                      ))}
                      {profile.firstLandingPage && (
                        <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                          <p style={{ margin: '0 0 3px', fontSize: 11, color: 'var(--fg-subtle)' }}>Landing page</p>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{profile.firstLandingPage}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Funil Pipedrive */}
                  {profile.pipedriveDealId && (
                    <div style={cardStyle}>
                      <div style={cardHead}>
                        <span style={cardHeadTitle}><GitBranch size={13} /> Funil Pipedrive</span>
                        <span style={{ fontSize: 12, color: 'var(--fg-subtle)', fontFamily: 'monospace' }}>#{profile.pipedriveDealId}</span>
                      </div>
                      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-muted)' }}>
                          {pipedriveEvents === null
                            ? 'Carregando...'
                            : `${pipedriveEvents.length} movimentação${pipedriveEvents.length !== 1 ? 'ões' : ''} registrada${pipedriveEvents.length !== 1 ? 's' : ''}.`}
                        </p>
                        {pipedriveUrl && (
                          <a href={pipedriveUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                            Abrir no Pipedrive <ExternalLink size={11} />
                          </a>
                        )}
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-subtle)' }}>
                          Veja os detalhes na aba <strong>Atividade</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Venda Vinculada */}
                  {profile.revenueEntries.length > 0 && (
                    <div style={cardStyle}>
                      <div style={cardHead}>
                        <span style={cardHeadTitle}><DollarSign size={13} /> Venda Vinculada</span>
                      </div>
                      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {profile.revenueEntries.map(rev => (
                          <div key={rev.id} style={{ padding: 12, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)' }}>{rev.businessName}</p>
                            {rev.mrrValue > 0 && <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 700, color: 'var(--green-500)' }}>{brl(rev.mrrValue)}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--fg-muted)' }}>/mês</span></p>}
                            {rev.setupValue > 0 && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--fg-muted)' }}>{brl(rev.setupValue)} setup</p>}
                            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--fg-subtle)' }}>{rev.origin} · {fmt(rev.date)}</p>
                            {(rev.dealUrl || rev.contractLink) && (
                              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                {rev.dealUrl && <a href={safeUrl(rev.dealUrl)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>↗ Pipedrive</a>}
                                {rev.contractLink && <a href={safeUrl(rev.contractLink)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>↗ Contrato</a>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {selectedConversion && (
        <ConversionDetailModal conversion={selectedConversion} onClose={() => setSelectedConversion(null)} />
      )}
    </>
    );
  }

  // ─── PANEL VARIANT (slide-in) ─────────────────────────────────────────────────

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div onClick={handleBackdrop} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}>
      <div style={{ position: 'relative', width: 520, height: '100%', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {loading || !profile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ height: 18, width: 140, background: 'var(--bg-muted)', borderRadius: 6 }} className="animate-pulse" />
              <div style={{ height: 12, width: 200, background: 'var(--bg-muted)', borderRadius: 4 }} className="animate-pulse" />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--af-600), var(--af-800))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={18} style={{ color: 'white' }} />
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
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 110, background: 'var(--bg-muted)', borderRadius: 12 }} className="animate-pulse" />
          )) : !profile ? (
            <p style={{ textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13, padding: '64px 0' }}>Perfil não encontrado</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', background: 'var(--bg-muted)', borderRadius: 12 }}>
                {profile.phone   && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--fg-secondary)' }}><Phone size={13} style={{ color: 'var(--fg-subtle)' }} />{profile.phone}</div>}
                {profile.company && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--fg-secondary)' }}><Building2 size={13} style={{ color: 'var(--fg-subtle)' }} />{profile.company}{profile.jobTitle ? ` · ${profile.jobTitle}` : ''}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <Tag size={13} style={{ color: 'var(--fg-subtle)' }} />
                  <TagsEditor email={profile.email} leadId={profile.id} tags={profile.tags} onChange={next => setProfile(p => p ? { ...p, tags: next } : p)} />
                </div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
                  <Link2 size={12} style={{ color: 'var(--fg-muted)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Primeira Origem</span>
                </div>
                <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[['Fonte', profile.firstSource], ['Mídia', profile.firstMedium], ['Campanha', profile.firstCampaign], ['Contato', fmt(profile.firstSeenAt)]].map(([label, val]) => (
                    <div key={label as string}>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-subtle)' }}>{label}</p>
                      <p style={{ margin: '1px 0 0', fontSize: 12, color: 'var(--fg-primary)' }}>{val ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
              {profile.conversions.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
                    <LayoutList size={12} style={{ color: 'var(--fg-muted)' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Conversões ({profile.conversionsTotal})</span>
                  </div>
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {profile.conversions.slice(0, 5).map((c, i) => (
                      <div key={c.id} style={{ display: 'flex', gap: 8, paddingBottom: i < Math.min(profile.conversions.length, 5) - 1 ? 8 : 0, borderBottom: i < Math.min(profile.conversions.length, 5) - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: getConversionMeta(c).color, marginTop: 5, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: 'var(--fg-primary)' }}>{c.formName ?? c.source}</p>
                          <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--fg-subtle)' }}>{fmt(c.convertedAt, { day: '2-digit', month: 'short' })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadProfilePanel;
