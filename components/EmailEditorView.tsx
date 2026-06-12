import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EmailEditor, { EditorRef } from 'react-email-editor';
import { ArrowLeft, CheckCircle, AlertCircle, RefreshCw, ChevronRight, Mail, User, AtSign, FileText } from 'lucide-react';
import { apiClient } from '../services/apiClient';

const HEADER_H = 50;

interface EmailTemplate {
  id: string; name: string; subject: string; body: string;
  design: unknown | null; fromName: string | null; fromEmail: string | null;
  status: string;
}

// ─── Step 1: formulário de configuração ──────────────────────────────────────

interface SetupStepProps {
  form: { name: string; subject: string; fromName: string; fromEmail: string };
  onChange: (f: SetupStepProps['form']) => void;
  onContinue: () => void;
  onBack: () => void;
  isEdit: boolean;
}

const SetupStep: React.FC<SetupStepProps> = ({ form, onChange, onContinue, onBack, isEdit }) => {
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (!form.name.trim())    { setError('Nome do template é obrigatório'); return; }
    if (!form.subject.trim()) { setError('Assunto é obrigatório'); return; }
    setError('');
    onContinue();
  };

  const field = (
    label: string,
    placeholder: string,
    value: string,
    key: keyof typeof form,
    icon: React.ReactNode,
    hint?: string,
    required = false,
  ) => (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--fg-secondary)', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)', display: 'flex' }}>
          {icon}
        </span>
        <input
          value={value}
          onChange={e => onChange({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px 10px 36px', borderRadius: 9, border: `1px solid var(--border)`, background: 'var(--bg-base)', color: 'var(--fg)', fontSize: 14, outline: 'none' }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
      </div>
      {hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--fg-muted)' }}>{hint}</p>}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      {/* Top bar */}
      <div style={{ height: HEADER_H, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={14}/> Voltar para E-mails
        </button>
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--accent)' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>1</div>
            Configuração
          </div>
          <ChevronRight size={14} style={{ color: 'var(--fg-muted)' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-muted)' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--border)', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>2</div>
            Layout
          </div>
        </div>
      </div>

      {/* Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>
            {isEdit ? 'Editar e-mail' : 'Novo e-mail'}
          </h2>
          <p style={{ margin: '0 0 32px', fontSize: 14, color: 'var(--fg-muted)' }}>
            Preencha as informações básicas antes de montar o layout.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {field('Nome do template', 'Ex: Boas-vindas Lead, Oferta Especial...', form.name, 'name', <FileText size={14}/>, undefined, true)}
            {field('Assunto do e-mail', 'Ex: Olá {{name}}, temos uma novidade para você!', form.subject, 'subject', <Mail size={14}/>, 'Use {{name}}, {{company}}, {{email}} para personalizar', true)}

            <div style={{ height: 1, background: 'var(--border)' }}/>

            {field('Nome do remetente', 'Ex: AutoForce', form.fromName, 'fromName', <User size={14}/>, 'Nome que aparece no campo "De:" do e-mail')}
            {field('E-mail do remetente', 'Ex: contato@autoforce.com.br', form.fromEmail, 'fromEmail', <AtSign size={14}/>, 'Precisa ser um domínio verificado no Resend')}
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 20, padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13 }}>
              <AlertCircle size={14}/>{error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
            <button onClick={handleContinue}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(69,108,236,0.3)' }}>
              Continuar para o editor <ChevronRight size={16}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Step 2: Unlayer editor ───────────────────────────────────────────────────

const EmailEditorView: React.FC = () => {
  const navigate = useNavigate();
  const { id }   = useParams<{ id: string }>();
  const isEdit   = Boolean(id);

  const [step, setStep]   = useState<1 | 2>(isEdit ? 1 : 1);
  const [form, setForm]   = useState({ name: '', subject: '', fromName: '', fromEmail: '' });
  const [editorReady, setEditorReady] = useState(false);
  const [editorError, setEditorError] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(isEdit);

  const editorRef    = useRef<EditorRef>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designRef    = useRef<unknown | null>(null);

  // Load existing template when editing
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

  // Start 20s timeout when editor mounts (step 2)
  useEffect(() => {
    if (step !== 2) return;
    loadTimerRef.current = setTimeout(() => {
      if (!editorReady) setEditorError(true);
    }, 20000);
    return () => { if (loadTimerRef.current) clearTimeout(loadTimerRef.current); };
  }, [step]);

  const handleEditorReady = () => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    setEditorReady(true);
    setEditorError(false);
    if (designRef.current) {
      try { editorRef.current?.editor?.loadDesign(designRef.current as any); } catch {}
    }
  };

  const handleSave = (asDraft = true) => {
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

  // ── Step 1 ──
  if (step === 1) {
    return (
      <SetupStep
        form={form}
        onChange={setForm}
        onContinue={() => setStep(2)}
        onBack={() => navigate('/emails')}
        isEdit={isEdit}
      />
    );
  }

  // ── Step 2: Editor ──
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 'var(--global-sidebar-width, 0px)', zIndex: 100, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: HEADER_H, borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setStep(1)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer' }}>
            <ArrowLeft size={14}/> Voltar
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ fontWeight: 700, color: 'var(--fg)' }}>{form.name}</span>
            {form.subject && <span style={{ color: 'var(--fg-muted)' }}>— {form.subject}</span>}
          </div>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-muted)' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✓</div>
            Configuração
          </div>
          <ChevronRight size={13} style={{ color: 'var(--fg-muted)' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--accent)' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>2</div>
            Layout
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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

      {/* Unlayer */}
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
