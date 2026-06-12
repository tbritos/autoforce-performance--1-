import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EmailEditor, { EditorRef } from 'react-email-editor';
import { ArrowLeft, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '../services/apiClient';

const HEADER_H = 50;

interface EmailTemplate {
  id: string; name: string; subject: string; body: string;
  design: unknown | null; fromName: string | null; fromEmail: string | null;
  status: string;
}

const EmailEditorView: React.FC = () => {
  const navigate   = useNavigate();
  const { id }     = useParams<{ id: string }>();
  const isEdit     = Boolean(id);

  const [form, setForm] = useState({ name: '', subject: '', fromName: '', fromEmail: '' });
  const [editorReady, setEditorReady] = useState(false);
  const [editorError, setEditorError] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(isEdit);

  const editorRef    = useRef<EditorRef>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designRef    = useRef<unknown | null>(null);

  // Load template when editing
  useEffect(() => {
    if (!isEdit || !id) return;
    apiClient.get<EmailTemplate>(`/email-templates/${id}`)
      .then(t => {
        setForm({ name: t.name, subject: t.subject, fromName: t.fromName ?? '', fromEmail: t.fromEmail ?? '' });
        designRef.current = t.design;
      })
      .catch(() => setError('Erro ao carregar template'))
      .finally(() => setLoadingTemplate(false));
  }, [id, isEdit]);

  // Timeout: 20s para o Unlayer carregar
  useEffect(() => {
    loadTimerRef.current = setTimeout(() => {
      if (!editorReady) setEditorError(true);
    }, 20000);
    return () => { if (loadTimerRef.current) clearTimeout(loadTimerRef.current); };
  }, []);

  const handleEditorReady = () => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    setEditorReady(true);
    setEditorError(false);
    if (designRef.current) {
      try { editorRef.current?.editor?.loadDesign(designRef.current as any); } catch {}
    }
  };

  const handleSave = (asDraft = true) => {
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
        if (isEdit && id) {
          await apiClient.put(`/email-templates/${id}`, payload);
        } else {
          await apiClient.post('/email-templates', payload);
        }
        navigate('/emails');
      } catch {
        setError('Erro ao salvar e-mail');
        setSaving(false);
      }
    });
  };

  if (loadingTemplate) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 10, color: 'var(--fg-muted)' }}>
        <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }}/> Carregando...
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 'var(--global-sidebar-width, 0px)', zIndex: 100, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: HEADER_H, borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <button onClick={() => navigate('/emails')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
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
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#ef4444' }}>
              <AlertCircle size={13}/>{error}
            </div>
          )}
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
        {!editorReady && !editorError && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg-base)', zIndex: 10 }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }}/>
            <span style={{ fontSize: 14, color: 'var(--fg-muted)' }}>Carregando editor...</span>
          </div>
        )}

        {editorError && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg-base)', zIndex: 10 }}>
            <AlertCircle size={32} style={{ color: '#ef4444' }}/>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Editor não carregou</div>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', textAlign: 'center', maxWidth: 360 }}>
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
};

export default EmailEditorView;
