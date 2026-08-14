import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EmailEditor, { EditorRef } from 'react-email-editor';
import { ArrowLeft, CheckCircle, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { apiClient } from '../services/apiClient';

const HEADER_H = 50;
const MERGE_TAGS = ['{{name}}', '{{email}}', '{{company}}', '{{phone}}', '{{jobTitle}}'];

interface EmailTemplate {
  id: string; name: string; subject: string; body: string;
  design: unknown | null; fromName: string | null; fromEmail: string | null;
  status: string;
}

interface SenderDomainsResponse {
  domains: string[];
}

interface EmailSetupForm {
  name: string;
  subject: string;
  fromName: string;
  fromEmailLocalPart: string;
  fromEmailDomain: string;
}

function splitSenderEmail(email: string | null | undefined) {
  const value = email?.trim() ?? '';
  const atIndex = value.lastIndexOf('@');
  if (atIndex <= 0) return { localPart: '', domain: '' };
  return {
    localPart: value.slice(0, atIndex),
    domain: value.slice(atIndex + 1).toLowerCase(),
  };
}

function buildSenderEmail(localPart: string, domain: string) {
  const normalizedLocalPart = localPart.trim();
  const normalizedDomain = domain.trim().toLowerCase();
  return normalizedLocalPart && normalizedDomain
    ? `${normalizedLocalPart}@${normalizedDomain}`
    : '';
}

// ─── Seção visual ─────────────────────────────────────────────────────────────

const Section: React.FC<{ done: boolean; title: string; summary?: string; children: React.ReactNode }> = ({ done, title, summary, children }) => (
  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
      {done && <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0 }}/>}
      <div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        {done && summary && <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 2 }}>{summary}</div>}
      </div>
    </div>
    <div style={{ padding: '20px' }}>{children}</div>
  </div>
);

// ─── Input com foco ───────────────────────────────────────────────────────────

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--fg-secondary)' }}>{label}</label>
    {children}
    {hint && <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>{hint}</p>}
  </div>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--fg)', fontSize: 14, outline: 'none', transition: 'border-color .15s', ...props.style }}
    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; props.onFocus?.(e); }}
    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; props.onBlur?.(e); }}
  />
);

// ─── Step 1 ───────────────────────────────────────────────────────────────────

interface SetupStepProps {
  form: EmailSetupForm;
  onChange: (f: SetupStepProps['form']) => void;
  onContinue: () => void;
  onBack: () => void;
  isEdit: boolean;
  senderDomains: string[];
  senderDomainsLoading: boolean;
  senderDomainsError: string | null;
  onReloadSenderDomains: () => void;
}

