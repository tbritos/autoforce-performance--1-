import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, Eye, Link2, MessageSquare, Phone, Plus, Trash2, Zap } from 'lucide-react';
import { DataService } from '../services/dataService';

// ─── Types ────────────────────────────────────────────────────────────────────

type ButtonType = 'QUICK_REPLY' | 'PHONE_NUMBER' | 'URL';

interface TemplateButton {
  id: string;
  type: ButtonType;
  text: string;
  phone_number: string;
  url: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: 'pt_BR', label: 'Português (BR)' },
  { value: 'en_US', label: 'Inglês (EUA)' },
  { value: 'es',    label: 'Espanhol' },
  { value: 'es_AR', label: 'Espanhol (Argentina)' },
];

const BUTTON_TYPES: { type: ButtonType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: 'QUICK_REPLY',  label: 'Resposta rápida', icon: Zap,      desc: 'Botão de reply pré-definido' },
  { type: 'PHONE_NUMBER', label: 'Ligar',           icon: Phone,    desc: 'Abre discagem com um número' },
  { type: 'URL',          label: 'Acessar link',    icon: Link2,    desc: 'Abre uma URL no navegador' },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const iStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14, boxSizing: 'border-box',
  background: 'var(--bg-subtle)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--fg-primary)', outline: 'none', fontFamily: 'inherit',
};

// ─── Field ────────────────────────────────────────────────────────────────────

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

// ─── Button row ───────────────────────────────────────────────────────────────

