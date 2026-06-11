import React, { useState, useEffect, useCallback, useRef } from 'react';
import EmailEditor, { EditorRef } from 'react-email-editor';
import {
  Plus, Search, Mail, Trash2, Edit3, Send, RefreshCw,
  CheckCircle, AlertCircle, X, LayoutGrid, List,
  Clock, Zap, Copy, ChevronRight, ArrowLeft, Eye,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

type EmailStatus = 'draft' | 'sent' | 'scheduled' | 'automatic';

interface TemplateStats {
  sent: number; delivered: number; opened: number;
  clicked: number; bounced: number; openRate: number; clickRate: number;
}

interface EmailTemplate {
  id: string; name: string; subject: string; body: string;
  design: unknown | null; fromName: string | null; fromEmail: string | null;
  status: EmailStatus; scheduledAt: string | null;
  audienceType: string | null; audienceValue: string | null; audienceCount: number | null;
  isActive: boolean; createdAt: string; updatedAt: string;
  stats: TemplateStats;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<EmailStatus, { label: string; color: string; dot: string }> = {
  sent:      { label: 'Enviado',    color: '#059669', dot: '#10b981' },
  scheduled: { label: 'Agendado',  color: '#d97706', dot: '#f59e0b' },
  automatic: { label: 'Automático',color: '#2563eb', dot: '#3b82f6' },
  draft:     { label: 'Rascunho',  color: '#6b7280', dot: '#9ca3af' },
};

const audienceLabel = (t: EmailTemplate) => {
  if (t.audienceType === 'trigger')  return 'Gatilho';
  if (t.audienceType === 'sequence') return 'Sequência';
  if (t.audienceCount) return `${t.audienceCount.toLocaleString('pt-BR')} leads`;
  return '—';
};
const audienceSub = (t: EmailTemplate) => t.audienceValue ?? (t.audienceType === 'all' ? 'Toda a base' : '');

const ProgressBar = ({ value, color }: { value: number; color: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <div style={{ flex: 1, height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: color, borderRadius: 3 }}/>
    </div>
    <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 34, textAlign: 'right' }}>{value}%</span>
  </div>
);

const HEADER_H = 50;

// ─── Main ─────────────────────────────────────────────────────────────────────

const EmailTemplatesView: React.FC = () => {
  const [emails, setEmails]             = useState<EmailTemplate[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode]         = useState<'list' | 'grid'>('list');
  const [selected, setSelected]         = useState<EmailTemplate | null>(null);
  const [editorOpen, setEditorOpen]     = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', subject: '', fromName: '', fromEmail: '' });

  const editorRef  = useRef<EditorRef>(null);
  const [editorReady, setEditorReady]   = useState(false);
  const [editorError, setEditorError]   = useState(false);
  const [saving, setSaving]             = useState(false);
  const [testEmail, setTestEmail]       = useState('');
  const [testSending, setTestSending]   = useState(false);
  const [testDone, setTestDone]         = useState(false);
  const [showPreview, setShowPreview]   = useState(false);

  // Timeout: se o Unlayer não carregar em 20s, mostra erro
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<EmailTemplate[]>('/email-templates');
      setEmails(data);
    } catch {
      setError('Erro ao carregar e-mails');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmails(); }, [loadEmails]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', subject: '', fromName: '', fromEmail: '' });
    setEditorReady(false);
    setEditorError(false);
    setEditorOpen(true);
    setSelected(null);
    setError(null);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditingId(t.id);
    setForm({ name: t.name, subject: t.subject, fromName: t.fromName ?? '', fromEmail: t.fromEmail ?? '' });
    setEditorReady(false);
    setEditorError(false);
    setEditorOpen(true);
    setError(null);
  };

  // Inicia timer quando editor abre
  useEffect(() => {
    if (editorOpen && !editorReady) {
      loadTimerRef.current = setTimeout(() => setEditorError(true), 20000);
    }
    return () => { if (loadTimerRef.current) clearTimeout(loadTimerRef.current); };
  }, [editorOpen, editorReady]);

  const handleEditorReady = () => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    setEditorReady(true);
    setEditorError(false);
    if (editingId) {
      const tpl = emails.find(e => e.id === editingId);
      if (tpl?.design) {
        try { editorRef.current?.editor?.loadDesign(tpl.design as any); } catch {}
      }
    }
  };

  const handleSave = async (asDraft = true) => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return; }
    setSaving(true);
    setError(null);

    editorRef.current?.editor?.exportHtml(async ({ html, design }) => {
      try {
        const payload = {
          name:      form.name.trim(),
          subject:   form.subject.trim(),
          body:      html,
          design,
          fromName:  form.fromName.trim()  || null,
          fromEmail: form.fromEmail.trim() || null,
          status:    asDraft ? 'draft' : 'sent',
        };
        if (editingId) {
          await apiClient.put(`/email-templates/${editingId}`, payload);
        } else {
          await apiClient.post('/email-templates', payload);
        }
        await loadEmails();
        setEditorOpen(false);
      } catch {
        setError('Erro ao salvar e-mail');
      } finally {
        setSaving(false);
      }
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Excluir "${name}"?`)) return;
    try {
      await apiClient.delete(`/email-templates/${id}`);
      if (selected?.id === id) setSelected(null);
      await loadEmails();
    } catch { setError('Erro ao excluir'); }
  };

  const handleDuplicate = async (t: EmailTemplate) => {
    try {
      await apiClient.post('/email-templates', {
        name: `${t.name} (cópia)`, subject: t.subject, body: t.body, design: t.design,
        fromName: t.fromName, fromEmail: t.fromEmail, status: 'draft',
      });
      await loadEmails();
    } catch { setError('Erro ao duplicar'); }
  };

  const handleTest = async () => {
    if (!selected || !testEmail.trim()) return;
    setTestSending(true); setTestDone(false);
    try {
      await apiClient.post(`/email-templates/${selected.id}/test`, { toEmail: testEmail.trim() });
      setTestDone(true);
      setTimeout(() => setTestDone(false), 4000);
    } catch { setError('Erro ao enviar teste'); }
    finally { setTestSending(false); }
  };

  // ── Filters ──
  const counts = {
    all: emails.length,
    sent: emails.filter(e => e.status === 'sent').length,
    scheduled: emails.filter(e => e.status === 'scheduled').length,
    automatic: emails.filter(e => e.status === 'automatic').length,
    draft: emails.filter(e => e.status === 'draft').length,
  };

  const filtered = emails.filter(e => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.subject.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── Detail view ──
  if (selected && !editorOpen) {
    const s = STATUS_CFG[selected.status];
    return (
      <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
        <button onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
          <ArrowLeft size={14}/> Voltar para E-mails
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{selected.name}</h2>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4 }}>{selected.subject}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => openEdit(selected)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-secondary)', fontSize: 13, cursor: 'pointer' }}>
              <Edit3 size={13}/> Editar
            </button>
            <button onClick={() => handleDuplicate(selected)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-secondary)', fontSize: 13, cursor: 'pointer' }}>
              <Copy size={13}/> Duplicar
            </button>
          </div>
        </div>

        {selected.stats.sent > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Enviados',  value: selected.stats.sent,    color: '#6366f1' },
              { label: 'Abertos',   value: selected.stats.opened,  color: '#10b981', rate: selected.stats.openRate },
              { label: 'Clicados',  value: selected.stats.clicked, color: '#f59e0b', rate: selected.stats.clickRate },
              { label: 'Bounced',   value: selected.stats.bounced, color: '#ef4444' },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 2 }}>{m.label}</div>
                {m.rate !== undefined && <div style={{ fontSize: 11, color: m.color, marginTop: 4, fontWeight: 700 }}>{m.rate}% taxa</div>}
              </div>
            ))}
          </div>
        )}

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4 }}>STATUS</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: s.color }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }}/>{s.label}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4 }}>PÚBLICO</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{audienceLabel(selected)}</div>
              {audienceSub(selected) && <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{audienceSub(selected)}</div>}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4 }}>REMETENTE</div>
              <div style={{ fontSize: 13 }}>{selected.fromName || 'AutoForce'}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{selected.fromEmail || 'padrão'}</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setShowPreview(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
            <Eye size={13}/> {showPreview ? 'Ocultar preview' : 'Ver preview do email'}
          </button>
          {showPreview && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
              <iframe
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;}</style></head><body>${selected.body}</body></html>`}
                style={{ width: '100%', minHeight: 400, border: 'none', display: 'block' }}
                title="Preview"
              />
            </div>
          )}
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Enviar e-mail de teste</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="email@exemplo.com"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--fg)', fontSize: 13, outline: 'none' }}/>
            <button onClick={handleTest} disabled={testSending || !testEmail.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 7, border: 'none', background: testDone ? '#10b981' : 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: testSending ? 0.7 : 1, whiteSpace: 'nowrap' }}>
              {testDone ? <><CheckCircle size={13}/> Enviado!</> : testSending ? <><RefreshCw size={13}/> Enviando...</> : <><Send size={13}/> Enviar Teste</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Editor (Unlayer) ──
  if (editorOpen) {
    return (
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 'var(--global-sidebar-width, 0px)', zIndex: 100, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: HEADER_H, borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0, gap: 12, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <button onClick={() => setEditorOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
              <ArrowLeft size={14}/> Voltar
            </button>
            <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }}/>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome do e-mail (ex: Boas-vindas Lead)"
              style={{ width: 220, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--fg)', fontSize: 14, fontWeight: 600, outline: 'none', flexShrink: 0 }}/>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="Assunto (use {{name}}, {{company}}...)"
              style={{ flex: 1, minWidth: 0, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--fg)', fontSize: 13, outline: 'none' }}/>
            <input value={form.fromName} onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))}
              placeholder="Nome remetente"
              style={{ width: 160, padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--fg)', fontSize: 13, outline: 'none', flexShrink: 0 }}/>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
            {error && <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#ef4444' }}><AlertCircle size={13}/>{error}</div>}
            <button onClick={() => handleSave(true)} disabled={saving || !editorReady}
              style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer', opacity: !editorReady ? 0.5 : 1 }}>
              Salvar rascunho
            </button>
            <button onClick={() => handleSave(false)} disabled={saving || !editorReady}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (saving || !editorReady) ? 0.6 : 1 }}>
              {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }}/> : <CheckCircle size={13}/>}
              {saving ? 'Salvando...' : 'Salvar e-mail'}
            </button>
          </div>
        </div>

        {/* Editor area */}
        <div style={{ position: 'relative', flex: 1 }}>
          {/* Loading overlay */}
          {!editorReady && !editorError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg-base)', zIndex: 10 }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }}/>
              <span style={{ fontSize: 14, color: 'var(--fg-muted)' }}>Carregando editor...</span>
            </div>
          )}

          {/* Error state */}
          {editorError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg-base)', zIndex: 10 }}>
              <AlertCircle size={32} style={{ color: '#ef4444' }}/>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Editor não carregou</div>
              <div style={{ fontSize: 13, color: 'var(--fg-muted)', textAlign: 'center', maxWidth: 360 }}>
                O editor Unlayer depende de conexão com <strong>editor.unlayer.com</strong>.<br/>
                Verifique sua conexão e tente novamente.
              </div>
              <button onClick={() => { setEditorError(false); setEditorReady(false); }}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Tentar novamente
              </button>
            </div>
          )}

          <EmailEditor
            ref={editorRef}
            onReady={handleEditorReady}
            style={{ height: `calc(100vh - ${HEADER_H}px)`, display: 'block' }}
            options={{
              locale: 'pt-BR',
              appearance: { theme: 'modern_light' },
              features: { textEditor: { tables: true } },
              mergeTags: {
                name:     { name: 'Nome',     value: '{{name}}' },
                email:    { name: 'Email',    value: '{{email}}' },
                company:  { name: 'Empresa',  value: '{{company}}' },
                phone:    { name: 'Telefone', value: '{{phone}}' },
                jobTitle: { name: 'Cargo',    value: '{{jobTitle}}' },
              },
            } as any}
          />
        </div>
      </div>
    );
  }

  // ── List / Grid view ──
  return (
    <div style={{ padding: '28px 32px' }}>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
          <AlertCircle size={14}/>{error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><X size={14}/></button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>E-mails</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--fg-muted)' }}>Crie, dispare e acompanhe os e-mails enviados aos seus leads.</p>
        </div>
        <button onClick={openCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(69,108,236,0.3)' }}>
          <Plus size={15}/> Novo e-mail
        </button>
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 280px' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou assunto..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg)', fontSize: 13, outline: 'none' }}/>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { key: 'all', label: 'Todos', count: counts.all },
            { key: 'sent', label: 'Enviados', count: counts.sent },
            { key: 'scheduled', label: 'Agendados', count: counts.scheduled },
            { key: 'automatic', label: 'Automáticos', count: counts.automatic },
            { key: 'draft', label: 'Rascunhos', count: counts.draft },
          ] as { key: string; label: string; count: number }[]).map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, border: `1px solid ${filterStatus === f.key ? 'var(--accent)' : 'var(--border)'}`, background: filterStatus === f.key ? 'var(--accent-soft)' : 'var(--bg-card)', color: filterStatus === f.key ? 'var(--accent)' : 'var(--fg-secondary)', fontSize: 13, fontWeight: filterStatus === f.key ? 700 : 400, cursor: 'pointer' }}>
              {f.label}
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: filterStatus === f.key ? 'var(--accent)' : 'var(--bg-muted)', color: filterStatus === f.key ? '#fff' : 'var(--fg-muted)' }}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button onClick={() => setViewMode('list')} style={{ padding: '6px 8px', borderRadius: 7, border: `1px solid ${viewMode === 'list' ? 'var(--accent)' : 'var(--border)'}`, background: viewMode === 'list' ? 'var(--accent-soft)' : 'transparent', color: viewMode === 'list' ? 'var(--accent)' : 'var(--fg-muted)', cursor: 'pointer' }}>
            <List size={14}/>
          </button>
          <button onClick={() => setViewMode('grid')} style={{ padding: '6px 8px', borderRadius: 7, border: `1px solid ${viewMode === 'grid' ? 'var(--accent)' : 'var(--border)'}`, background: viewMode === 'grid' ? 'var(--accent-soft)' : 'transparent', color: viewMode === 'grid' ? 'var(--accent)' : 'var(--fg-muted)', cursor: 'pointer' }}>
            <LayoutGrid size={14}/>
          </button>
        </div>
      </div>

      {/* LIST */}
      {viewMode === 'list' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 180px 200px 100px', padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
            {['E-MAIL', 'STATUS', 'PÚBLICO', 'DESEMPENHO', 'AÇÕES'].map((h, i) => (
              <div key={h} style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-muted)', letterSpacing: '.05em', textAlign: i === 4 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }}/>
              Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 56, textAlign: 'center', color: 'var(--fg-muted)' }}>
              <Mail size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }}/>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Nenhum e-mail encontrado</div>
              <div style={{ fontSize: 13 }}>Crie seu primeiro e-mail clicando em "Novo e-mail"</div>
            </div>
          ) : filtered.map((email, idx) => {
            const s = STATUS_CFG[email.status];
            return (
              <div key={email.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 140px 180px 200px 100px', padding: '14px 20px', borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => setSelected(email)}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {email.name}<ChevronRight size={12} style={{ color: 'var(--fg-muted)', flexShrink: 0 }}/>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email.subject || <em style={{ opacity: 0.6 }}>(sem assunto)</em>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0 }}/>
                  <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.label}</span>
                </div>

                <div onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {email.audienceType === 'trigger' ? <><Zap size={12} style={{ verticalAlign: 'middle', color: '#3b82f6' }}/> Gatilho</> :
                     email.audienceType === 'sequence' ? <><Clock size={12} style={{ verticalAlign: 'middle', color: '#8b5cf6' }}/> Sequência</> :
                     email.audienceCount ? `${email.audienceCount.toLocaleString('pt-BR')} leads` : '—'}
                  </div>
                </div>

                <div onClick={e => e.stopPropagation()}>
                  {email.stats.sent > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--fg-muted)', width: 50 }}>Abertura</span>
                        <ProgressBar value={email.stats.openRate} color="#10b981"/>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--fg-muted)', width: 50 }}>Clique</span>
                        <ProgressBar value={email.stats.clickRate} color="#3b82f6"/>
                      </div>
                    </div>
                  ) : <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>não enviado</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEdit(email)} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg-muted)' }} title="Editar"><Edit3 size={13}/></button>
                  <button onClick={() => handleDuplicate(email)} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg-muted)' }} title="Duplicar"><Copy size={13}/></button>
                  <button onClick={() => handleDelete(email.id, email.name)} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }} title="Excluir"><Trash2 size={13}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GRID */}
      {viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(email => {
            const s = STATUS_CFG[email.status];
            return (
              <div key={email.id} onClick={() => setSelected(email)}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: s.color }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot }}/>{s.label}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(email)} style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg-muted)' }}><Edit3 size={12}/></button>
                    <button onClick={() => handleDelete(email.id, email.name)} style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12}/></button>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{email.name}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject}</div>
                {email.stats.sent > 0 && (
                  <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>↗ {email.stats.openRate}% abertura</span>
                    <span style={{ color: '#3b82f6', fontWeight: 700 }}>↗ {email.stats.clickRate}% clique</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--fg-muted)' }}>
          Mostrando {filtered.length} de {emails.length} e-mails
        </div>
      )}
    </div>
  );
};

export default EmailTemplatesView;
