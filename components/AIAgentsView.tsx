import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, BrainCircuit, Check, CheckCircle, ChevronDown,
  MessageSquare, Phone, RefreshCw, Search, Smartphone, XCircle,
} from 'lucide-react';
import { DataService } from '../services/dataService';
import type { AIAgent, WhatsAppPhoneNumber } from '../types';

type Tab = 'number' | 'templates' | 'agent';

interface WppTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: Array<{ type: string; format?: string; text?: string }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-1.5-flash'];
const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED:  { label: 'Aprovado',  color: '#16a34a', bg: '#dcfce7' },
  PENDING:   { label: 'Pendente',  color: '#d97706', bg: '#fef3c7' },
  REJECTED:  { label: 'Rejeitado', color: '#dc2626', bg: '#fee2e2' },
  PAUSED:    { label: 'Pausado',   color: '#6b7280', bg: '#f3f4f6' },
  DISABLED:  { label: 'Desativado',color: '#6b7280', bg: '#f3f4f6' },
};

const QUALITY_LABELS: Record<string, { label: string; color: string }> = {
  GREEN:   { label: 'Qualidade alta',  color: '#16a34a' },
  YELLOW:  { label: 'Qualidade média', color: '#d97706' },
  RED:     { label: 'Qualidade baixa', color: '#dc2626' },
  UNKNOWN: { label: 'Desconhecido',    color: '#6b7280' },
};

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING:      'Marketing',
  UTILITY:        'Utilitário',
  AUTHENTICATION: 'Autenticação',
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const iStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box',
  background: 'var(--bg-subtle)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--fg-primary)', outline: 'none', fontFamily: 'inherit',
};

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>
        {label}
        {note && <span style={{ fontWeight: 400, color: 'var(--fg-subtle)', marginLeft: 4 }}>{note}</span>}
      </p>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] ?? { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        <Icon size={22} color="var(--fg-muted)" />
      </div>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>{title}</p>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>{subtitle}</p>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function AIAgentsView() {
  const [tab, setTab]           = useState<Tab>('number');
  const [phoneNums, setPhoneNums] = useState<WhatsAppPhoneNumber[]>([]);
  const [templates, setTemplates] = useState<WppTemplate[]>([]);
  const [agent, setAgent]       = useState<AIAgent | null>(null);
  const [agentDraft, setAgentDraft] = useState<Partial<AIAgent>>({});
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [templateQuery, setTemplateQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const provider    = String(agentDraft.defaultProvider || 'gemini');
  const modelOptions = provider === 'openai' ? OPENAI_MODELS : GEMINI_MODELS;

  const asLines   = (v: unknown) => Array.isArray(v) ? v.join('\n') : '';
  const fromLines = (v: string) => v.split('\n').map(s => s.trim()).filter(Boolean);

  const filteredTemplates = useMemo(() => {
    const q = templateQuery.toLowerCase().trim();
    if (!q) return templates;
    return templates.filter(t =>
      [t.name, t.category, t.language, t.status].join(' ').toLowerCase().includes(q)
    );
  }, [templates, templateQuery]);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [nums, tpls, agents] = await Promise.all([
        DataService.getWhatsAppPhoneNumbers().catch(() => [] as WhatsAppPhoneNumber[]),
        DataService.getWhatsAppTemplates().catch(() => [] as WppTemplate[]),
        DataService.listAIAgents().catch(() => [] as AIAgent[]),
      ]);
      setPhoneNums(nums);
      setTemplates(tpls);
      if (agents[0]) {
        setAgent(agents[0]);
        setAgentDraft(agents[0]);
      }
    } catch (e) {
      setError('Erro ao carregar dados do WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);

  const saveAgent = async () => {
    if (!agent) return;
    setSaving(true);
    try {
      const payload = {
        ...agentDraft,
        discoveryQuestions: fromLines(asLines(agentDraft.discoveryQuestions)),
      };
      const saved = await DataService.updateAIAgent(agent.id, payload);
      setAgent(saved);
      setAgentDraft(saved);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: 'number',    label: 'Número',           icon: Phone },
    { id: 'templates', label: 'Templates da Meta', icon: MessageSquare },
    { id: 'agent',     label: 'Agente IA',         icon: BrainCircuit },
  ];

  return (
    <div style={{ padding: '24px 28px 64px', maxWidth: 1100, margin: '0 auto' }} className="animate-fade-in-up">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>WhatsApp</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4 }}>
            Gerenciamento do número, templates da Meta e configurações do agente Lara.
          </p>
        </div>
        <button type="button" onClick={loadAll}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--fg-secondary)', cursor: 'pointer' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5', marginBottom: 16 }}>
          <AlertCircle size={14} color="#dc2626" />
          <span style={{ fontSize: 13, color: '#dc2626' }}>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {tabs.map(t => {
          const Icon   = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? 'var(--accent)' : 'var(--fg-muted)',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1, transition: 'color .15s',
              }}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Número ──────────────────────────────────────────────────────────────── */}
      {tab === 'number' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Connected numbers */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>Número conectado</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>Número de telefone registrado na Meta Business API.</p>
            </div>

            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <RefreshCw size={20} className="animate-spin" color="var(--fg-muted)" />
              </div>
            ) : phoneNums.length === 0 ? (
              <EmptyState icon={Smartphone} title="Nenhum número encontrado" subtitle="Verifique se WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID estão configurados no Railway." />
            ) : (
              phoneNums.map(num => {
                const q = QUALITY_LABELS[num.quality_rating] ?? QUALITY_LABELS['UNKNOWN'];
                return (
                  <div key={num.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Phone size={20} color="white" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--fg-primary)' }}>{num.display_phone_number}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>{num.verified_name}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: q.color, display: 'inline-block' }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: q.color }}>{q.label}</span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--fg-subtle)', fontFamily: 'monospace' }}>ID: {num.id}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ── Templates ────────────────────────────────────────────────────────────── */}
      {tab === 'templates' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>Templates da Meta</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>
                {templates.length} template{templates.length !== 1 ? 's' : ''} cadastrado{templates.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', pointerEvents: 'none' }} />
              <input value={templateQuery} onChange={e => setTemplateQuery(e.target.value)}
                placeholder="Buscar template..."
                style={{ ...iStyle, paddingLeft: 28, width: 220, fontSize: 12 }} />
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <RefreshCw size={20} className="animate-spin" color="var(--fg-muted)" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <EmptyState icon={MessageSquare} title="Nenhum template encontrado" subtitle="Crie templates no Meta Business Manager e eles aparecerão aqui." />
          ) : (
            filteredTemplates.map(tpl => {
              const bodyComp = tpl.components.find(c => c.type === 'BODY');
              const headerComp = tpl.components.find(c => c.type === 'HEADER');
              const isExpanded = expandedId === tpl.id;

              return (
                <div key={tpl.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <button type="button" onClick={() => setExpandedId(isExpanded ? null : tpl.id)}
                    style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)', fontFamily: 'monospace' }}>{tpl.name}</strong>
                        <StatusBadge status={tpl.status} />
                        <span style={{ fontSize: 11, color: 'var(--fg-muted)', padding: '2px 7px', borderRadius: 99, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                          {CATEGORY_LABELS[tpl.category] ?? tpl.category}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{tpl.language}</span>
                      </div>
                      {!isExpanded && bodyComp?.text && (
                        <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 600 }}>
                          {bodyComp.text}
                        </p>
                      )}
                    </div>
                    <ChevronDown size={14} color="var(--fg-muted)" style={{ transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }} />
                  </button>

                  {isExpanded && (
                    <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {headerComp?.text && (
                        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: 1 }}>Header</p>
                          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-primary)', lineHeight: 1.5 }}>{headerComp.text}</p>
                        </div>
                      )}
                      {bodyComp?.text && (
                        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: 1 }}>Body</p>
                          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{bodyComp.text}</p>
                        </div>
                      )}
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-subtle)', fontFamily: 'monospace' }}>ID: {tpl.id}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Agente IA ────────────────────────────────────────────────────────────── */}
      {tab === 'agent' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', maxWidth: 640 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>
                {agentDraft.name || 'Agente IA'}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>Modelo e configurações de execução.</p>
            </div>
            <button type="button" onClick={saveAgent} disabled={saving || !agent}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (saving || !agent) ? 0.6 : 1 }}>
              <Check size={13} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>

          {!agent ? (
            <EmptyState icon={BrainCircuit} title="Nenhum agente configurado" subtitle="Configure um agente no banco de dados para habilitar edição aqui." />
          ) : (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Provider">
                  <select value={provider}
                    onChange={e => setAgentDraft(d => ({ ...d, defaultProvider: e.target.value, defaultModel: e.target.value === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash' }))}
                    style={{ ...iStyle, cursor: 'pointer' }}>
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </Field>
                <Field label="Modelo">
                  <select value={String(agentDraft.defaultModel || modelOptions[0])}
                    onChange={e => setAgentDraft(d => ({ ...d, defaultModel: e.target.value }))}
                    style={{ ...iStyle, cursor: 'pointer' }}>
                    {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Objetivo do agente">
                <textarea rows={3} value={agentDraft.objective || ''}
                  onChange={e => setAgentDraft(d => ({ ...d, objective: e.target.value }))}
                  style={{ ...iStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </Field>

              <Field label="Perguntas de qualificação" note="(1 por linha)">
                <textarea rows={5} value={asLines(agentDraft.discoveryQuestions)}
                  onChange={e => setAgentDraft(d => ({ ...d, discoveryQuestions: fromLines(e.target.value) }))}
                  placeholder={'Qual o tamanho do seu time de vendas?\nVocê já usa algum CRM hoje?\nQuantos leads você recebe por mês?'}
                  style={{ ...iStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </Field>

              {/* Status do agente */}
              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={14} color="#16a34a" />
                <span style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
                  Agente <strong>{agentDraft.name}</strong> ativo · rodando em <strong>{agentDraft.defaultProvider || 'gemini'} / {agentDraft.defaultModel || '—'}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