function ButtonRow({ btn, onChange, onRemove }: {
  btn: TemplateButton;
  onChange: (updated: TemplateButton) => void;
  onRemove: () => void;
}) {
  const meta = BUTTON_TYPES.find(t => t.type === btn.type)!;
  const Icon = meta.icon;

  return (
    <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Type selector + remove */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          {BUTTON_TYPES.map(t => (
            <button key={t.type} type="button" onClick={() => onChange({ ...btn, type: t.type })}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: btn.type === t.type ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: btn.type === t.type ? 'var(--accent-soft)' : 'var(--bg-surface)',
                color: btn.type === t.type ? 'var(--accent)' : 'var(--fg-muted)',
              }}>
              <t.icon size={11} /> {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onRemove}
          style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid rgba(239,68,68,.25)', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Fields per type */}
      <div style={{ display: 'grid', gridTemplateColumns: btn.type === 'QUICK_REPLY' ? '1fr' : '1fr 1fr', gap: 10 }}>
        <div>
          <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Texto do botão</p>
          <input value={btn.text} onChange={e => onChange({ ...btn, text: e.target.value })}
            placeholder={btn.type === 'QUICK_REPLY' ? 'Ex: Sim, tenho interesse' : btn.type === 'PHONE_NUMBER' ? 'Ex: Ligar agora' : 'Ex: Acessar site'}
            maxLength={25}
            style={{ ...iStyle, padding: '8px 12px', fontSize: 13 }} />
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--fg-subtle)' }}>{btn.text.length}/25 caracteres</p>
        </div>

        {btn.type === 'PHONE_NUMBER' && (
          <div>
            <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>Número (com DDI)</p>
            <input value={btn.phone_number} onChange={e => onChange({ ...btn, phone_number: e.target.value })}
              placeholder="+55119999999999"
              style={{ ...iStyle, padding: '8px 12px', fontSize: 13 }} />
          </div>
        )}

        {btn.type === 'URL' && (
          <div>
            <p style={{ margin: '0 0 5px', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>URL</p>
            <input value={btn.url} onChange={e => onChange({ ...btn, url: e.target.value })}
              placeholder="https://autoforce.com"
              style={{ ...iStyle, padding: '8px 12px', fontSize: 13 }} />
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--fg-subtle)' }}>Use {'{{1}}'} para URL dinâmica</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function WhatsAppTemplateNewView() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', category: 'MARKETING', language: 'pt_BR',
    headerText: '', bodyText: '', footerText: '',
  });
  const [buttons, setButtons] = useState<TemplateButton[]>([]);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [showPreview, setShowPreview] = useState(true);

  const safeName = form.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const varCount = (text: string) => (text.match(/\{\{\d+\}\}/g) ?? []).length;

  const insertVar = (field: 'headerText' | 'bodyText') => {
    const next = varCount(form[field]) + 1;
    setForm(f => ({ ...f, [field]: f[field] + `{{${next}}}` }));
  };

  const addButton = (type: ButtonType) => {
    if (buttons.length >= 3) return;
    setButtons(b => [...b, { id: String(Date.now()), type, text: '', phone_number: '', url: '' }]);
  };

  const updateButton = (id: string, updated: TemplateButton) =>
    setButtons(b => b.map(btn => btn.id === id ? updated : btn));

  const removeButton = (id: string) =>
    setButtons(b => b.filter(btn => btn.id !== id));

  const submit = async () => {
    setError('');
    if (!safeName)             { setError('Nome do template é obrigatório.'); return; }
    if (!form.bodyText.trim()) { setError('O Body é obrigatório.'); return; }

    for (const btn of buttons) {
      if (!btn.text.trim()) { setError(`Preencha o texto do botão "${BUTTON_TYPES.find(t => t.type === btn.type)?.label}".`); return; }
      if (btn.type === 'PHONE_NUMBER' && !btn.phone_number.trim()) { setError('Preencha o número do botão "Ligar".'); return; }
      if (btn.type === 'URL' && !btn.url.trim()) { setError('Preencha a URL do botão "Acessar link".'); return; }
    }

    setSaving(true);
    try {
      await DataService.createWhatsAppTemplate({
        name:       safeName,
        category:   form.category,
        language:   form.language,
        headerText: form.headerText || undefined,
        bodyText:   form.bodyText,
        footerText: form.footerText || undefined,
        buttons:    buttons.length > 0 ? buttons.map(({ type, text, phone_number, url }) => ({ type, text, phone_number: phone_number || undefined, url: url || undefined })) : undefined,
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
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '4px 0 0' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 320px' : '1fr', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Form ── */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>Configuração do template</p>
            <button type="button" onClick={() => setShowPreview(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)', cursor: 'pointer' }}>
              <Eye size={13} /> {showPreview ? 'Ocultar preview' : 'Ver preview'}
            </button>
          </div>

          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Nome + Categoria + Idioma */}
            <Field label="Nome do template" required note="Apenas letras minúsculas, números e underscores">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: boas_vindas_lead" style={iStyle} />
              {form.name && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-subtle)', fontFamily: 'monospace' }}>
                  será criado como: <strong style={{ color: 'var(--accent)' }}>{safeName}</strong>
                </p>
              )}
            </Field>

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

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: 1 }}>Conteúdo</p>

              {/* Header */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label="Header" note="(opcional — título em negrito)">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={form.headerText} onChange={e => setForm(f => ({ ...f, headerText: e.target.value }))}
                      placeholder="Ex: Novidade para você!" style={{ ...iStyle, flex: 1 }} />
                    <button type="button" onClick={() => insertVar('headerText')}
                      style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                      + var
                    </button>
                  </div>
                </Field>

                {/* Body */}
                <Field label="Body" required>
                  <textarea rows={6} value={form.bodyText} onChange={e => setForm(f => ({ ...f, bodyText: e.target.value }))}
                    placeholder={'Olá {{1}}, temos uma novidade incrível para você!\n\nA AutoForce pode transformar sua operação de marketing digital.'}
                    style={{ ...iStyle, resize: 'vertical', lineHeight: 1.6 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>Use {'{{1}}'}, {'{{2}}'}... para personalizar com dados do lead.</span>
                    <button type="button" onClick={() => insertVar('bodyText')}
                      style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: 0 }}>
                      + inserir variável
                    </button>
                  </div>
                </Field>

                {/* Footer */}
                <Field label="Footer" note="(opcional — texto pequeno abaixo)">
                  <input value={form.footerText} onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))}
                    placeholder="AutoForce" style={iStyle} />
                </Field>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: 1 }}>Botões</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>Máximo 3 botões por template.</p>
                </div>
                {buttons.length < 3 && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {BUTTON_TYPES.map(t => (
                      <button key={t.type} type="button" onClick={() => addButton(t.type)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)', cursor: 'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--fg-secondary)'; }}>
                        <t.icon size={11} /> {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {buttons.length === 0 ? (
                <div style={{ padding: '20px', borderRadius: 10, border: '1px dashed var(--border)', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-muted)' }}>Nenhum botão adicionado. Clique acima para adicionar.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {buttons.map(btn => (
                    <ButtonRow key={btn.id} btn={btn}
                      onChange={updated => updateButton(btn.id, updated)}
                      onRemove={() => removeButton(btn.id)} />
                  ))}
                </div>
              )}
            </div>
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

        {/* ── Preview ── */}
        {showPreview && (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', position: 'sticky', top: 24 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MessageSquare size={14} color="var(--fg-muted)" />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)' }}>Preview</p>
            </div>

            <div style={{ padding: 16, background: '#e5ddd5', minHeight: 200 }}>
              {hasContent ? (
                <div style={{ maxWidth: 280 }}>
                  {/* Message bubble */}
                  <div style={{ background: 'white', borderRadius: '3px 12px 12px 12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.12)', fontSize: 14, color: '#111' }}>
                    <div style={{ padding: '12px 14px' }}>
                      {form.headerText && <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14 }}>{form.headerText}</p>}
                      {form.bodyText   && <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.55 }}>{form.bodyText}</p>}
                      {form.footerText && <p style={{ margin: '8px 0 0', fontSize: 11, color: '#999' }}>{form.footerText}</p>}
                      <p style={{ margin: '6px 0 0', fontSize: 10, color: '#aaa', textAlign: 'right' }}>
                        {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓
                      </p>
                    </div>

                    {/* Buttons preview */}
                    {buttons.length > 0 && (
                      <div style={{ borderTop: '1px solid #f0f0f0' }}>
                        {buttons.map((btn, i) => {
                          const meta = BUTTON_TYPES.find(t => t.type === btn.type)!;
                          return (
                            <div key={btn.id} style={{
                              padding: '10px 14px', textAlign: 'center', fontSize: 13, fontWeight: 600,
                              color: '#0084ff', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              borderTop: i > 0 ? '1px solid #f0f0f0' : 'none',
                            }}>
                              <meta.icon size={13} />
                              {btn.text || meta.label}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)' }}>Limites da Meta</p>
              {[
                'Máximo 3 botões por template.',
                'Texto do botão: máximo 25 caracteres.',
                'Body: máximo 1024 caracteres.',
                'Header: máximo 60 caracteres.',
                'Após criar, aprovação em minutos a horas.',
              ].map((t, i) => (
                <p key={i} style={{ margin: '4px 0', fontSize: 12, color: 'var(--fg-muted)', display: 'flex', gap: 6 }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>·</span> {t}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
