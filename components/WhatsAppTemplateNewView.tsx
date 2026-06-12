import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, Eye, MessageSquare } from 'lucide-react';
import { DataService } from '../services/dataService';

const LANGUAGES = [
  { value: 'pt_BR', label: 'Português (BR)' },
  { value: 'en_US', label: 'Inglês (EUA)' },
  { value: 'es',    label: 'Espanhol' },
  { value: 'es_AR', label: 'Espanhol (Argentina)' },
];

const iStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14, boxSizing: 'border-box',
  background: 'var(--bg-subtle)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--fg-primary)', outline: 'none', fontFamily: 'inherit',
};

function Field({ label, note, required, children }: { label: string; note?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-secondary)' }}>
        {label}
        {required && <span style={{ color: 'var(--accent)', marginLeft: 3 }}>*</span>}
        {note && <span style={{ fontWeight: 400, color: 'var(--fg-subtle)', marginLeft: 6 }}>{note}</span>}
      </label>
      {children}
    </div>
  );
}

export default function WhatsAppTemplateNewView() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    category: 'MARKETING',
    language: 'pt_BR',
    headerText: '',
    bodyText: '',
    footerText: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [showPreview, setShowPreview] = useState(true);

  const safeName = form.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const varCount = (text: string) => (text.match(/\{\{\d+\}\}/g) ?? []).length;

  const insertVar = (field: 'headerText' | 'bodyText') => {
    const next = varCount(form[field]) + 1;
    setForm(f => ({ ...f, [field]: f[field] + `{{${next}}}` }));
  };

  const submit = async () => {
    setError('');
    if (!safeName)           { setError('Nome do template é obrigatório.'); return; }
    if (!form.bodyText.trim()) { setError('O Body é obrigatório.'); return; }
    setSaving(true);
    try {
      await DataService.createWhatsAppTemplate({
        name:       safeName,
        category:   form.category,
        language:   form.language,
        headerText: form.headerText || undefined,
        bodyText:   form.bodyText,
        footerText: form.footerText || undefined,
      });
      navigate('/ai-agents', { state: { tab: 'templates', flash: 'Template criado! Aguarde aprovação da Meta.' } });
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao criar template.');
    } finally {
      setSaving(false);
    }
  };

  const hasContent = form.headerText || form.bodyText || form.footerText;

  return (
    <div style={{ padding: '24px 28px 64px', maxWidth: 1100, margin: '0 auto' }} className="animate-fade-in-up">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button type="button" onClick={() => navigate('/ai-agents')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--fg-secondary)', cursor: 'pointer' }}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>Novo template WhatsApp</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4, margin: '4px 0 0' }}>
            Após criado, o template é enviado para aprovação da Meta. Pode levar alguns minutos a horas.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, background: '#fee2e2', border: '1px solid #fca5a5', marginBottom: 20 }}>
          <AlertCircle size={16} color="#dc2626" />
          <span style={{ fontSize: 14, color: '#dc2626' }}>{error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 340px' : '1fr', gap: 20, alignItems: 'flex-start' }}>

        {/* Form */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>Configuração do template</p>
            <button type="button" onClick={() => setShowPreview(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)', cursor: 'pointer' }}>
              <Eye size={13} /> {showPreview ? 'Ocultar preview' : 'Ver preview'}
            </button>
          </div>

          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Nome */}
            <Field label="Nome do template" required note="Apenas letras minúsculas, números e underscores">
              <input value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: boas_vindas_lead"
                style={iStyle} />
              {form.name && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-subtle)', fontFamily: 'monospace' }}>
                  será criado como: <strong style={{ color: 'var(--accent)' }}>{safeName}</strong>
                </p>
              )}
            </Field>

            {/* Categoria + Idioma */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Categoria" required>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...iStyle, cursor: 'pointer' }}>
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utilitário</option>
                  <option value="AUTHENTICATION">Autenticação</option>
                </select>
              </Field>
              <Field label="Idioma" required>
                <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} style={{ ...iStyle, cursor: 'pointer' }}>
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </Field>
            </div>

            {/* Header */}
            <Field label="Header" note="(opcional — título em negrito acima do body)">
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={form.headerText}
                  onChange={e => setForm(f => ({ ...f, headerText: e.target.value }))}
                  placeholder="Ex: Novidade para você, {{1}}!"
                  style={{ ...iStyle, flex: 1 }} />
                <button type="button" onClick={() => insertVar('headerText')}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  + var
                </button>
              </div>
            </Field>

            {/* Body */}
            <Field label="Body" required note="Texto principal da mensagem">
              <textarea rows={7} value={form.bodyText}
                onChange={e => setForm(f => ({ ...f, bodyText: e.target.value }))}
                placeholder={'Olá {{1}}, temos uma novidade incrível para você!\n\nA AutoForce lançou uma nova funcionalidade que vai transformar sua operação de marketing.\n\nAcesse agora e confira.'}
                style={{ ...iStyle, resize: 'vertical', lineHeight: 1.6 }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>
                  Use {'{{1}}'}, {'{{2}}'}... para personalizar com dados do lead.
                </span>
                <button type="button" onClick={() => insertVar('bodyText')}
                  style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 }}>
                  + inserir variável
                </button>
              </div>
            </Field>

            {/* Footer */}
            <Field label="Footer" note="(opcional — texto pequeno abaixo, ex: nome da empresa)">
              <input value={form.footerText}
                onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))}
                placeholder="AutoForce"
                style={iStyle} />
            </Field>
          </div>

          {/* Actions */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => navigate('/ai-agents')}
              style={{ padding: '10px 20px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', fontSize: 14, fontWeight: 600, color: 'var(--fg-secondary)', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="button" onClick={submit} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 24px', borderRadius: 9, border: 'none', background: 'var(--accent)', fontSize: 14, fontWeight: 700, color: 'white', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              <Check size={15} /> {saving ? 'Enviando para a Meta...' : 'Criar template'}
            </button>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', position: 'sticky', top: 24 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={14} color="var(--fg-muted)" />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)' }}>Preview</p>
            </div>

            <div style={{ padding: 16, background: '#e5ddd5', minHeight: 200 }}>
              {hasContent ? (
                <div style={{ background: 'white', borderRadius: '3px 12px 12px 12px', padding: '12px 14px', maxWidth: 280, boxShadow: '0 1px 3px rgba(0,0,0,.12)', fontSize: 14, lineHeight: 1.55, color: '#111' }}>
                  {form.headerText && (
                    <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14 }}>{form.headerText}</p>
                  )}
                  {form.bodyText && (
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>{form.bodyText}</p>
                  )}
                  {form.footerText && (
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: '#999' }}>{form.footerText}</p>
                  )}
                  <p style={{ margin: '6px 0 0', fontSize: 10, color: '#aaa', textAlign: 'right' }}>
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 8 }}>
                  <MessageSquare size={28} color="rgba(0,0,0,.2)" />
                  <span style={{ fontSize: 13, color: 'rgba(0,0,0,.35)' }}>Preencha o Body para visualizar</span>
                </div>
              )}
            </div>

            {/* Tips */}
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)' }}>Dicas</p>
              {[
                'Use {{1}}, {{2}} para nome, empresa etc.',
                'Body é o único campo obrigatório.',
                'Templates de Marketing precisam de opt-in do usuário.',
                'Após criar, a Meta aprova em minutos a horas.',
              ].map((t, i) => (
                <p key={i} style={{ margin: '4px 0', fontSize: 12, color: 'var(--fg-muted)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}>·</span> {t}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