const SetupStep: React.FC<SetupStepProps> = ({
  form,
  onChange,
  onContinue,
  onBack,
  isEdit,
  senderDomains,
  senderDomainsLoading,
  senderDomainsError,
  onReloadSenderDomains,
}) => {
  const [error, setError] = useState('');
  const [senderEditing, setSenderEditing] = useState(
    !form.fromName.trim() || !form.fromEmailLocalPart.trim() || !form.fromEmailDomain.trim()
  );
  const subjectRef = useRef<HTMLInputElement>(null);

  const insertVar = (tag: string) => {
    const el = subjectRef.current;
    if (!el) return;
    const start = el.selectionStart ?? form.subject.length;
    const end   = el.selectionEnd   ?? form.subject.length;
    const next  = form.subject.slice(0, start) + tag + form.subject.slice(end);
    onChange({ ...form, subject: next });
    setTimeout(() => { el.focus(); el.setSelectionRange(start + tag.length, start + tag.length); }, 0);
  };

  const handleContinue = () => {
    if (!form.name.trim())    { setError('Nome do template é obrigatório'); return; }
    if (!form.subject.trim()) { setError('Assunto é obrigatório'); return; }
    if (form.fromEmailLocalPart.trim() && !form.fromEmailDomain.trim()) {
      setError('Selecione o domínio do e-mail do remetente');
      return;
    }
    if (form.fromEmailDomain.trim() && !form.fromEmailLocalPart.trim()) {
      setError('Digite o nome que ficará antes do @ no e-mail do remetente');
      return;
    }
    if (/[@\s]/.test(form.fromEmailLocalPart.trim())) {
      setError('Antes do @, informe apenas o nome do remetente, sem espaços ou outro @');
      return;
    }
    setError('');
    onContinue();
  };

  const senderEmail = buildSenderEmail(form.fromEmailLocalPart, form.fromEmailDomain);
  const senderFilled  = !!(form.fromName.trim() && senderEmail);
  const senderDone    = senderFilled && !senderEditing;
  const senderSummary = senderDone ? `${form.fromName} via ${senderEmail}` : undefined;
  const currentDomainIsLegacy = Boolean(
    form.fromEmailDomain && !senderDomains.includes(form.fromEmailDomain)
  );
  const domainOptions = currentDomainIsLegacy
    ? [form.fromEmailDomain, ...senderDomains]
    : senderDomains;

  const subjectLen = form.subject.length;
  const subjectColor = subjectLen > 70 ? '#ef4444' : subjectLen > 50 ? '#f59e0b' : 'var(--fg-muted)';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      {/* Top bar */}
      <div style={{ height: HEADER_H, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', color: 'var(--fg-base)', fontSize: 13, cursor: 'pointer' }}>
          <ArrowLeft size={14}/> {isEdit ? 'Cancelar edição' : 'Cancelar'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto', fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>Configuração</span>
          <ChevronRight size={13} style={{ color: 'var(--fg-muted)' }}/>
          <span style={{ color: 'var(--fg-muted)' }}>Layout</span>
        </div>
        <div style={{ width: 80 }}/>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800 }}>{isEdit ? 'Editar e-mail' : 'Novo e-mail'}</h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: 'var(--fg-muted)' }}>Configure as informações antes de montar o layout.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Remetente */}
            <Section done={senderDone} title="Remetente" summary={senderSummary ? `O envio será feito por ${senderSummary}` : undefined}>
              {senderDone ? (
                <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>
                  O envio será feito por <strong style={{ color: 'var(--fg)' }}>{form.fromName}</strong> através do email <strong style={{ color: 'var(--fg)' }}>{senderEmail}</strong>
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Field label="Nome do remetente">
                    <Input value={form.fromName} onChange={e => onChange({ ...form, fromName: e.target.value })} placeholder="Ex: Marketing AutoForce" autoComplete="off"/>
                  </Field>
                  <Field label="E-mail do remetente" hint="Digite o nome antes do @ e selecione um domínio habilitado no Resend.">
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1.35fr)', alignItems: 'center', gap: 9 }}>
                      <Input
                        value={form.fromEmailLocalPart}
                        onChange={e => onChange({ ...form, fromEmailLocalPart: e.target.value })}
                        placeholder="Ex: marketing"
                        autoComplete="off"
                        aria-label="Nome antes do arroba"
                      />
                      <span style={{ color: 'var(--fg-muted)', fontSize: 16, fontWeight: 700 }}>@</span>
                      <select
                        value={form.fromEmailDomain}
                        onChange={e => onChange({ ...form, fromEmailDomain: e.target.value })}
                        disabled={senderDomainsLoading || domainOptions.length === 0}
                        aria-label="Domínio do remetente"
                        style={{
                          width: '100%', boxSizing: 'border-box', padding: '10px 34px 10px 12px',
                          borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-base)',
                          color: 'var(--fg)', fontSize: 14, outline: 'none', minWidth: 0,
                          cursor: senderDomainsLoading ? 'wait' : 'pointer',
                        }}
                      >
                        <option value="">
                          {senderDomainsLoading ? 'Carregando domínios...' : 'Selecione o domínio'}
                        </option>
                        {domainOptions.map(domain => (
                          <option key={domain} value={domain}>
                            {domain}{currentDomainIsLegacy && domain === form.fromEmailDomain ? ' (domínio atual)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    {senderEmail && (
                      <div style={{ marginTop: 7, fontSize: 12, color: 'var(--fg-muted)' }}>
                        Endereço completo: <strong style={{ color: 'var(--fg)' }}>{senderEmail}</strong>
                      </div>
                    )}
                    {senderDomainsError && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, color: '#dc2626', fontSize: 12 }}>
                        <AlertCircle size={13}/>
                        <span>{senderDomainsError}</span>
                        <button
                          type="button"
                          onClick={onReloadSenderDomains}
                          style={{ padding: 0, border: 'none', background: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Tentar novamente
                        </button>
                      </div>
                    )}
                  </Field>
                  {senderFilled && (
                    <button onClick={() => setSenderEditing(false)}
                      style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      Confirmar remetente
                    </button>
                  )}
                </div>
              )}
              {senderDone && (
                <button onClick={() => setSenderEditing(true)}
                  style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, cursor: 'pointer', padding: 0 }}>
                  Alterar
                </button>
              )}
            </Section>

            {/* Nome do template */}
            <Section done={!!form.name.trim()} title="Nome do template" summary={form.name.trim() || undefined}>
              <Field label="Nome interno do template">
                <Input value={form.name} onChange={e => onChange({ ...form, name: e.target.value })} placeholder="Ex: Boas-vindas Lead, Oferta Black Friday..."/>
              </Field>
            </Section>

            {/* Assunto */}
            <Section done={!!form.subject.trim()} title="Assunto" summary={form.subject.trim() ? `O assunto da campanha é "${form.subject}"` : undefined}>
              <Field label="Assunto do e-mail">
                <div style={{ position: 'relative' }}>
                  <Input ref={subjectRef} value={form.subject} onChange={e => onChange({ ...form, subject: e.target.value })} placeholder="Ex: Olá {{name}}, temos uma novidade para você!"/>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Inserir variável:</span>
                    {MERGE_TAGS.map(tag => (
                      <button key={tag} type="button" onClick={() => insertVar(tag)}
                        style={{ padding: '1px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-muted)', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontFamily: 'monospace' }}>
                        {tag}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: subjectColor, fontWeight: 600, flexShrink: 0 }}>
                    {subjectLen} caracteres
                  </span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>
                  Celulares exibem cerca de 35 caracteres e desktop em média 70.
                </p>
              </Field>
            </Section>

          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13 }}>
              <AlertCircle size={14}/>{error}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
            <button onClick={onBack}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 22px', color: 'var(--fg-muted)', fontSize: 14, cursor: 'pointer' }}>
              <ArrowLeft size={15}/> {isEdit ? 'Cancelar edição' : 'Cancelar'}
            </button>
            <button onClick={handleContinue}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 28px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 10px rgba(69,108,236,0.3)' }}>
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
  const [form, setForm]   = useState<EmailSetupForm>({
    name: '',
    subject: '',
    fromName: '',
    fromEmailLocalPart: '',
    fromEmailDomain: '',
  });
  const [senderDomains, setSenderDomains] = useState<string[]>([]);
  const [senderDomainsLoading, setSenderDomainsLoading] = useState(true);
  const [senderDomainsError, setSenderDomainsError] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [editorError, setEditorError] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(isEdit);

  const editorRef    = useRef<EditorRef>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designRef    = useRef<unknown | null>(null);

  const loadSenderDomains = async () => {
    setSenderDomainsLoading(true);
    setSenderDomainsError(null);
    try {
      const response = await apiClient.get<SenderDomainsResponse>('/email-templates/sender-domains');
      const domains = [...new Set(response.domains.map(domain => domain.trim().toLowerCase()).filter(Boolean))];
      setSenderDomains(domains);
      setForm(current => ({
        ...current,
        fromEmailDomain: current.fromEmailDomain || (domains.length === 1 ? domains[0] : ''),
      }));
      if (domains.length === 0) {
        setSenderDomainsError('Nenhum domínio habilitado para envio foi encontrado no Resend.');
      }
    } catch {
      setSenderDomainsError('Não foi possível carregar os domínios configurados no Resend.');
    } finally {
      setSenderDomainsLoading(false);
    }
  };

  useEffect(() => {
    void loadSenderDomains();
  }, []);

  // Load existing template when editing
  useEffect(() => {
    if (!isEdit || !id) return;
    apiClient.get<EmailTemplate>(`/email-templates/${id}`)
      .then(t => {
        const senderEmail = splitSenderEmail(t.fromEmail);
        setForm({
          name: t.name,
          subject: t.subject,
          fromName: t.fromName ?? '',
          fromEmailLocalPart: senderEmail.localPart,
          fromEmailDomain: senderEmail.domain,
        });
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
          fromEmail: buildSenderEmail(form.fromEmailLocalPart, form.fromEmailDomain) || null,
          status:    asDraft ? 'draft' : 'sent',
        };
        if (isEdit && id) {
          await apiClient.put(`/email-templates/${id}`, payload);
        } else {
          await apiClient.post('/email-templates', payload);
        }
        navigate('/emails');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Erro ao salvar e-mail');
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
        onBack={() => navigate(isEdit && id ? `/emails/${id}` : '/emails')}
        isEdit={isEdit}
        senderDomains={senderDomains}
        senderDomainsLoading={senderDomainsLoading}
        senderDomainsError={senderDomainsError}
        onReloadSenderDomains={() => { void loadSenderDomains(); }}
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
          <span style={{ color: 'var(--fg-muted)' }}>Configuração</span>
          <ChevronRight size={13} style={{ color: 'var(--fg-muted)' }}/>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>Layout</span>
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
              unsubscribeUrl: { name: 'Link de desinscrição', value: '{{unsubscribe_url}}' },
            },
          } as any}
        />
      </div>
    </div>
  );
};

export default EmailEditorView;
