import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Send, Tag, Users, Layers, Calendar, Search, X,
  RefreshCw, AlertCircle, CheckCircle, Trash2, MessageCircle, Clock, XCircle, Phone,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { DataService } from '../services/dataService';

// ─── Types ───────────────────────────────────────────────────────────────────

type BlastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
type AudienceType = 'tag' | 'segment' | 'individual';

interface WhatsAppBlast {
  id: string;
  name: string;
  phoneNumberId: string;
  templateName: string;
  templateLanguage: string;
  varMappings: Record<string, string>;
  audienceType: AudienceType;
  audienceValue: string;
  audienceCount: number;
  status: BlastStatus;
  scheduledAt: string | null;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
  createdAt: string;
}

interface WhatsAppNumberOption {
  id: string;
  display_phone_number: string;
  label: string | null;
}

interface WhatsAppTemplateOption {
  id: string;
  name: string;
  status: string;
  language: string;
  components: Array<{ type: string; format?: string; text?: string }>;
}

interface SegmentOption {
  id: string;
  name: string;
  leadCount: number;
}

interface LeadOption {
  email: string;
  name: string | null;
}

// Mesmas chaves usadas em leadFieldValues no backend (whatsapp-blasts.routes.ts
// e automation-engine.service.ts) — pra variável mapeada sempre resolver.
const LEAD_FIELDS = [
  { value: 'name',        label: 'Nome completo' },
  { value: 'email',       label: 'Email' },
  { value: 'phone',       label: 'Telefone' },
  { value: 'jobTitle',    label: 'Cargo' },
  { value: 'companyName', label: 'Empresa' },
  { value: 'status',      label: 'Etapa' },
  { value: 'score',       label: 'Score' },
];

