import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, BrainCircuit, Check, ChevronDown, ChevronRight,
  Database, FileText, HelpCircle, Plus, RefreshCw, RotateCcw,
  Search, Send, Shield, Trash2, User,
} from 'lucide-react';
import { DataService } from '../services/dataService';
import { AIAgent, AIInteractionLog, AIKnowledgeItem } from '../types';

type Tab        = 'agents' | 'knowledge' | 'logs';
type SectionKey = 'identity' | 'model' | 'behavior' | 'context' | 'discovery';

// ─── Constants ────────────────────────────────────────────────────────────────

const emptyAgent: Partial<AIAgent> = {
  name: '',
  description: '',
  objective: '',
  companyContext: '',
  salesContext: '',
  defaultProvider: 'gemini',
  defaultModel: 'gemini-2.5-flash',
  toneOfVoice: ['consultivo', 'objetivo', 'humano'],
  safetyRules: ['Nao inventar informacoes.', 'Nao prometer resultados garantidos.'],
  discoveryQuestions: [],
};

const emptyKnowledge: Partial<AIKnowledgeItem> = {
  title: '',
  category: 'geral',
  content: '',
  tags: [],
  priority: 100,
  agentId: null,
};

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash'];
const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];

// ─── Accordion section metadata ───────────────────────────────────────────────

interface SectionMeta { title: string; subtitle: string; iconBg: string; icon: React.ElementType }

const SECTION_META: Record<SectionKey, SectionMeta> = {
  identity:  { title: 'Identidade',             subtitle: 'Nome, descrição e objetivo do agente',          iconBg: '#f97316', icon: User },
  model:     { title: 'Modelo de IA',            subtitle: 'Provider e versão do modelo',                  iconBg: '#8b5cf6', icon: BrainCircuit },
  behavior:  { title: 'Comportamento',           subtitle: 'Tom de voz e regras de segurança',             iconBg: '#10b981', icon: Shield },
  context:   { title: 'Contexto & conhecimento', subtitle: 'O que o agente sabe sobre a empresa e vendas', iconBg: '#f59e0b', icon: Database },
  discovery: { title: 'Perguntas de descoberta', subtitle: 'Perguntas que o agente faz para qualificar',   iconBg: '#eab308', icon: HelpCircle },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const asLines  = (v: unknown): string => Array.isArray(v) ? v.join('\n') : '';
const fromLines = (v: string): string[] => v.split('\n').map(s => s.trim()).filter(Boolean);
const asTags   = (v: unknown): string => Array.isArray(v) ? v.join(', ') : '';
const fromTags = (v: string): string[] => v.split(',').map(s => s.trim()).filter(Boolean);
const nowTime  = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMsg { role: 'assistant' | 'user'; text: string; time: string }

// ─── Shared input style ───────────────────────────────────────────────────────

const iStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13, boxSizing: 'border-box',
  background: 'var(--bg-subtle)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--fg-primary)', outline: 'none', fontFamily: 'inherit',
};

// ─── Field wrapper ────────────────────────────────────────────────────────────

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

// ─── AccordionSection ─────────────────────────────────────────────────────────

