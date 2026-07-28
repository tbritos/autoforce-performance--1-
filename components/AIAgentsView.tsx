import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle, BrainCircuit, Check, CheckCircle, ChevronDown,
  MessageSquare, Phone, Plus, RefreshCw, Search,
  Smartphone, Trash2,
} from 'lucide-react';
import { DataService } from '../services/dataService';
import type { AIAgent, WhatsAppNumberEntry } from '../types';

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

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED:  { label: 'Aprovado',   color: '#16a34a', bg: '#dcfce7' },
  PENDING:   { label: 'Pendente',   color: '#d97706', bg: '#fef3c7' },
  REJECTED:  { label: 'Rejeitado',  color: '#dc2626', bg: '#fee2e2' },
  PAUSED:    { label: 'Pausado',    color: '#6b7280', bg: '#f3f4f6' },
  DISABLED:  { label: 'Desativado', color: '#6b7280', bg: '#f3f4f6' },
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
  const s = STATUS_META[status] ?? { label: status, color: '#6b7280', bg: '#f3f4f6' };
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
  const navigate  = useNavigate();
  const location  = useLocation();

  const [tab, setTab]               = useState<Tab>((location.state as any)?.tab ?? 'number');
  const [phoneNums, setPhoneNums]   = useState<WhatsAppNumberEntry[]>([]);
  const [templates, setTemplates]   = useState<WppTemplate[]>([]);
  const [agent, setAgent]           = useState<AIAgent | null>(null);
  const [agentDraft, setAgentDraft] = useState<Partial<AIAgent>>({});
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [flash, setFlash]           = useState<string>((location.state as any)?.flash ?? '');
  const [templateQuery, setTemplateQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [labelDrafts, setLabelDrafts]   = useState<Record<string, string>>({});
  const [savingLabelId, setSavingLabelId] = useState<string | null>(null);
  const [newNumberId, setNewNumberId]     = useState('');
  const [newNumberLabel, setNewNumberLabel] = useState('');
  const [newNumberWabaId, setNewNumberWabaId] = useState('');
  const [addingNumber, setAddingNumber]   = useState(false);
  const [templateNumberId, setTemplateNumberId] = useState('');

  const provider     = String(agentDraft.defaultProvider || 'gemini');
  const modelOptions = provider === 'openai' ? OPENAI_MODELS : GEMINI_MODELS;

  const filteredTemplates = useMemo(() => {
    const q = templateQuery.toLowerCase().trim();
    if (!q) return templates;
    return templates.filter(t =>
      [t.name, t.category, t.language, t.status].join(' ').toLowerCase().includes(q)
    );
  }, [templates, templateQuery]);

  // So templates aprovados podem de fato ser enviados pela Meta — sem isso,
  // selecionar um template pendente/rejeitado no follow-up falharia no envio.
  const approvedTemplates = useMemo(
    () => templates.filter(t => t.status === 'APPROVED'),
    [templates]
  );

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [nums, tpls, agents] = await Promise.all([
        DataService.getWhatsAppNumbers().catch(() => [] as WhatsAppNumberEntry[]),
        DataService.getWhatsAppTemplates(templateNumberId || undefined).catch(() => [] as WppTemplate[]),
        DataService.listAIAgents().catch(() => [] as AIAgent[]),
      ]);
      setPhoneNums(nums);
      setTemplates(tpls);
      if (agents[0]) {
        setAgent(agents[0]);
        setAgentDraft(agents[0]);
      }
    } catch {
      setError('Erro ao carregar dados do WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);

  const changeTemplateNumber = async (id: string) => {
    setTemplateNumberId(id);
    setLoading(true);
    try {
      setTemplates(await DataService.getWhatsAppTemplates(id || undefined));
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const saveNumberLabel = async (phoneNumberId: string) => {
    const label = (labelDrafts[phoneNumberId] ?? '').trim();
    if (!label) return;
    setSavingLabelId(phoneNumberId);
    setError('');
    try {
      await DataService.registerWhatsAppNumber(phoneNumberId, label);
      setFlash('Número cadastrado.');
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao cadastrar número.');
    } finally {
      setSavingLabelId(null);
    }
  };

  // Pra numeros que nao aparecem na listagem automatica (ex: outra conta Meta
  // Business/WABA) — cadastra direto pelo Phone Number ID.
  const addNumberById = async () => {
    const phoneNumberId = newNumberId.trim();
    const label = newNumberLabel.trim();
    if (!phoneNumberId || !label) return;
    setAddingNumber(true);
    setError('');
    try {
      await DataService.registerWhatsAppNumber(phoneNumberId, label, newNumberWabaId.trim() || undefined);
      setFlash('Número cadastrado.');
      setNewNumberId('');
      setNewNumberLabel('');
      setNewNumberWabaId('');
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao cadastrar número.');
    } finally {
      setAddingNumber(false);
    }
  };

  const saveAgent = async () => {
    if (!agent) return;
    setSaving(true);
    try {
      const saved = await DataService.updateAIAgent(agent.id, {
        defaultProvider: agentDraft.defaultProvider,
        defaultModel: agentDraft.defaultModel,
        fallbackModels: agentDraft.fallbackModels ?? [],
        whatsappPhoneNumberId: agentDraft.whatsappPhoneNumberId ?? null,
        followUpDelayHours: agentDraft.followUpDelayHours ?? 24,
        followUpMaxAttempts: agentDraft.followUpMaxAttempts ?? 2,
        followUpTemplateName: agentDraft.followUpTemplateName ?? null,
      });
      setAgent(saved);
      setAgentDraft(saved);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (name: string) => {
    setDeletingName(name);
    try {
      await DataService.deleteWhatsAppTemplate(name, templateNumberId || undefined);
      await loadAll();
      setExpandedId(null);
    } catch (e: any) {
      alert(e?.message ?? 'Erro ao deletar template.');
    } finally {
      setDeletingName(null);
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

      {flash && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#dcfce7', border: '1px solid #86efac', marginBottom: 16 }}>
          <CheckCircle size={14} color="#16a34a" />
          <span style={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>{flash}</span>
        </div>
      )}

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
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>Número conectado</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>Número de telefone registrado na Meta Business API.</p>
          </div>

          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>
              Adicionar número por ID <span style={{ fontWeight: 400, color: 'var(--fg-subtle)' }}>(números de outra conta Meta Business não aparecem sozinhos na lista abaixo)</span>
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="text" placeholder="Phone Number ID (ex: 786886027832147)"
                value={newNumberId} onChange={e => setNewNumberId(e.target.value)}
                style={{ ...iStyle, width: 260 }} />
              <input type="text" placeholder="Rótulo (ex: Tiago Fernandes)"
                value={newNumberLabel} onChange={e => setNewNumberLabel(e.target.value)}
                style={{ ...iStyle, width: 200 }} />
              <input type="text" placeholder="WABA ID (obrigatório se for outra conta Meta)"
                value={newNumberWabaId} onChange={e => setNewNumberWabaId(e.target.value)}
                style={{ ...iStyle, width: 220 }} />
              <button type="button"
                disabled={addingNumber || !newNumberId.trim() || !newNumberLabel.trim()}
                onClick={addNumberById}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: addingNumber ? 0.6 : 1 }}>
                {addingNumber ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />} Cadastrar
              </button>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--fg-subtle)' }}>
              O WABA ID fica em WhatsApp Manager → clique nos "..." ao lado do nome da conta → Detalhes da conta. Sem ele, templates dessa conta não vão aparecer corretamente.
            </p>
          </div>

          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <RefreshCw size={20} className="animate-spin" color="var(--fg-muted)" />
            </div>
          ) : phoneNums.length === 0 ? (
            <EmptyState icon={Smartphone} title="Nenhum número encontrado" subtitle="Verifique se WHATSAPP_ACCESS_TOKEN e WHATSAPP_BUSINESS_ACCOUNT_ID estão configurados." />
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
                    {num.isRegistered ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: '#166534', background: '#dcfce7' }}>
                        <Check size={11} /> {num.label}
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                        <input
                          type="text"
                          placeholder="Rótulo (ex: Comercial, Campanha X)"
                          value={labelDrafts[num.id] ?? ''}
                          onChange={e => setLabelDrafts(prev => ({ ...prev, [num.id]: e.target.value }))}
                          style={{ ...iStyle, width: 220, padding: '6px 10px' }}
                        />
                        <button type="button"
                          disabled={savingLabelId === num.id || !(labelDrafts[num.id] ?? '').trim()}
                          onClick={() => saveNumberLabel(num.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingLabelId === num.id ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                          {savingLabelId === num.id ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />} Cadastrar
                        </button>
                      </div>
                    )}
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={templateNumberId} onChange={e => void changeTemplateNumber(e.target.value)}
                style={{ ...iStyle, width: 170, fontSize: 12, padding: '8px 10px' }}>
                <option value="">Conta principal</option>
                {phoneNums.map(n => (
                  <option key={n.id} value={n.id}>{(n.label ?? n.verified_name) || n.display_phone_number}</option>
                ))}
              </select>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', pointerEvents: 'none' }} />
                <input value={templateQuery} onChange={e => setTemplateQuery(e.target.value)}
                  placeholder="Buscar template..."
                  style={{ ...iStyle, paddingLeft: 28, width: 200, fontSize: 12 }} />
              </div>
              <button type="button" onClick={() => navigate('/whatsapp/template/new')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Plus size={13} /> Novo template
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center' }}>
              <RefreshCw size={20} className="animate-spin" color="var(--fg-muted)" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <EmptyState icon={MessageSquare} title="Nenhum template encontrado" subtitle='Clique em "Novo template" para criar o primeiro.' />
          ) : (
            filteredTemplates.map(tpl => {
              const bodyComp   = tpl.components.find(c => c.type === 'BODY');
              const headerComp = tpl.components.find(c => c.type === 'HEADER');
              const footerComp = tpl.components.find(c => c.type === 'FOOTER');
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
                    <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Bubble preview */}
                      <div style={{ background: '#f0f2f5', borderRadius: 10, padding: '10px 12px', display: 'inline-block', maxWidth: 360 }}>
                        <div style={{ background: 'white', borderRadius: '3px 12px 12px 12px', padding: '10px 12px', fontSize: 13, lineHeight: 1.5, color: '#111', boxShadow: '0 1px 2px rgba(0,0,0,.08)' }}>
                          {headerComp?.text && <p style={{ margin: '0 0 6px', fontWeight: 700 }}>{headerComp.text}</p>}
                          {bodyComp?.text   && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{bodyComp.text}</p>}
                          {footerComp?.text && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#999' }}>{footerComp.text}</p>}
                        </div>
                      </div>

                      {/* Meta info + delete */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-subtle)', fontFamily: 'monospace' }}>ID: {tpl.id}</p>
                        <button type="button"
                          disabled={deletingName === tpl.name}
                          onClick={() => {
                            if (window.confirm(`Deletar o template "${tpl.name}"? Esta ação não pode ser desfeita.`)) {
                              void deleteTemplate(tpl.name);
                            }
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,.3)', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: deletingName === tpl.name ? 0.5 : 1 }}>
                          <Trash2 size={12} /> {deletingName === tpl.name ? 'Deletando...' : 'Deletar'}
                        </button>
                      </div>
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
                    onChange={e => setAgentDraft(d => ({ ...d, defaultProvider: e.target.value, defaultModel: e.target.value === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash', fallbackModels: [] }))}
                    style={{ ...iStyle, cursor: 'pointer' }}>
                    <option value="gemini">Gemini</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </Field>
                <Field label="Modelo principal">
                  <select value={String(agentDraft.defaultModel || modelOptions[0])}
                    onChange={e => setAgentDraft(d => ({ ...d, defaultModel: e.target.value, fallbackModels: (d.fallbackModels ?? []).filter(m => m !== e.target.value) }))}
                    style={{ ...iStyle, cursor: 'pointer' }}>
                    {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Número que ativa o agente" note="(mensagens recebidas em outros números, ex: disparos, não ativam o agente)">
                <select value={agentDraft.whatsappPhoneNumberId ?? ''}
                  onChange={e => setAgentDraft(d => ({ ...d, whatsappPhoneNumberId: e.target.value || null }))}
                  style={{ ...iStyle, cursor: 'pointer' }}>
                  <option value="">Usar o número padrão do sistema (variável de ambiente)</option>
                  {phoneNums.map(n => (
                    <option key={n.id} value={n.id}>{(n.label ?? n.verified_name) || n.display_phone_number}</option>
                  ))}
                </select>
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Follow-up automático" note="(horas de silêncio antes de reengajar)">
                  <input type="number" min={1} value={agentDraft.followUpDelayHours ?? 24}
                    onChange={e => setAgentDraft(d => ({ ...d, followUpDelayHours: Math.max(1, Number(e.target.value) || 1) }))}
                    style={iStyle} />
                </Field>
                <Field label="Máximo de tentativas" note="(0 desativa o follow-up automático)">
                  <input type="number" min={0} value={agentDraft.followUpMaxAttempts ?? 2}
                    onChange={e => setAgentDraft(d => ({ ...d, followUpMaxAttempts: Math.max(0, Number(e.target.value) || 0) }))}
                    style={iStyle} />
                </Field>
              </div>

              <Field label="Template de reengajamento (Meta)" note="(usado quando o follow-up cai fora da janela de 24h da última mensagem do lead — sem isso, esses follow-ups são pulados)">
                <select value={agentDraft.followUpTemplateName ?? ''}
                  onChange={e => setAgentDraft(d => ({ ...d, followUpTemplateName: e.target.value || null }))}
                  style={{ ...iStyle, cursor: 'pointer' }}>
                  <option value="">Nenhum selecionado</option>
                  {approvedTemplates.map(t => (
                    <option key={`${t.id}-${t.language}`} value={t.name}>{t.name} ({t.language})</option>
                  ))}
                </select>
                {approvedTemplates.length === 0 && (
                  <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--fg-subtle)' }}>
                    Nenhum template aprovado encontrado. Crie e aprove um em "Templates da Meta" primeiro.
                  </p>
                )}
              </Field>

              <Field label="Modelos de fallback" note="(acionados em cascata se o principal falhar)">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 2 }}>
                  {modelOptions
                    .filter(m => m !== String(agentDraft.defaultModel || modelOptions[0]))
                    .map(m => {
                      const checked = (agentDraft.fallbackModels ?? []).includes(m);
                      return (
                        <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`, background: checked ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'var(--bg-subtle)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: checked ? 'var(--accent)' : 'var(--fg-secondary)', userSelect: 'none' }}>
                          <input type="checkbox" checked={checked} style={{ display: 'none' }}
                            onChange={e => setAgentDraft(d => {
                              const current = d.fallbackModels ?? [];
                              return { ...d, fallbackModels: e.target.checked ? [...current, m] : current.filter(x => x !== m) };
                            })} />
                          {m}
                        </label>
                      );
                    })}
                </div>
              </Field>

              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <CheckCircle size={14} color="#16a34a" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
                    Agente <strong>{agentDraft.name}</strong> ativo · principal: <strong>{agentDraft.defaultProvider || 'gemini'} / {agentDraft.defaultModel || '—'}</strong>
                  </span>
                  {(agentDraft.fallbackModels ?? []).length > 0 && (
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>
                      Fallback: {(agentDraft.fallbackModels ?? []).join(' → ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