function extractTemplateVars(components: WhatsAppTemplateOption['components']): string[] {
  const vars: string[] = [];
  for (const comp of components) {
    if ((comp.type === 'HEADER' || comp.type === 'BODY') && comp.text) {
      const matches = comp.text.match(/\{\{[^}]+\}\}/g) ?? [];
      vars.push(...matches);
    }
  }
  const isNumeric = (v: string) => /^\{\{\d+\}\}$/.test(v);
  return [...new Set(vars)].sort((a, b) => {
    const aNum = isNumeric(a), bNum = isNumeric(b);
    if (aNum && bNum) return parseInt(a.replace(/\D/g, '')) - parseInt(b.replace(/\D/g, ''));
    if (aNum !== bNum) return aNum ? -1 : 1;
    return a.localeCompare(b);
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<BlastStatus, { label: string; color: string; dot: string }> = {
  draft:     { label: 'Rascunho', color: '#6b7280', dot: '#9ca3af' },
  scheduled: { label: 'Agendado', color: '#d97706', dot: '#f59e0b' },
  sending:   { label: 'Enviando', color: '#2563eb', dot: '#3b82f6' },
  sent:      { label: 'Enviado',  color: '#059669', dot: '#10b981' },
  failed:    { label: 'Falhou',   color: '#dc2626', dot: '#ef4444' },
  cancelled: { label: 'Cancelado', color: '#6b7280', dot: '#9ca3af' },
};

const AUDIENCE_ICON: Record<AudienceType, React.ElementType> = {
  tag: Tag, segment: Layers, individual: Users,
};

const AUDIENCE_LABEL: Record<AudienceType, string> = {
  tag: 'Tag', segment: 'Segmento', individual: 'Individual',
};

// ─── New Blast Modal ───────────────────────────────────────────────────────────

const NewBlastModal: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [step, setStep] = useState<'number' | 'template' | 'audience' | 'schedule'>('number');

  const [numbers, setNumbers]     = useState<WhatsAppNumberOption[]>([]);
  const [phoneNumberId, setPhoneNumberId] = useState('');

  const [templates, setTemplates] = useState<WhatsAppTemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [headerMediaId, setHeaderMediaId] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [varMappings, setVarMappings] = useState<Record<string, string>>({});

  const [audienceType, setAudienceType] = useState<AudienceType>('tag');
  const [tags, setTags]           = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [segments, setSegments]   = useState<SegmentOption[]>([]);
  const [selectedSegment, setSelectedSegment] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState<LeadOption[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<LeadOption[]>([]);

  const [name, setName] = useState('');
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<WhatsAppNumberOption[]>('/whatsapp/numbers').then(setNumbers).catch(() => {});
    apiClient.get<string[]>('/lead-hub/tags').then(setTags).catch(() => {});
    apiClient.get<SegmentOption[]>('/segments').then(setSegments).catch(() => {});
  }, []);

  useEffect(() => {
    if (!phoneNumberId) { setTemplates([]); return; }
    setTemplatesLoading(true);
    apiClient.get<WhatsAppTemplateOption[]>(`/whatsapp/templates?phoneNumberId=${encodeURIComponent(phoneNumberId)}`)
      .then(t => setTemplates(t.filter(tpl => tpl.status === 'APPROVED')))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, [phoneNumberId]);

  useEffect(() => {
    if (leadSearch.trim().length < 2) { setLeadResults([]); return; }
    const t = setTimeout(() => {
      apiClient.get<{ leads: LeadOption[] }>(`/lead-hub?search=${encodeURIComponent(leadSearch)}&pageSize=10`)
        .then(res => setLeadResults(res.leads ?? []))
        .catch(() => setLeadResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [leadSearch]);

  const audienceValue = audienceType === 'tag' ? selectedTag
    : audienceType === 'segment' ? selectedSegment
    : JSON.stringify(selectedLeads.map(l => l.email));

  const hasAudience = audienceType === 'individual' ? selectedLeads.length > 0 : Boolean(audienceValue);

  useEffect(() => {
    if (!hasAudience) { setPreviewCount(null); return; }
    setPreviewLoading(true);
    apiClient.get<{ count: number }>(`/whatsapp-blasts/audience-preview?audienceType=${audienceType}&audienceValue=${encodeURIComponent(audienceValue)}`)
      .then(res => setPreviewCount(res.count))
      .catch(() => setPreviewCount(null))
      .finally(() => setPreviewLoading(false));
  }, [audienceType, audienceValue, hasAudience]);

  const selectedTemplate = templates.find(t => t.name === templateName);
  const templateVars = selectedTemplate ? extractTemplateVars(selectedTemplate.components) : [];
  const bodyText = selectedTemplate?.components.find(c => c.type === 'BODY')?.text ?? '';
  const varsMapped = templateVars.every(v => varMappings[v]);

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Dê um nome para este disparo.'); return; }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/whatsapp-blasts', {
        name: name.trim(),
        phoneNumberId,
        templateName,
        templateLanguage: selectedTemplate?.language ?? 'pt_BR',
        varMappings,
        headerMediaUrl: headerMediaUrl.trim() || undefined,
        headerMediaId: headerMediaId || undefined,
        audienceType,
        audienceValue,
        scheduledAt: sendMode === 'schedule' && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        sendNow: sendMode === 'now',
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar disparo');
    } finally {
      setSaving(false);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  };
  const boxStyle: React.CSSProperties = {
    background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 580, maxHeight: '90vh',
    overflow: 'auto', display: 'flex', flexDirection: 'column',
  };
  const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0,
  };
  const inputStyle: React.CSSProperties = {
    fontSize: 13, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg-subtle)', color: 'var(--fg-primary)', outline: 'none', width: '100%',
  };
  const chipStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20,
    background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12, fontWeight: 600,
  };

  return ReactDOM.createPortal(
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={boxStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Send size={17} style={{ color: 'var(--accent)' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--fg-primary)' }}>Novo Disparo de WhatsApp</h2>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* STEP: número */}
          {step === 'number' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Número de envio</span>
                <select value={phoneNumberId} onChange={e => { setPhoneNumberId(e.target.value); setTemplateName(''); setVarMappings({}); }} style={inputStyle}>
                  <option value="">Selecione um número...</option>
                  {numbers.map(n => (
                    <option key={n.id} value={n.id}>{(n.label ?? n.display_phone_number)} — {n.display_phone_number}</option>
                  ))}
                </select>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>
                  Não achou o número? Cadastre em <a href="/ai-agents" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Agentes de IA → Número</a>.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" disabled={!phoneNumberId} onClick={() => setStep('template')}
                  style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: phoneNumberId ? 'var(--accent)' : 'var(--bg-muted)', color: phoneNumberId ? 'white' : 'var(--fg-subtle)', fontSize: 13, fontWeight: 700, cursor: phoneNumberId ? 'pointer' : 'not-allowed' }}>
                  Continuar
                </button>
              </div>
            </>
          )}

          {/* STEP: template */}
          {step === 'template' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Template aprovado</span>
                {templatesLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--fg-muted)' }}>
                    <RefreshCw size={13} className="animate-spin" /> Carregando templates...
                  </div>
                ) : (
                  <select value={templateName} onChange={e => { setTemplateName(e.target.value); setVarMappings({}); setHeaderMediaUrl(''); setHeaderMediaId(''); }} style={inputStyle}>
                    <option value="">Selecione um template...</option>
                    {templates.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                )}
                {selectedTemplate?.components.some(c => ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(String(c.format ?? '').toUpperCase())) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Mídia do cabeçalho</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf" disabled={uploadingMedia} onChange={async e => {
                      const file = e.target.files?.[0]; if (!file || !phoneNumberId) return;
                      setUploadingMedia(true); setError(null);
                      try { const result = await DataService.uploadWhatsAppMedia(phoneNumberId, file); setHeaderMediaId(result.id); setHeaderMediaUrl(''); }
                      catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível subir a mídia.'); }
                      finally { setUploadingMedia(false); }
                    }} style={{ ...inputStyle, padding: 7 }} />
                    {uploadingMedia ? <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Enviando mídia para a Meta…</span> : headerMediaId ? <span style={{ fontSize: 11, color: 'var(--green-600)' }}>Mídia carregada e pronta para o disparo.</span> : <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Ou use uma URL pública abaixo.</span>}
                    <input type="url" value={headerMediaUrl} onChange={e => { setHeaderMediaUrl(e.target.value); setHeaderMediaId(''); }} placeholder="https://seu-dominio.com/arquivo.jpg" style={inputStyle} />
                  </div>
                )}
                {!templatesLoading && templates.length === 0 && (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-muted)' }}>Nenhum template aprovado nessa conta ainda.</p>
                )}
              </div>

              {bodyText && (
                <div style={{ background: '#f0f2f5', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ background: 'white', borderRadius: '3px 12px 12px 12px', padding: '10px 12px', fontSize: 13, lineHeight: 1.5, color: '#111', whiteSpace: 'pre-wrap' }}>
                    {bodyText}
                  </div>
                </div>
              )}

              {templateVars.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Variáveis do template</span>
                  {templateVars.map(placeholder => (
                    <div key={placeholder} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8, alignItems: 'center' }}>
                      <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#10B981', fontFamily: 'monospace' }}>
                        {placeholder}
                      </div>
                      <select value={varMappings[placeholder] ?? ''} onChange={e => setVarMappings(prev => ({ ...prev, [placeholder]: e.target.value }))} style={inputStyle}>
                        <option value="">Campo do lead...</option>
                        {LEAD_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" onClick={() => setStep('number')} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer' }}>
                  Voltar
                </button>
                <button type="button" disabled={!templateName || !varsMapped} onClick={() => setStep('audience')}
                  style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: (templateName && varsMapped) ? 'var(--accent)' : 'var(--bg-muted)', color: (templateName && varsMapped) ? 'white' : 'var(--fg-subtle)', fontSize: 13, fontWeight: 700, cursor: (templateName && varsMapped) ? 'pointer' : 'not-allowed' }}>
                  Continuar
                </button>
              </div>
            </>
          )}

          {/* STEP: audience */}
          {step === 'audience' && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['tag', 'segment', 'individual'] as AudienceType[]).map(type => {
                  const Icon = AUDIENCE_ICON[type];
                  const active = audienceType === type;
                  return (
                    <button key={type} type="button" onClick={() => setAudienceType(type)}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '12px 8px', borderRadius: 10, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-soft)' : 'var(--bg-subtle)', color: active ? 'var(--accent)' : 'var(--fg-muted)', cursor: 'pointer' }}>
                      <Icon size={16} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{AUDIENCE_LABEL[type]}</span>
                    </button>
                  );
                })}
              </div>

              {audienceType === 'tag' && (
                <select value={selectedTag} onChange={e => setSelectedTag(e.target.value)} style={inputStyle}>
                  <option value="">Selecione uma tag...</option>
                  {tags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                </select>
              )}

              {audienceType === 'segment' && (
                <select value={selectedSegment} onChange={e => setSelectedSegment(e.target.value)} style={inputStyle}>
                  <option value="">Selecione um segmento...</option>
                  {segments.map(seg => <option key={seg.id} value={seg.id}>{seg.name} ({seg.leadCount.toLocaleString('pt-BR')} leads)</option>)}
                </select>
              )}

              {audienceType === 'individual' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                    <input value={leadSearch} onChange={e => setLeadSearch(e.target.value)} placeholder="Buscar lead por nome ou email..."
                      style={{ ...inputStyle, paddingLeft: 30 }} />
                  </div>
                  {leadResults.length > 0 && (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      {leadResults.map(lead => (
                        <div key={lead.email}
                          onClick={() => {
                            if (!selectedLeads.some(l => l.email === lead.email)) setSelectedLeads(prev => [...prev, lead]);
                            setLeadSearch(''); setLeadResults([]);
                          }}
                          style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          {lead.name || lead.email} {lead.name && <span style={{ color: 'var(--fg-muted)' }}>— {lead.email}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedLeads.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {selectedLeads.map(lead => (
                        <span key={lead.email} style={chipStyle}>
                          {lead.name || lead.email}
                          <X size={11} style={{ cursor: 'pointer' }} onClick={() => setSelectedLeads(prev => prev.filter(l => l.email !== lead.email))} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--fg-secondary)' }}>
                {previewLoading ? (
                  <><RefreshCw size={14} className="animate-spin" /> Calculando audiência...</>
                ) : previewCount !== null ? (
                  <><Users size={14} style={{ color: 'var(--accent)' }} /> <strong>{previewCount.toLocaleString('pt-BR')}</strong>&nbsp;leads com telefone vão receber esta mensagem</>
                ) : (
                  <span style={{ color: 'var(--fg-muted)' }}>Selecione a audiência para ver quantos leads serão alcançados.</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" onClick={() => setStep('template')} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer' }}>
                  Voltar
                </button>
                <button type="button" disabled={!hasAudience} onClick={() => setStep('schedule')}
                  style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: hasAudience ? 'var(--accent)' : 'var(--bg-muted)', color: hasAudience ? 'white' : 'var(--fg-subtle)', fontSize: 13, fontWeight: 700, cursor: hasAudience ? 'pointer' : 'not-allowed' }}>
                  Continuar
                </button>
              </div>
            </>
          )}

          {/* STEP: schedule */}
          {step === 'schedule' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Nome do disparo</span>
                <input value={name} onChange={e => setName(e.target.value)} style={inputStyle}
                  placeholder={selectedTemplate ? `${selectedTemplate.name} — ${new Date().toLocaleDateString('pt-BR')}` : 'ex: Follow-up Julho'} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setSendMode('now')}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 8px', borderRadius: 10, border: `1px solid ${sendMode === 'now' ? 'var(--accent)' : 'var(--border)'}`, background: sendMode === 'now' ? 'var(--accent-soft)' : 'var(--bg-subtle)', color: sendMode === 'now' ? 'var(--accent)' : 'var(--fg-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <Send size={14} /> Enviar agora
                </button>
                <button type="button" onClick={() => setSendMode('schedule')}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 8px', borderRadius: 10, border: `1px solid ${sendMode === 'schedule' ? 'var(--accent)' : 'var(--border)'}`, background: sendMode === 'schedule' ? 'var(--accent-soft)' : 'var(--bg-subtle)', color: sendMode === 'schedule' ? 'var(--accent)' : 'var(--fg-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <Calendar size={14} /> Agendar
                </button>
              </div>

              {sendMode === 'schedule' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Data e hora do envio</span>
                  <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                    min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)} style={inputStyle} />
                </div>
              )}

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 10 }}>
                  <AlertCircle size={15} style={{ color: 'var(--red-500)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--red-600)' }}>{error}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" onClick={() => setStep('audience')} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer' }}>
                  Voltar
                </button>
                <button type="button" disabled={saving || (sendMode === 'schedule' && !scheduledAt)} onClick={handleSubmit}
                  style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: saving ? 'var(--bg-muted)' : 'var(--accent)', color: saving ? 'var(--fg-subtle)' : 'white', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Salvando...' : sendMode === 'now' ? 'Enviar agora' : 'Agendar disparo'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Main view ────────────────────────────────────────────────────────────────

const WhatsAppBlastsView: React.FC = () => {
  const navigate = useNavigate();
  const [blasts, setBlasts]   = useState<WhatsAppBlast[]>([]);
  const [numbers, setNumbers] = useState<WhatsAppNumberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [blastsData, numbersData] = await Promise.all([
        apiClient.get<WhatsAppBlast[]>('/whatsapp-blasts'),
        apiClient.get<WhatsAppNumberOption[]>('/whatsapp/numbers'),
      ]);
      setBlasts(blastsData);
      setNumbers(numbersData);
    } catch {
      setError('Erro ao carregar disparos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Enquanto houver disparo em andamento, atualiza a cada 5s para refletir o progresso
  useEffect(() => {
    if (!blasts.some(b => b.status === 'sending')) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [blasts, load]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Excluir o disparo "${name}"?`)) return;
    try {
      await apiClient.delete(`/whatsapp-blasts/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir disparo');
    }
  };

  const handleCancel = async (id: string, name: string) => {
    if (!window.confirm(`Cancelar o disparo "${name}"? Os envios já feitos não são desfeitos, apenas os que faltam deixam de ser enviados.`)) return;
    try {
      await apiClient.post(`/whatsapp-blasts/${id}/cancel`, {});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar disparo');
    }
  };

  const audienceLabel = (b: WhatsAppBlast) => {
    if (b.audienceType === 'tag') return `Tag: ${b.audienceValue}`;
    if (b.audienceType === 'individual') {
      try { return `${(JSON.parse(b.audienceValue) as string[]).length} leads selecionados`; } catch { return 'Individual'; }
    }
    return 'Segmento';
  };

  const numberLabel = (phoneNumberId: string) => {
    const n = numbers.find(num => num.id === phoneNumberId);
    return n ? (n.label ?? n.display_phone_number) : phoneNumberId;
  };

  return (
    <div style={{ padding: '28px 32px' }}>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
          <AlertCircle size={14} />{error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><X size={14} /></button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Disparos WhatsApp</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--fg-muted)' }}>Envie um template aprovado para uma tag, segmento ou lista de leads — sem precisar de uma automação.</p>
        </div>
        <button onClick={() => setShowNew(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(69,108,236,0.3)' }}>
          <Plus size={15} /> Novo Disparo
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 200px 160px 90px', padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
          {['DISPARO', 'STATUS', 'AUDIÊNCIA', 'ENVIADO', 'AÇÕES'].map((h, i) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-muted)', letterSpacing: '.05em', textAlign: i === 4 ? 'right' : 'left' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
            <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }} />
            Carregando...
          </div>
        ) : blasts.length === 0 ? (
          <div style={{ padding: 56, textAlign: 'center', color: 'var(--fg-muted)' }}>
            <MessageCircle size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Nenhum disparo ainda</div>
            <div style={{ fontSize: 13 }}>Clique em "Novo Disparo" para enviar seu primeiro WhatsApp avulso</div>
          </div>
        ) : blasts.map((blast, idx) => {
          const s = STATUS_CFG[blast.status];
          const AudienceIcon = AUDIENCE_ICON[blast.audienceType];
          return (
            <div key={blast.id}
              onClick={() => navigate(`/disparos-whatsapp/${blast.id}`)}
              style={{ display: 'grid', gridTemplateColumns: '1fr 160px 200px 160px 90px', padding: '14px 20px', borderBottom: idx < blasts.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{blast.name}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Phone size={11} /> {numberLabel(blast.phoneNumberId)} — {blast.templateName}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.label}</span>
              </div>

              <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><AudienceIcon size={12} style={{ color: 'var(--fg-muted)' }} />{audienceLabel(blast)}</span>
                <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{blast.audienceCount.toLocaleString('pt-BR')} leads</span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
                {blast.status === 'scheduled' && blast.scheduledAt && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} />{new Date(blast.scheduledAt).toLocaleString('pt-BR')}</span>
                )}
                {(blast.status === 'sending' || blast.status === 'sent' || blast.status === 'failed') && (
                  <span>{blast.sentCount}/{blast.audienceCount} enviados{blast.failedCount > 0 && `, ${blast.failedCount} falhas`}</span>
                )}
                {blast.status === 'draft' && '—'}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }} onClick={e => e.stopPropagation()}>
                {blast.status === 'draft' && (
                  <button onClick={async () => { await apiClient.post(`/whatsapp-blasts/${blast.id}/send`, {}); await load(); }}
                    style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--accent)' }} title="Enviar agora">
                    <Send size={13} />
                  </button>
                )}
                {(blast.status === 'sending' || blast.status === 'scheduled') && (
                  <button onClick={() => handleCancel(blast.id, blast.name)} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#dc2626' }} title="Cancelar">
                    <XCircle size={13} />
                  </button>
                )}
                {(blast.status === 'draft' || blast.status === 'cancelled' || blast.status === 'failed') && (
                  <button onClick={() => handleDelete(blast.id, blast.name)} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }} title="Excluir">
                    <Trash2 size={13} />
                  </button>
                )}
                {blast.status === 'sent' && <CheckCircle size={16} style={{ color: '#10b981' }} />}
              </div>
            </div>
          );
        })}
      </div>

      {showNew && <NewBlastModal onClose={() => setShowNew(false)} onDone={load} />}
    </div>
  );
};

export default WhatsAppBlastsView;