function AccordionSection({
  sectionKey, open, onToggle, children,
}: {
  sectionKey: SectionKey;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const meta = SECTION_META[sectionKey];
  const Icon = meta.icon;
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          width: '100%', padding: '13px 20px',
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ width: 30, height: 30, borderRadius: 8, background: meta.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={14} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)' }}>{meta.title}</p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-subtle)', marginTop: 1 }}>{meta.subtitle}</p>
        </div>
        {open
          ? <ChevronDown size={14} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />
          : <ChevronRight size={14} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{ padding: '4px 20px 20px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function AIAgentsView() {
  const [tab, setTab]                     = useState<Tab>('agents');
  const [agents, setAgents]               = useState<AIAgent[]>([]);
  const [selectedId, setSelectedId]       = useState('');
  const [agentDraft, setAgentDraft]       = useState<Partial<AIAgent>>(emptyAgent);
  const [knowledge, setKnowledge]         = useState<AIKnowledgeItem[]>([]);
  const [knowledgeDraft, setKnowledgeDraft] = useState<Partial<AIKnowledgeItem>>(emptyKnowledge);
  const [logs, setLogs]                   = useState<AIInteractionLog[]>([]);
  const [query, setQuery]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [openSections, setOpenSections]   = useState<Set<SectionKey>>(new Set(['identity']));

  // Chat preview state
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([{
    role: 'assistant',
    text: 'Olá! 👋 Sou o assistente da AutoForce. Vi que você se interessou pela nossa plataforma. Posso fazer algumas perguntas rápidas pra te ajudar melhor?',
    time: nowTime(),
  }]);
  const [chatInput, setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef                  = useRef<HTMLDivElement>(null);

  const selectedAgent = useMemo(() => agents.find(a => a.id === selectedId), [agents, selectedId]);
  const provider      = String(agentDraft.defaultProvider || 'gemini');
  const modelOptions  = provider === 'openai' ? OPENAI_MODELS : GEMINI_MODELS;

  const filteredAgents = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return agents;
    return agents.filter(a =>
      [a.name, a.description, a.objective].filter(Boolean).join(' ').toLowerCase().includes(term)
    );
  }, [agents, query]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [agentList, knowledgeList, logList] = await Promise.all([
        DataService.listAIAgents(),
        DataService.listAIKnowledge(),
        DataService.listAIInteractionLogs({ limit: 30 }),
      ]);
      setAgents(agentList);
      setKnowledge(knowledgeList);
      setLogs(logList);
      if (!selectedId && agentList[0]) {
        setSelectedId(agentList[0].id);
        setAgentDraft(agentList[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);

  useEffect(() => {
    if (selectedAgent) setAgentDraft(selectedAgent);
  }, [selectedAgent?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs]);

  const toggleSection = (key: SectionKey) =>
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const selectAgent = (agent: AIAgent) => {
    setSelectedId(agent.id);
    setAgentDraft(agent);
  };

  const newAgent = () => {
    setSelectedId('');
    setAgentDraft({ ...emptyAgent });
  };

  const saveAgent = async () => {
    setSaving(true);
    try {
      const payload = {
        ...agentDraft,
        toneOfVoice:        fromLines(asLines(agentDraft.toneOfVoice)),
        safetyRules:        fromLines(asLines(agentDraft.safetyRules)),
        discoveryQuestions: fromLines(asLines(agentDraft.discoveryQuestions)),
      };
      const saved = selectedId
        ? await DataService.updateAIAgent(selectedId, payload)
        : await DataService.createAIAgent(payload);
      setSelectedId(saved.id);
      setAgentDraft(saved);
      await loadAll();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const saveKnowledge = async () => {
    setSaving(true);
    try {
      const payload = {
        ...knowledgeDraft,
        agentId:  knowledgeDraft.agentId || selectedId || null,
        tags:     fromTags(asTags(knowledgeDraft.tags)),
        priority: Number(knowledgeDraft.priority || 100),
      };
      if (knowledgeDraft.id) {
        await DataService.updateAIKnowledge(knowledgeDraft.id, payload);
      } else {
        await DataService.createAIKnowledge(payload);
      }
      setKnowledgeDraft({ ...emptyKnowledge, agentId: selectedId || null });
      await loadAll();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput('');
    setChatMsgs(prev => [...prev, { role: 'user', text, time: nowTime() }]);
    setChatLoading(true);
    setTimeout(() => {
      setChatMsgs(prev => [...prev, {
        role: 'assistant',
        text: 'Qual o principal desafio da sua operação de marketing hoje?',
        time: nowTime(),
      }]);
      setChatLoading(false);
    }, 1200);
  };

  const resetChat = () => {
    setChatMsgs([{
      role: 'assistant',
      text: 'Olá! 👋 Sou o assistente da AutoForce. Vi que você se interessou pela nossa plataforma. Posso fazer algumas perguntas rápidas pra te ajudar melhor?',
      time: nowTime(),
    }]);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px 28px 64px', maxWidth: 1480, margin: '0 auto' }} className="animate-fade-in-up">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>IA / Agentes</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4 }}>
            Configure contexto, base de conhecimento e memória usados nos fluxos de WhatsApp.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={loadAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--fg-secondary)', cursor: 'pointer' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button type="button" onClick={() => { newAgent(); setTab('agents'); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer' }}>
            <Plus size={14} /> Novo agente
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([
          { id: 'agents',    label: 'Agentes',              icon: BrainCircuit },
          { id: 'knowledge', label: 'Base de conhecimento', icon: Database },
          { id: 'logs',      label: 'Logs e memória',        icon: FileText },
        ] as const).map(t => {
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

      {/* ── Agents tab ─────────────────────────────────────────────────────────── */}
      {tab === 'agents' && (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 268px', gap: 16, alignItems: 'flex-start' }}>

          {/* Sidebar: agent list */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', position: 'sticky', top: 24 }}>
            <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', pointerEvents: 'none' }} />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar agente..."
                  style={{ ...iStyle, paddingLeft: 28, fontSize: 12, background: 'var(--bg-subtle)' }} />
              </div>
            </div>

            <div style={{ padding: '6px 0' }}>
              {filteredAgents.map(agent => {
                const active = agent.id === selectedId;
                const isNew  = (agent as any).isActive === false;
                return (
                  <button key={agent.id} type="button" onClick={() => selectAgent(agent)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 14px', background: active ? 'var(--accent-soft)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: active ? 'var(--accent)' : 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Bot size={13} color={active ? 'white' : 'var(--fg-muted)'} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--fg-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {agent.name}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-subtle)' }}>
                          <span style={{ color: isNew ? 'var(--fg-subtle)' : '#22c55e' }}>●</span>
                          {' '}{isNew ? 'Rascunho' : 'Ativo'} · {agent.defaultProvider || 'gemini'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredAgents.length === 0 && (
                <p style={{ padding: '12px 14px', fontSize: 12, color: 'var(--fg-muted)', margin: 0 }}>
                  Nenhum agente encontrado.
                </p>
              )}
            </div>

            <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
              <button type="button" onClick={newAgent}
                style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', fontSize: 12, color: 'var(--fg-muted)', cursor: 'pointer', fontWeight: 500 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--fg-muted)'; }}>
                <Plus size={12} /> Novo agente
              </button>
            </div>
          </div>

          {/* Main: accordion form */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--fg-primary)' }}>
                  {selectedId ? (agentDraft.name || 'Editar agente') : 'Novo agente'}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-muted)' }}>
                  Esse contexto entra no prompt enviado ao modelo de IA.
                </p>
              </div>
              <button type="button" onClick={saveAgent} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                <Check size={13} /> {saving ? 'Salvando...' : 'Salvar agente'}
              </button>
            </div>

            {/* Accordion: Identidade */}
            <AccordionSection sectionKey="identity" open={openSections.has('identity')} onToggle={() => toggleSection('identity')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Nome do agente">
                    <input value={agentDraft.name || ''} onChange={e => setAgentDraft(d => ({ ...d, name: e.target.value }))}
                      placeholder="Ex: SDR Inbound AutoForce" style={iStyle} />
                  </Field>
                  <Field label="Descrição">
                    <input value={agentDraft.description || ''} onChange={e => setAgentDraft(d => ({ ...d, description: e.target.value }))}
                      placeholder="Pré-qualificação de leads inbound" style={iStyle} />
                  </Field>
                </div>
                <Field label="Objetivo">
                  <textarea rows={3} value={agentDraft.objective || ''} onChange={e => setAgentDraft(d => ({ ...d, objective: e.target.value }))}
                    placeholder="Qualificar, entender a dor do lead, decidir MQL/nutrição e recomendar o próximo passo."
                    style={{ ...iStyle, resize: 'vertical', lineHeight: 1.5 }} />
                </Field>
              </div>
            </AccordionSection>

            {/* Accordion: Modelo de IA */}
            <AccordionSection sectionKey="model" open={openSections.has('model')} onToggle={() => toggleSection('model')}>
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
            </AccordionSection>

            {/* Accordion: Comportamento */}
            <AccordionSection sectionKey="behavior" open={openSections.has('behavior')} onToggle={() => toggleSection('behavior')}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Tom de voz" note="(1 por linha)">
                  <textarea rows={5} value={asLines(agentDraft.toneOfVoice)}
                    onChange={e => setAgentDraft(d => ({ ...d, toneOfVoice: fromLines(e.target.value) }))}
                    style={{ ...iStyle, resize: 'vertical', lineHeight: 1.5 }} />
                </Field>
                <Field label="Regras de segurança" note="(1 por linha)">
                  <textarea rows={5} value={asLines(agentDraft.safetyRules)}
                    onChange={e => setAgentDraft(d => ({ ...d, safetyRules: fromLines(e.target.value) }))}
                    style={{ ...iStyle, resize: 'vertical', lineHeight: 1.5 }} />
                </Field>
              </div>
            </AccordionSection>

            {/* Accordion: Contexto & conhecimento */}
            <AccordionSection sectionKey="context" open={openSections.has('context')} onToggle={() => toggleSection('context')}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Contexto AutoForce">
                  <textarea rows={7} value={agentDraft.companyContext || ''}
                    onChange={e => setAgentDraft(d => ({ ...d, companyContext: e.target.value }))}
                    style={{ ...iStyle, resize: 'vertical', lineHeight: 1.5 }} />
                </Field>
                <Field label="Contexto de vendas">
                  <textarea rows={7} value={agentDraft.salesContext || ''}
                    onChange={e => setAgentDraft(d => ({ ...d, salesContext: e.target.value }))}
                    style={{ ...iStyle, resize: 'vertical', lineHeight: 1.5 }} />
                </Field>
              </div>
            </AccordionSection>

            {/* Accordion: Perguntas de descoberta */}
            <AccordionSection sectionKey="discovery" open={openSections.has('discovery')} onToggle={() => toggleSection('discovery')}>
              <Field label="Perguntas de qualificação" note="(1 por linha)">
                <textarea rows={5} value={asLines(agentDraft.discoveryQuestions)}
                  onChange={e => setAgentDraft(d => ({ ...d, discoveryQuestions: fromLines(e.target.value) }))}
                  style={{ ...iStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </Field>
            </AccordionSection>
          </div>

          {/* Preview: chat simulation */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'sticky', top: 24 }}>
            {/* Preview header */}
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={13} color="white" />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--fg-primary)' }}>
                    Testar agente · <span style={{ fontWeight: 400, color: 'var(--fg-muted)' }}>preview</span>
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: 'var(--fg-subtle)' }}>WhatsApp</p>
                </div>
              </div>
              <button type="button" onClick={resetChat}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--fg-muted)', padding: '3px 8px', borderRadius: 6 }}>
                <RotateCcw size={10} /> Reiniciar
              </button>
            </div>

            {/* Chat messages */}
            <div style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 6, height: 260, overflowY: 'auto', background: '#f0f2f5' }}>
              {chatMsgs.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '85%', padding: '7px 10px',
                    borderRadius: msg.role === 'user' ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                    background: msg.role === 'user' ? '#dcf8c6' : 'white',
                    fontSize: 12, color: '#111', lineHeight: 1.45,
                    boxShadow: '0 1px 2px rgba(0,0,0,.07)',
                  }}>
                    {msg.text}
                    <p style={{ margin: '3px 0 0', fontSize: 10, color: '#999', textAlign: 'right' }}>{msg.time}</p>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '8px 12px', background: 'white', borderRadius: '2px 12px 12px 12px', fontSize: 14, color: '#aaa', boxShadow: '0 1px 2px rgba(0,0,0,.07)', letterSpacing: 2 }}>
                    •••
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div style={{ padding: '7px 8px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'center', background: 'white' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Simular mensagem do lead..."
                style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: '#f0f2f5', border: 'none', borderRadius: 18, outline: 'none', color: '#111' }}
              />
              <button type="button" onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                style={{ width: 28, height: 28, borderRadius: '50%', background: chatInput.trim() ? 'var(--accent)' : '#ccc', border: 'none', cursor: chatInput.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}>
                <Send size={12} color="white" />
              </button>
            </div>

            {/* Stats footer */}
            <div style={{ padding: '9px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { label: 'Tokens no prompt',            value: '~1.240' },
                { label: 'Custo estimado / conversa',   value: 'R$ 0,03' },
                { label: 'Tempo médio de resposta',      value: '1,8s' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{s.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-secondary)' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Knowledge tab ───────────────────────────────────────────────────────── */}
      {tab === 'knowledge' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>Base cadastrada</p>
            </div>
            <div>
              {knowledge.map(item => (
                <button key={item.id} type="button" onClick={() => setKnowledgeDraft(item)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 20px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <strong style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)' }}>{item.title}</strong>
                    <span style={{ fontSize: 11, color: 'var(--fg-muted)', flexShrink: 0 }}>{item.category}</span>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.content}</p>
                  {item.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {item.tags.map(tag => (
                        <span key={tag} style={{ padding: '2px 8px', borderRadius: 'var(--r-full)', background: 'var(--accent-soft)', fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
              {knowledge.length === 0 && (
                <p style={{ padding: '24px 20px', fontSize: 13, color: 'var(--fg-muted)', textAlign: 'center' }}>Nenhum conhecimento cadastrado.</p>
              )}
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', position: 'sticky', top: 24 }}>
            <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>
                {knowledgeDraft.id ? 'Editar conhecimento' : 'Novo conhecimento'}
              </p>
              {knowledgeDraft.id && (
                <button type="button" onClick={() => setKnowledgeDraft({ ...emptyKnowledge, agentId: selectedId || null })}
                  style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  Novo
                </button>
              )}
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Agente">
                <select value={knowledgeDraft.agentId || selectedId || ''} onChange={e => setKnowledgeDraft(d => ({ ...d, agentId: e.target.value || null }))} style={{ ...iStyle, cursor: 'pointer' }}>
                  <option value="">Global</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="Título">
                <input value={knowledgeDraft.title || ''} onChange={e => setKnowledgeDraft(d => ({ ...d, title: e.target.value }))} style={iStyle} />
              </Field>
              <Field label="Categoria">
                <input value={knowledgeDraft.category || ''} onChange={e => setKnowledgeDraft(d => ({ ...d, category: e.target.value }))}
                  placeholder="produto, objeções, playbook" style={iStyle} />
              </Field>
              <Field label="Tags" note="(separadas por vírgula)">
                <input value={asTags(knowledgeDraft.tags)} onChange={e => setKnowledgeDraft(d => ({ ...d, tags: fromTags(e.target.value) }))}
                  placeholder="inbound, automotivo, mql" style={iStyle} />
              </Field>
              <Field label="Conteúdo">
                <textarea rows={8} value={knowledgeDraft.content || ''} onChange={e => setKnowledgeDraft(d => ({ ...d, content: e.target.value }))}
                  style={{ ...iStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </Field>
              <button type="button" onClick={saveKnowledge} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                <Check size={14} /> Salvar conhecimento
              </button>
              {knowledgeDraft.id && (
                <button type="button"
                  onClick={async () => {
                    if (knowledgeDraft.id) {
                      await DataService.deleteAIKnowledge(knowledgeDraft.id);
                      setKnowledgeDraft({ ...emptyKnowledge, agentId: selectedId || null });
                      await loadAll();
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 8, border: '1px solid rgba(239,68,68,.3)', background: 'transparent', color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <Trash2 size={13} /> Remover
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Logs tab ────────────────────────────────────────────────────────────── */}
      {tab === 'logs' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '13px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>Últimas decisões da IA</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>Histórico do prompt e resultado para cada lead.</p>
          </div>
          <div>
            {logs.map(log => (
              <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)', display: 'block' }}>{log.leadEmail}</strong>
                  <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>{log.agent?.name || log.agentId}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>{log.provider} / {log.model}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: log.error ? '#ef4444' : '#22c55e' }}>
                  {log.decision || 'sem decisão'}{log.confidence !== null ? ` — ${Math.round((log.confidence || 0) * 100)}%` : ''}
                </span>
                <span style={{ fontSize: 11, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>
                  {new Date(log.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
            {logs.length === 0 && (
              <p style={{ padding: '24px 20px', fontSize: 13, color: 'var(--fg-muted)', textAlign: 'center' }}>Nenhum log de IA ainda.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
