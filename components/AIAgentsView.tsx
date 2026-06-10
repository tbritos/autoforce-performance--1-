import React, { useEffect, useMemo, useState } from 'react';
import { Bot, BrainCircuit, Check, Database, FileText, Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import { DataService } from '../services/dataService';
import { AIAgent, AIInteractionLog, AIKnowledgeItem } from '../types';

type Tab = 'agents' | 'knowledge' | 'logs';

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

const geminiModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
const openAIModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];

const asLines = (value: unknown): string => Array.isArray(value) ? value.join('\n') : '';
const fromLines = (value: string): string[] => value.split('\n').map(item => item.trim()).filter(Boolean);
const asTags = (value: unknown): string => Array.isArray(value) ? value.join(', ') : '';
const fromTags = (value: string): string[] => value.split(',').map(item => item.trim()).filter(Boolean);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-black uppercase tracking-wider mb-2" style={{ color: 'var(--fg-muted)' }}>{label}</span>
      {children}
    </label>
  );
}

function inputClass() {
  return 'w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition focus:ring-2 focus:ring-blue-500/20';
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      className={inputClass()}
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }}
    >
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

export default function AIAgentsView() {
  const [tab, setTab] = useState<Tab>('agents');
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [agentDraft, setAgentDraft] = useState<Partial<AIAgent>>(emptyAgent);
  const [knowledge, setKnowledge] = useState<AIKnowledgeItem[]>([]);
  const [knowledgeDraft, setKnowledgeDraft] = useState<Partial<AIKnowledgeItem>>(emptyKnowledge);
  const [logs, setLogs] = useState<AIInteractionLog[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedAgent = useMemo(() => agents.find(agent => agent.id === selectedId), [agents, selectedId]);
  const provider = String(agentDraft.defaultProvider || 'gemini');
  const modelOptions = provider === 'openai' ? openAIModels : geminiModels;

  const filteredAgents = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return agents;
    return agents.filter(agent => [agent.name, agent.description, agent.objective].filter(Boolean).join(' ').toLowerCase().includes(term));
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar IA');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);

  useEffect(() => {
    if (selectedAgent) setAgentDraft(selectedAgent);
  }, [selectedAgent?.id]);

  const saveAgent = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...agentDraft,
        toneOfVoice: fromLines(asLines(agentDraft.toneOfVoice)),
        safetyRules: fromLines(asLines(agentDraft.safetyRules)),
        discoveryQuestions: fromLines(asLines(agentDraft.discoveryQuestions)),
      };
      const saved = selectedId
        ? await DataService.updateAIAgent(selectedId, payload)
        : await DataService.createAIAgent(payload);
      setSelectedId(saved.id);
      setAgentDraft(saved);
      setMessage('Agente salvo.');
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar agente');
    } finally {
      setSaving(false);
    }
  };

  const saveKnowledge = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...knowledgeDraft,
        agentId: knowledgeDraft.agentId || selectedId || null,
        tags: fromTags(asTags(knowledgeDraft.tags)),
        priority: Number(knowledgeDraft.priority || 100),
      };
      if (knowledgeDraft.id) {
        await DataService.updateAIKnowledge(knowledgeDraft.id, payload);
      } else {
        await DataService.createAIKnowledge(payload);
      }
      setKnowledgeDraft({ ...emptyKnowledge, agentId: selectedId || null });
      setMessage('Conhecimento salvo.');
      await loadAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar conhecimento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-8 lg:px-12" style={{ background: 'var(--bg-app)', color: 'var(--fg-primary)' }}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'rgba(69,108,236,0.12)', color: 'var(--af-400)' }}>
                <Bot size={22} />
              </span>
              <div>
                <h1 className="text-3xl font-black">IA / Agentes</h1>
                <p className="mt-1 text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Configure contexto, base de conhecimento e memoria usados nos fluxos de WhatsApp.</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={loadAll} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar
            </button>
            <button type="button" onClick={() => { setSelectedId(''); setAgentDraft(emptyAgent); setTab('agents'); }} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white shadow-lg" style={{ background: 'var(--af-500)' }}>
              <Plus size={16} /> Novo agente
            </button>
          </div>
        </header>

        {message && (
          <div className="rounded-xl border px-4 py-3 text-sm font-bold" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)', color: message.includes('Erro') || message.includes('Error') ? '#FCA5A5' : '#6EE7B7' }}>
            {message}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {[
            { id: 'agents', label: 'Agentes', icon: BrainCircuit },
            { id: 'knowledge', label: 'Base de conhecimento', icon: Database },
            { id: 'logs', label: 'Logs e memoria', icon: FileText },
          ].map(item => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button key={item.id} type="button" onClick={() => setTab(item.id as Tab)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black" style={{ borderColor: active ? 'var(--af-500)' : 'var(--border-subtle)', background: active ? 'rgba(69,108,236,0.12)' : 'var(--bg-surface)', color: active ? 'var(--af-400)' : 'var(--fg-secondary)' }}>
                <Icon size={16} /> {item.label}
              </button>
            );
          })}
        </div>

        {tab === 'agents' && (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <section className="rounded-2xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <div className="border-b p-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-muted)' }} />
                  <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar agente..." className={`${inputClass()} pl-9`} style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }} />
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {filteredAgents.map(agent => (
                  <button key={agent.id} type="button" onClick={() => setSelectedId(agent.id)} className="block w-full p-4 text-left transition hover:bg-blue-500/5" style={{ borderColor: 'var(--border-subtle)', background: selectedId === agent.id ? 'rgba(69,108,236,0.10)' : 'transparent' }}>
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm font-black">{agent.name}</strong>
                      <span className="rounded-full px-2 py-1 text-xs font-black" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>ativo</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs font-medium" style={{ color: 'var(--fg-muted)' }}>{agent.objective || agent.description || 'Sem objetivo cadastrado.'}</p>
                    <div className="mt-3 flex gap-3 text-xs font-bold" style={{ color: 'var(--fg-subtle)' }}>
                      <span>{agent._count?.knowledgeItems ?? 0} docs</span>
                      <span>{agent._count?.interactions ?? 0} logs</span>
                      <span>{agent.defaultProvider || 'gemini'}</span>
                    </div>
                  </button>
                ))}
                {filteredAgents.length === 0 && <div className="p-6 text-sm font-semibold" style={{ color: 'var(--fg-muted)' }}>Nenhum agente cadastrado.</div>}
              </div>
            </section>

            <section className="rounded-2xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <div className="flex items-center justify-between border-b p-5" style={{ borderColor: 'var(--border-subtle)' }}>
                <div>
                  <h2 className="text-lg font-black">{selectedId ? 'Editar agente' : 'Novo agente'}</h2>
                  <p className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Esse contexto entra no prompt enviado ao Gemini/OpenAI.</p>
                </div>
                <button type="button" onClick={saveAgent} disabled={saving} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-60" style={{ background: 'var(--af-500)' }}>
                  <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
              <div className="grid gap-5 p-5 lg:grid-cols-2">
                <Field label="Nome do agente">
                  <input className={inputClass()} value={agentDraft.name || ''} onChange={event => setAgentDraft({ ...agentDraft, name: event.target.value })} placeholder="Ex: SDR Inbound AutoForce" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }} />
                </Field>
                <Field label="Descricao">
                  <input className={inputClass()} value={agentDraft.description || ''} onChange={event => setAgentDraft({ ...agentDraft, description: event.target.value })} placeholder="Ex: Pre-qualificacao de leads inbound" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }} />
                </Field>
                <Field label="Provider">
                  <SelectField value={provider} onChange={value => setAgentDraft({ ...agentDraft, defaultProvider: value, defaultModel: value === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash' })} options={[{ label: 'Gemini', value: 'gemini' }, { label: 'OpenAI', value: 'openai' }]} />
                </Field>
                <Field label="Modelo">
                  <SelectField value={String(agentDraft.defaultModel || modelOptions[0])} onChange={value => setAgentDraft({ ...agentDraft, defaultModel: value })} options={modelOptions.map(model => ({ label: model, value: model }))} />
                </Field>
                <div className="lg:col-span-2">
                  <Field label="Objetivo">
                    <textarea rows={3} className={inputClass()} value={agentDraft.objective || ''} onChange={event => setAgentDraft({ ...agentDraft, objective: event.target.value })} placeholder="Qualificar, entender dor, decidir MQL/nutricao e recomendar proximo passo." style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }} />
                  </Field>
                </div>
                <Field label="Contexto AutoForce">
                  <textarea rows={7} className={inputClass()} value={agentDraft.companyContext || ''} onChange={event => setAgentDraft({ ...agentDraft, companyContext: event.target.value })} style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }} />
                </Field>
                <Field label="Contexto de vendas">
                  <textarea rows={7} className={inputClass()} value={agentDraft.salesContext || ''} onChange={event => setAgentDraft({ ...agentDraft, salesContext: event.target.value })} style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }} />
                </Field>
                <Field label="Tom de voz (1 por linha)">
                  <textarea rows={5} className={inputClass()} value={asLines(agentDraft.toneOfVoice)} onChange={event => setAgentDraft({ ...agentDraft, toneOfVoice: fromLines(event.target.value) })} style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }} />
                </Field>
                <Field label="Regras de seguranca (1 por linha)">
                  <textarea rows={5} className={inputClass()} value={asLines(agentDraft.safetyRules)} onChange={event => setAgentDraft({ ...agentDraft, safetyRules: fromLines(event.target.value) })} style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }} />
                </Field>
                <div className="lg:col-span-2">
                  <Field label="Perguntas de descoberta (1 por linha)">
                    <textarea rows={4} className={inputClass()} value={asLines(agentDraft.discoveryQuestions)} onChange={event => setAgentDraft({ ...agentDraft, discoveryQuestions: fromLines(event.target.value) })} style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }} />
                  </Field>
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === 'knowledge' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <section className="rounded-2xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <div className="border-b p-5" style={{ borderColor: 'var(--border-subtle)' }}>
                <h2 className="text-lg font-black">Base cadastrada</h2>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {knowledge.map(item => (
                  <button key={item.id} type="button" onClick={() => setKnowledgeDraft(item)} className="block w-full p-5 text-left hover:bg-blue-500/5">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="font-black">{item.title}</strong>
                      <span className="text-xs font-black" style={{ color: 'var(--fg-muted)' }}>{item.category}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>{item.content}</p>
                    <div className="mt-3 flex flex-wrap gap-2">{item.tags.map(tag => <span key={tag} className="rounded-full px-2 py-1 text-xs font-bold" style={{ background: 'rgba(69,108,236,0.12)', color: 'var(--af-400)' }}>{tag}</span>)}</div>
                  </button>
                ))}
                {knowledge.length === 0 && <div className="p-6 text-sm font-semibold" style={{ color: 'var(--fg-muted)' }}>Nenhum conhecimento cadastrado.</div>}
              </div>
            </section>

            <section className="rounded-2xl border p-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-black">{knowledgeDraft.id ? 'Editar conhecimento' : 'Novo conhecimento'}</h2>
                {knowledgeDraft.id && <button type="button" onClick={() => setKnowledgeDraft({ ...emptyKnowledge, agentId: selectedId || null })} className="text-sm font-black" style={{ color: 'var(--af-400)' }}>Novo</button>}
              </div>
              <div className="space-y-4">
                <Field label="Agente">
                  <SelectField value={knowledgeDraft.agentId || selectedId || ''} onChange={value => setKnowledgeDraft({ ...knowledgeDraft, agentId: value || null })} options={[{ label: 'Global', value: '' }, ...agents.map(agent => ({ label: agent.name, value: agent.id }))]} />
                </Field>
                <Field label="Titulo">
                  <input className={inputClass()} value={knowledgeDraft.title || ''} onChange={event => setKnowledgeDraft({ ...knowledgeDraft, title: event.target.value })} style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }} />
                </Field>
                <Field label="Categoria">
                  <input className={inputClass()} value={knowledgeDraft.category || ''} onChange={event => setKnowledgeDraft({ ...knowledgeDraft, category: event.target.value })} placeholder="ex: produto, objeções, playbook" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }} />
                </Field>
                <Field label="Tags separadas por virgula">
                  <input className={inputClass()} value={asTags(knowledgeDraft.tags)} onChange={event => setKnowledgeDraft({ ...knowledgeDraft, tags: fromTags(event.target.value) })} placeholder="inbound, automotivo, mql" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }} />
                </Field>
                <Field label="Conteudo">
                  <textarea rows={10} className={inputClass()} value={knowledgeDraft.content || ''} onChange={event => setKnowledgeDraft({ ...knowledgeDraft, content: event.target.value })} style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--fg-primary)' }} />
                </Field>
                <button type="button" onClick={saveKnowledge} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white disabled:opacity-60" style={{ background: 'var(--af-500)' }}>
                  <Check size={16} /> Salvar conhecimento
                </button>
                {knowledgeDraft.id && (
                  <button type="button" onClick={async () => { if (knowledgeDraft.id) { await DataService.deleteAIKnowledge(knowledgeDraft.id); setKnowledgeDraft({ ...emptyKnowledge, agentId: selectedId || null }); await loadAll(); } }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black" style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
                    <Trash2 size={16} /> Desativar conhecimento
                  </button>
                )}
              </div>
            </section>
          </div>
        )}

        {tab === 'logs' && (
          <section className="rounded-2xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
            <div className="border-b p-5" style={{ borderColor: 'var(--border-subtle)' }}>
              <h2 className="text-lg font-black">Ultimas decisoes da IA</h2>
              <p className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>Aqui fica o historico do prompt/resultado usado para cada lead.</p>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {logs.map(log => (
                <div key={log.id} className="grid gap-3 p-5 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
                  <div>
                    <strong className="font-black">{log.leadEmail}</strong>
                    <p className="text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>{log.agent?.name || log.agentId}</p>
                  </div>
                  <div className="text-sm font-bold" style={{ color: 'var(--fg-secondary)' }}>{log.provider} / {log.model}</div>
                  <div className="text-sm font-bold" style={{ color: log.error ? '#FCA5A5' : '#6EE7B7' }}>{log.decision || 'sem decisao'} {log.confidence !== null ? `- ${Math.round((log.confidence || 0) * 100)}%` : ''}</div>
                  <div className="text-xs font-bold" style={{ color: 'var(--fg-subtle)' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</div>
                </div>
              ))}
              {logs.length === 0 && <div className="p-6 text-sm font-semibold" style={{ color: 'var(--fg-muted)' }}>Nenhum log de IA ainda.</div>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
