import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapUnderline from '@tiptap/extension-underline';
import TiptapLink from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Plus, Search, Mail, Trash2, Edit3, Send, RefreshCw,
  CheckCircle, XCircle, AlertCircle, BarChart2, Eye,
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Link2, Minus, Undo, Redo, X,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TemplateStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  fromName: string | null;
  fromEmail: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stats: TemplateStats;
}

interface TemplateSend {
  id: string;
  leadEmail: string;
  toEmail: string;
  status: string;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  sentAt: string;
}

interface TemplateDetail extends EmailTemplate {
  sends: TemplateSend[];
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const api = {
  list:   ()                          => apiClient.get<EmailTemplate[]>('/email-templates'),
  get:    (id: string)                => apiClient.get<TemplateDetail>(`/email-templates/${id}`),
  create: (data: Partial<EmailTemplate>) => apiClient.post<EmailTemplate>('/email-templates', data),
  update: (id: string, data: Partial<EmailTemplate>) => apiClient.put<EmailTemplate>(`/email-templates/${id}`, data),
  delete: (id: string)                => apiClient.delete(`/email-templates/${id}`),
  test:   (id: string, toEmail: string) => apiClient.post(`/email-templates/${id}/test`, { toEmail }),
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  sent:       { label: 'Enviado',  color: '#6366f1', bg: '#eef2ff' },
  delivered:  { label: 'Entregue', color: '#10b981', bg: '#d1fae5' },
  opened:     { label: 'Aberto',   color: '#10b981', bg: '#d1fae5' },
  clicked:    { label: 'Clicado',  color: '#f59e0b', bg: '#fef3c7' },
  bounced:    { label: 'Bounced',  color: '#ef4444', bg: '#fee2e2' },
  complained: { label: 'Spam',     color: '#dc2626', bg: '#fee2e2' },
  failed:     { label: 'Falhou',   color: '#9ca3af', bg: '#f3f4f6' },
};

const StatusBadge = ({ status }: { status: string }) => {
  const c = STATUS_CFG[status] ?? STATUS_CFG['sent'];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, color: c.color, background: c.bg }}>
      {c.label}
    </span>
  );
};

// ─── TipTap Toolbar ──────────────────────────────────────────────────────────

const Toolbar = ({ editor }: { editor: ReturnType<typeof useEditor> }) => {
  if (!editor) return null;

  const btn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 5, border: 'none', cursor: 'pointer',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--fg-secondary)',
    flexShrink: 0,
  });

  const sep: React.CSSProperties = { width: 1, height: 20, background: 'var(--border)', flexShrink: 0 };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 10px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
      <button style={btn(false)} onClick={() => editor.chain().focus().undo().run()} title="Desfazer"><Undo size={13}/></button>
      <button style={btn(false)} onClick={() => editor.chain().focus().redo().run()} title="Refazer"><Redo size={13}/></button>
      <div style={sep}/>
      <button style={btn(editor.isActive('bold'))}      onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={13}/></button>
      <button style={btn(editor.isActive('italic'))}    onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={13}/></button>
      <button style={btn(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={13}/></button>
      <div style={sep}/>
      {(['h1','h2','h3'] as const).map(level => (
        <button key={level} style={{ ...btn(editor.isActive('heading', { level: Number(level[1]) })), fontSize: 11, fontWeight: 700, width: 'auto', padding: '0 6px' }}
          onClick={() => editor.chain().focus().toggleHeading({ level: Number(level[1]) as 1|2|3 }).run()}>
          {level.toUpperCase()}
        </button>
      ))}
      <div style={sep}/>
      <button style={btn(editor.isActive({ textAlign: 'left' }))}   onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft size={13}/></button>
      <button style={btn(editor.isActive({ textAlign: 'center' }))} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter size={13}/></button>
      <button style={btn(editor.isActive({ textAlign: 'right' }))}  onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight size={13}/></button>
      <div style={sep}/>
      <button style={btn(editor.isActive('bulletList'))}  onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={13}/></button>
      <button style={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={13}/></button>
      <div style={sep}/>
      <button style={btn(editor.isActive('link'))} onClick={() => {
        const url = window.prompt('URL do link:');
        if (url) editor.chain().focus().setLink({ href: url }).run();
        else editor.chain().focus().unsetLink().run();
      }}><Link2 size={13}/></button>
      <button style={btn(false)} onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={13}/></button>
    </div>
  );
};

// ─── Metric card ─────────────────────────────────────────────────────────────

const MetricCard = ({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) => (
  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
    <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 2 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 1 }}>{sub}</div>}
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const EmailTemplatesView: React.FC = () => {
  const [templates, setTemplates]       = useState<EmailTemplate[]>([]);
  const [selected, setSelected]         = useState<TemplateDetail | null>(null);
  const [loadingList, setLoadingList]   = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mode, setMode]                 = useState<'view' | 'create' | 'edit'>('view');
  const [search, setSearch]             = useState('');
  const [saving, setSaving]             = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [testEmail, setTestEmail]       = useState('');
  const [testSending, setTestSending]   = useState(false);
  const [testDone, setTestDone]         = useState(false);
  const [showPreview, setShowPreview]   = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '', subject: '', fromName: '', fromEmail: '',
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapUnderline,
      TiptapLink.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Escreva o corpo do email aqui...' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        style: 'min-height: 300px; outline: none; padding: 16px; font-family: inherit; font-size: 14px; line-height: 1.7;',
      },
    },
  });

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await api.list();
      setTemplates(data);
    } catch {
      setError('Erro ao carregar templates');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const loadDetail = async (id: string) => {
    setLoadingDetail(true);
    try {
      const data = await api.get(id);
      setSelected(data);
      setMode('view');
    } catch {
      setError('Erro ao carregar template');
    } finally {
      setLoadingDetail(false);
    }
  };

  const startCreate = () => {
    setSelected(null);
    setForm({ name: '', subject: '', fromName: '', fromEmail: '' });
    editor?.commands.setContent('');
    setMode('create');
    setError(null);
  };

  const startEdit = (t: TemplateDetail) => {
    setForm({ name: t.name, subject: t.subject, fromName: t.fromName ?? '', fromEmail: t.fromEmail ?? '' });
    editor?.commands.setContent(t.body);
    setMode('edit');
    setError(null);
  };

  const handleSave = async () => {
    const body = editor?.getHTML() ?? '';
    if (!form.name.trim())    { setError('Nome é obrigatório'); return; }
    if (!form.subject.trim()) { setError('Assunto é obrigatório'); return; }
    if (!body.trim() || body === '<p></p>') { setError('Corpo é obrigatório'); return; }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        subject: form.subject.trim(),
        body,
        fromName:  form.fromName.trim()  || null,
        fromEmail: form.fromEmail.trim() || null,
      };
      if (mode === 'create') {
        await api.create(payload);
      } else if (selected) {
        await api.update(selected.id, payload);
      }
      await loadList();
      setMode('view');
      setSelected(null);
    } catch {
      setError('Erro ao salvar template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected || !window.confirm(`Excluir template "${selected.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await api.delete(selected.id);
      setSelected(null);
      setMode('view');
      await loadList();
    } catch {
      setError('Erro ao excluir template');
    } finally {
      setDeleting(false);
    }
  };

  const handleTest = async () => {
    if (!selected || !testEmail.trim()) return;
    setTestSending(true);
    setTestDone(false);
    try {
      await api.test(selected.id, testEmail.trim());
      setTestDone(true);
      setTimeout(() => setTestDone(false), 4000);
    } catch {
      setError('Erro ao enviar email de teste');
    } finally {
      setTestSending(false);
    }
  };

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.subject.toLowerCase().includes(search.toLowerCase())
  );

  const isEditing = mode === 'create' || mode === 'edit';

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>

      {/* ── Left panel: list ── */}
      <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Templates de Email</h2>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>{templates.length} templates</div>
            </div>
            <button onClick={startCreate}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={13}/> Novo
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar template..."
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg)', fontSize: 13, outline: 'none' }}/>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loadingList ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
              <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }}/>
              <div style={{ marginTop: 8 }}>Carregando...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-muted)' }}>
              <Mail size={28} style={{ opacity: 0.3, marginBottom: 8 }}/>
              <div style={{ fontSize: 13 }}>Nenhum template encontrado</div>
            </div>
          ) : filtered.map(t => (
            <div key={t.id}
              onClick={() => loadDetail(t.id)}
              style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: selected?.id === t.id ? 'var(--accent-soft)' : 'transparent',
                borderLeft: selected?.id === t.id ? '3px solid var(--accent)' : '3px solid transparent',
              }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: selected?.id === t.id ? 'var(--accent)' : 'var(--fg)' }}>
                  {t.name}
                </div>
                {!t.isActive && <span style={{ fontSize: 10, color: 'var(--fg-muted)', background: 'var(--bg-muted)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>Inativo</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
                {t.subject}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--fg-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Send size={10}/> {t.stats.sent}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Eye size={10}/> {t.stats.openRate}%</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><BarChart2 size={10}/> {t.stats.clickRate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── CREATE / EDIT mode ── */}
        {isEditing && (
          <>
            {/* Editor header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                {mode === 'create' ? 'Novo Template' : `Editar: ${selected?.name}`}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setMode(selected ? 'view' : 'view'); setError(null); }}
                  style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }}/> : <CheckCircle size={13}/>}
                  {saving ? 'Salvando...' : 'Salvar Template'}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
                  <AlertCircle size={14}/> {error}
                </div>
              )}

              {/* Form fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)', marginBottom: 6 }}>Nome interno do template *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Boas-vindas, Follow-up 3 dias..."
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg)', fontSize: 14, outline: 'none' }}/>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)', marginBottom: 6 }}>
                    Assunto do email *
                    <span style={{ fontWeight: 400, color: 'var(--fg-muted)', marginLeft: 8 }}>use {'{{name}}'}, {'{{company}}'}, {'{{email}}'}</span>
                  </label>
                  <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Ex: {{name}}, veja como podemos ajudar sua empresa"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg)', fontSize: 14, outline: 'none' }}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)', marginBottom: 6 }}>Nome do remetente</label>
                  <input value={form.fromName} onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))}
                    placeholder="AutoForce (padrão)"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg)', fontSize: 14, outline: 'none' }}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)', marginBottom: 6 }}>Email do remetente</label>
                  <input value={form.fromEmail} onChange={e => setForm(f => ({ ...f, fromEmail: e.target.value }))}
                    placeholder="marketing@autoforce.com.br (padrão)"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg)', fontSize: 14, outline: 'none' }}/>
                </div>
              </div>

              {/* TipTap editor */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)', marginBottom: 6 }}>
                  Corpo do email *
                  <span style={{ fontWeight: 400, color: 'var(--fg-muted)', marginLeft: 8 }}>merge tags: {'{{name}}'}, {'{{email}}'}, {'{{company}}'}, {'{{phone}}'}, {'{{jobTitle}}'}</span>
                </label>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)' }}>
                  <Toolbar editor={editor}/>
                  <EditorContent editor={editor}/>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── VIEW mode — template selected ── */}
        {!isEditing && selected && (
          <>
            {/* Detail header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selected.name}</h3>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
                  Criado em {new Date(selected.createdAt).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowPreview(p => !p)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', background: showPreview ? 'var(--accent-soft)' : 'transparent', color: showPreview ? 'var(--accent)' : 'var(--fg-muted)', fontSize: 13, cursor: 'pointer' }}>
                  <Eye size={13}/> Preview
                </button>
                <button onClick={() => startEdit(selected)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-secondary)', fontSize: 13, cursor: 'pointer' }}>
                  <Edit3 size={13}/> Editar
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, border: '1px solid #fee2e2', background: 'transparent', color: '#ef4444', fontSize: 13, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>
                  <Trash2 size={13}/> Excluir
                </button>
              </div>
            </div>

            {loadingDetail ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)' }}>
                <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }}/>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
                    <AlertCircle size={14}/> {error}
                    <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><X size={14}/></button>
                  </div>
                )}

                {/* Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                  <MetricCard label="Enviados"  value={selected.stats.sent}      color="#6366f1"/>
                  <MetricCard label="Abertos"   value={selected.stats.opened}    sub={`${selected.stats.openRate}% taxa`}  color="#10b981"/>
                  <MetricCard label="Clicados"  value={selected.stats.clicked}   sub={`${selected.stats.clickRate}% taxa`} color="#f59e0b"/>
                  <MetricCard label="Bounced"   value={selected.stats.bounced}   sub={`${selected.stats.bounceRate}% taxa`} color="#ef4444"/>
                </div>

                {/* Subject + from */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 3 }}>ASSUNTO</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{selected.subject}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 3 }}>REMETENTE</div>
                      <div style={{ fontSize: 14 }}>
                        {selected.fromName || 'AutoForce'} &lt;{selected.fromEmail || 'padrão'}&gt;
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                {showPreview && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)', marginBottom: 8 }}>PREVIEW</div>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'white' }}>
                      <iframe
                        srcDoc={`<html><head><style>body{font-family:sans-serif;padding:24px;max-width:640px;margin:0 auto;color:#111;}</style></head><body>${selected.body}</body></html>`}
                        style={{ width: '100%', minHeight: 300, border: 'none', display: 'block' }}
                        title="Email preview"
                      />
                    </div>
                  </div>
                )}

                {/* Test send */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 24 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Enviar email de teste</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={testEmail} onChange={e => setTestEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--fg)', fontSize: 13, outline: 'none' }}/>
                    <button onClick={handleTest} disabled={testSending || !testEmail.trim()}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 7, border: 'none', background: testDone ? '#10b981' : 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: testSending ? 0.7 : 1, transition: 'background 0.3s', whiteSpace: 'nowrap' }}>
                      {testDone ? <><CheckCircle size={13}/> Enviado!</> : testSending ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }}/> Enviando...</> : <><Send size={13}/> Enviar Teste</>}
                    </button>
                  </div>
                </div>

                {/* Recent sends */}
                {selected.sends.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Mail size={14}/> Envios recentes
                      <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 400 }}>({selected.sends.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selected.sends.map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{s.toEmail}</div>
                            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
                              {new Date(s.sentAt).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                              {s.openedAt && ` · Aberto: ${new Date(s.openedAt).toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}`}
                            </div>
                          </div>
                          <StatusBadge status={s.status}/>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Empty state ── */}
        {!isEditing && !selected && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', gap: 12 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
              <Mail size={28} style={{ opacity: 0.4 }}/>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Selecione um template</div>
              <div style={{ fontSize: 13 }}>ou crie um novo para começar</div>
            </div>
            <button onClick={startCreate}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
              <Plus size={14}/> Criar primeiro template
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailTemplatesView;
