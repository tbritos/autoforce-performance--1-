import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  Database,
  GitBranch,
  Mail,
  MessageCircle,
  MoreHorizontal,
  MousePointer2,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Tags,
  Trash2,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { DataService } from '../services/dataService';
import {
  AutomationJourney,
  AutomationJourneyEdge,
  AutomationJourneyNode,
  AutomationJourneyStatus,
  AutomationNodeType,
} from '../types';

const NODE_W = 230;
const NODE_H = 88;

const BLOCKS: Array<{
  type: AutomationNodeType;
  label: string;
  description: string;
  color: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
}> = [
  { type: 'trigger', label: 'Entrada', description: 'Lead entrou, tag aplicada ou webhook recebido', color: '#456CEC', icon: Zap },
  { type: 'condition', label: 'Condicao', description: 'Cargo, tag, score, dor, origem ou campo', color: '#22C55E', icon: GitBranch },
  { type: 'wait', label: 'Esperar', description: 'Aguardar horas ou dias antes do proximo passo', color: '#F59E0B', icon: Clock },
  { type: 'internal_action', label: 'Acao interna', description: 'Adicionar tag, score, etapa ou campo', color: '#14B8A6', icon: Tags },
  { type: 'rd_conversion', label: 'RD Station', description: 'Criar conversao para entrar em fluxo de e-mail', color: '#8B5CF6', icon: Mail },
  { type: 'whatsapp_message', label: 'WhatsApp', description: 'Enviar template ou mensagem da cadencia', color: '#10B981', icon: MessageCircle },
  { type: 'pipedrive_action', label: 'Pipedrive', description: 'Criar ou atualizar negocio comercial', color: '#EF4444', icon: Database },
  { type: 'end', label: 'Fim', description: 'Encerrar a jornada ou parar nutricao', color: '#64748B', icon: Pause },
];

const defaultNodes = (): AutomationJourneyNode[] => [
  {
    id: `node-${Date.now()}-1`,
    type: 'trigger',
    label: 'Lead entrou',
    x: 80,
    y: 180,
    config: { event: 'webhook_received' },
  },
  {
    id: `node-${Date.now()}-2`,
    type: 'rd_conversion',
    label: 'Criar conversao RD',
    x: 380,
    y: 180,
    config: { conversionIdentifier: 'inicio_nutricao', conversionName: 'Inicio da nutricao' },
  },
];

const defaultEdges = (nodes: AutomationJourneyNode[]): AutomationJourneyEdge[] => [
  { id: `edge-${Date.now()}`, source: nodes[0].id, target: nodes[1].id },
];

const blockMeta = (type: AutomationNodeType) => BLOCKS.find(block => block.type === type) ?? BLOCKS[0];

const statusLabel: Record<AutomationJourneyStatus, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativa',
  PAUSED: 'Pausada',
};

type CustomSelectOption<T extends string> = {
  value: T;
  label: string;
};

function CustomSelect<T extends string>({
  value,
  options,
  onChange,
  width = 170,
}: {
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (value: T) => void;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find(option => option.value === value) ?? options[0];

  return (
    <div style={{ position: 'relative', width }}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        style={{
          width: '100%',
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)',
          background: 'var(--bg-surface)',
          color: 'var(--fg-primary)',
          padding: '0 11px',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: open ? '0 0 0 3px var(--accent-soft)' : 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedOption.label}</span>
        <ChevronDown size={15} style={{ color: 'var(--fg-muted)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 40,
            top: 44,
            right: 0,
            width: '100%',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            background: 'var(--bg-elevated)',
            boxShadow: 'var(--shadow-lg)',
            padding: 5,
          }}
        >
          {options.map(option => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => { onChange(option.value); setOpen(false); }}
                style={{
                  width: '100%',
                  minHeight: 34,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  border: 'none',
                  borderRadius: 'var(--r-sm)',
                  background: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--fg-primary)',
                  padding: '7px 8px',
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {option.label}
                {active && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const emptyDraft = () => {
  const nodes = defaultNodes();
  return {
    id: '',
    name: 'Nova jornada',
    description: null,
    status: 'DRAFT' as AutomationJourneyStatus,
    nodes,
    edges: defaultEdges(nodes),
    triggerType: 'webhook_received',
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const AutomationJourneysView: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [journeys, setJourneys] = useState<AutomationJourney[]>([]);
  const [selected, setSelected] = useState<AutomationJourney>(emptyDraft());
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AutomationJourneyStatus>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'name' | 'executions'>('recent');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingName, setEditingName] = useState(false);
  const [panelValues, setPanelValues] = useState<{ label: string; config: Record<string, string> } | null>(null);

  useEffect(() => {
    if (!selectedNodeId) { setPanelValues(null); return; }
    const node = selected.nodes.find(n => n.id === selectedNodeId);
    if (!node) { setPanelValues(null); return; }
    setPanelValues({ label: node.label, config: { ...(node.config ?? {}) } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  const savePanel = () => {
    if (!selectedNodeId || !panelValues) return;
    updateNode(selectedNodeId, { label: panelValues.label, config: panelValues.config });
    setSelectedNodeId(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await DataService.listAutomationJourneys();
      setJourneys(data);
      if (data.length > 0 && !selected.id) setSelected(data[0]);
    } catch (error) {
      console.error('Erro ao carregar jornadas', error);
    } finally {
      setLoading(false);
    }
  }, [selected.id]);

  useEffect(() => { load(); }, [load]);

  const filteredJourneys = useMemo(() => {
    const q = search.trim().toLowerCase();
    return journeys.filter(journey => {
      if (statusFilter !== 'all' && journey.status !== statusFilter) return false;
      if (!q) return true;
      return journey.name.toLowerCase().includes(q) || (journey.description ?? '').toLowerCase().includes(q);
    }).sort((a, b) => {
      if (sortOrder === 'name') return a.name.localeCompare(b.name);
      if (sortOrder === 'executions') return getExecutions(b) - getExecutions(a);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [journeys, search, statusFilter, sortOrder]);


  const updateSelected = (changes: Partial<AutomationJourney>) => {
    setSelected(prev => ({ ...prev, ...changes, updatedAt: new Date().toISOString() }));
  };

  const updateNode = (id: string, changes: Partial<AutomationJourneyNode>) => {
    updateSelected({
      nodes: selected.nodes.map(node => node.id === id ? { ...node, ...changes } : node),
    });
  };

  const createJourney = () => {
    const draft = emptyDraft();
    setSelected(draft);
    setSelectedNodeId(draft.nodes[0]?.id ?? null);
    setConnectFrom(null);
    setViewMode('editor');
  };

  const openJourney = (journey: AutomationJourney) => {
    setSelected(journey);
    setSelectedNodeId(null);
    setConnectFrom(null);
    setViewMode('editor');
  };

  const saveJourney = async () => {
    if (!selected.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: selected.name.trim(),
        description: selected.description,
        status: selected.status,
        nodes: selected.nodes,
        edges: selected.edges,
        triggerType: selected.triggerType,
        isActive: selected.status === 'ACTIVE',
      };
      const saved = selected.id
        ? await DataService.updateAutomationJourney(selected.id, payload)
        : await DataService.createAutomationJourney(payload);

      setSelected(saved);
      setJourneys(prev => {
        const exists = prev.some(item => item.id === saved.id);
        return exists ? prev.map(item => item.id === saved.id ? saved : item) : [saved, ...prev];
      });
    } finally {
      setSaving(false);
    }
  };

  const publishJourney = async () => {
    if (!selected.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: selected.name.trim(),
        description: selected.description,
        status: 'ACTIVE' as AutomationJourneyStatus,
        nodes: selected.nodes,
        edges: selected.edges,
        triggerType: selected.triggerType,
        isActive: true,
      };
      const saved = selected.id
        ? await DataService.updateAutomationJourney(selected.id, payload)
        : await DataService.createAutomationJourney(payload);
      setSelected(saved);
      setJourneys(prev => {
        const exists = prev.some(item => item.id === saved.id);
        return exists ? prev.map(item => item.id === saved.id ? saved : item) : [saved, ...prev];
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteJourney = async () => {
    if (!selected.id) {
      createJourney();
      return;
    }
    if (!window.confirm(`Excluir a jornada "${selected.name}"?`)) return;
    await DataService.deleteAutomationJourney(selected.id);
    const remaining = journeys.filter(item => item.id !== selected.id);
    setJourneys(remaining);
    setSelected(remaining[0] ?? emptyDraft());
    setSelectedNodeId(null);
    setViewMode('list');
  };

  const setStatus = (status: AutomationJourneyStatus) => {
    updateSelected({ status, isActive: status === 'ACTIVE' });
  };

  const addNode = (type: AutomationNodeType, x = 120, y = 120) => {
    const meta = blockMeta(type);
    const node: AutomationJourneyNode = {
      id: `node-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      label: meta.label,
      x,
      y,
      config: {},
    };
    updateSelected({ nodes: [...selected.nodes, node] });
    setSelectedNodeId(node.id);
  };

  const removeNode = (id: string) => {
    updateSelected({
      nodes: selected.nodes.filter(node => node.id !== id),
      edges: selected.edges.filter(edge => edge.source !== id && edge.target !== id),
    });
    if (selectedNodeId === id) setSelectedNodeId(null);
    if (connectFrom === id) setConnectFrom(null);
  };

  const connectNode = (targetId: string) => {
    if (!connectFrom) {
      setConnectFrom(targetId);
      return;
    }
    if (connectFrom === targetId) {
      setConnectFrom(null);
      return;
    }
    const exists = selected.edges.some(edge => edge.source === connectFrom && edge.target === targetId);
    if (!exists) {
      updateSelected({
        edges: [...selected.edges, { id: `edge-${Date.now()}`, source: connectFrom, target: targetId }],
      });
    }
    setConnectFrom(null);
  };

  const removeEdge = (id: string) => {
    updateSelected({ edges: selected.edges.filter(edge => edge.id !== id) });
  };

  const canvasPoint = (event: React.DragEvent | React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 120, y: 120 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onDropBlock = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/x-automation-node') as AutomationNodeType;
    if (!type) return;
    const point = canvasPoint(event);
    addNode(type, Math.max(20, point.x - NODE_W / 2), Math.max(20, point.y - 30));
  };

  const startMoveNode = (event: React.MouseEvent, node: AutomationJourneyNode) => {
    event.stopPropagation();
    const point = canvasPoint(event);
    setDragNodeId(node.id);
    setDragOffset({ x: point.x - node.x, y: point.y - node.y });
    setSelectedNodeId(node.id);
  };

  const moveNode = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragNodeId) return;
    const point = canvasPoint(event);
    updateNode(dragNodeId, {
      x: Math.max(12, point.x - dragOffset.x),
      y: Math.max(12, point.y - dragOffset.y),
    });
  };

  const panelTextField = (key: string, label: string, placeholder: string) => (
    <label key={key} style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</span>
      <input
        value={String(panelValues?.config[key] ?? '')}
        onChange={e => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, [key]: e.target.value } } : prev)}
        placeholder={placeholder}
        className="ds-input"
        style={{ width: '100%' }}
      />
    </label>
  );

  const totalActive = journeys.filter(journey => journey.status === 'ACTIVE').length;
  const totalPaused = journeys.filter(journey => journey.status === 'PAUSED').length;
  const getExecutions = (journey: AutomationJourney) => {
    const stored = journey.nodes.reduce((sum, node) => {
      const value = node.config?.executions;
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
    return stored || 0;
  };

  const toggleJourneyStatus = async (journey: AutomationJourney) => {
    const nextStatus: AutomationJourneyStatus = journey.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const updated = await DataService.updateAutomationJourney(journey.id, {
      status: nextStatus,
      isActive: nextStatus === 'ACTIVE',
    });
    setJourneys(prev => prev.map(item => item.id === journey.id ? updated : item));
    if (selected.id === journey.id) setSelected(updated);
  };

  const pillStyle = (active: boolean): React.CSSProperties => ({
    height: 38,
    padding: '0 14px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border)',
    background: active ? 'var(--accent-soft)' : 'var(--bg-surface)',
    color: active ? 'var(--accent)' : 'var(--fg-primary)',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  });

  if (viewMode === 'list') {
    return (
      <div style={{ padding: '38px 28px 64px', maxWidth: 1140, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }} className="animate-fade-in-up">
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'start' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--fg-primary)', margin: 0 }}>Automação</h1>
            <p style={{ fontSize: 14, color: 'var(--fg-muted)', margin: '8px 0 0', maxWidth: 620, lineHeight: 1.45 }}>
              Crie regras que classificam, roteiam e agem sobre seus leads automaticamente sem intervenção manual.
            </p>
          </div>
          <button
            type="button"
            onClick={createJourney}
            className="ds-btn primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              height: 42,
              padding: '0 20px',
              background: 'var(--accent)',
              color: '#fff',
              borderColor: 'var(--accent)',
              boxShadow: 'var(--shadow-md)',
              borderRadius: 999,
            }}
          >
            <Plus size={15} />
            Automação
          </button>
        </header>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 360, maxWidth: '100%' }}>
              <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar regra por nome ou campo..."
                className="ds-input"
                style={{ width: '100%', height: 38, paddingLeft: 38 }}
              />
            </div>
            <button type="button" onClick={() => setStatusFilter('all')} style={pillStyle(statusFilter === 'all')}>Todas {journeys.length}</button>
            <button type="button" onClick={() => setStatusFilter('ACTIVE')} style={pillStyle(statusFilter === 'ACTIVE')}>Ativas {totalActive}</button>
            <button type="button" onClick={() => setStatusFilter('PAUSED')} style={pillStyle(statusFilter === 'PAUSED')}>Pausadas {totalPaused}</button>
          </div>
          <CustomSelect
            value={sortOrder}
            onChange={setSortOrder}
            width={160}
            options={[
              { value: 'recent', label: 'Mais recentes' },
              { value: 'name', label: 'Nome' },
              { value: 'executions', label: 'Execuções' },
            ]}
          />
        </div>

        <section className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 28, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--fg-muted)' }}>
              <RefreshCw size={16} className="animate-spin" />
              Carregando automações...
            </div>
          ) : filteredJourneys.length === 0 ? (
            <div style={{ padding: 34, color: 'var(--fg-muted)', textAlign: 'center' }}>Nenhuma automação encontrada.</div>
          ) : filteredJourneys.map((journey, index) => {
            const isActive = journey.status === 'ACTIVE';
            const executions = getExecutions(journey);
            return (
              <div
                key={journey.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '58px 1fr 180px 42px 42px',
                  gap: 14,
                  alignItems: 'center',
                  padding: '20px 18px',
                  borderBottom: index === filteredJourneys.length - 1 ? 'none' : '1px solid var(--border)',
                  minHeight: 64,
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleJourneyStatus(journey)}
                  title={isActive ? 'Pausar automação' : 'Ativar automação'}
                  style={{
                    width: 36,
                    height: 22,
                    borderRadius: 999,
                    border: 'none',
                    background: isActive ? 'var(--success)' : 'var(--bg-soft)',
                    padding: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: isActive ? 'flex-end' : 'flex-start',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 999, background: '#fff', display: 'block' }} />
                </button>
                <button
                  type="button"
                  onClick={() => openJourney(journey)}
                  style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                >
                  <strong style={{ color: isActive ? 'var(--fg-primary)' : 'var(--fg-muted)', fontSize: 15 }}>{journey.name}</strong>
                </button>
                <div style={{ color: 'var(--fg-muted)', fontSize: 13 }}>
                  {isActive ? (
                    <><strong style={{ color: 'var(--fg-primary)' }}>{executions.toLocaleString('pt-BR')}</strong> execuções</>
                  ) : 'Pausada'}
                </div>
                <button type="button" onClick={() => openJourney(journey)} title="Editar fluxo" style={{ border: 'none', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                  <Pencil size={16} />
                </button>
                <button type="button" title="Mais opções" style={{ border: 'none', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                  <MoreHorizontal size={17} />
                </button>
              </div>
            );
          })}
        </section>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' }} className="animate-fade-in-up">

      {/* ── TOP HEADER BAR ─────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, padding: '0 20px', height: 60, flexShrink: 0,
        borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)',
      }}>
        {/* Left: back + breadcrumb + name + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="ds-btn secondary"
            style={{ width: 32, height: 32, padding: 0, display: 'grid', placeItems: 'center', flexShrink: 0 }}
          >
            <ChevronLeft size={16} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--fg-subtle)', fontWeight: 600, letterSpacing: '.03em', marginBottom: 3 }}>
              Automação
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {editingName ? (
                <input
                  autoFocus
                  value={selected.name}
                  onChange={e => updateSelected({ name: e.target.value })}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                  className="ds-input"
                  style={{ fontSize: 15, fontWeight: 800, height: 30, padding: '0 8px', width: Math.max(180, selected.name.length * 10) }}
                />
              ) : (
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>
                  {selected.name}
                </span>
              )}
              <button
                type="button"
                onClick={() => setEditingName(v => !v)}
                style={{ border: 'none', background: 'transparent', color: 'var(--fg-subtle)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 2, flexShrink: 0 }}
              >
                <Pencil size={13} />
              </button>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 700, flexShrink: 0,
                background: selected.status === 'ACTIVE' ? 'rgba(34,197,94,0.12)' : selected.status === 'PAUSED' ? 'rgba(245,158,11,0.12)' : 'var(--bg-soft)',
                color: selected.status === 'ACTIVE' ? '#22C55E' : selected.status === 'PAUSED' ? '#F59E0B' : 'var(--fg-muted)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor', display: 'block', flexShrink: 0 }} />
                {statusLabel[selected.status]}
              </span>
            </div>
          </div>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button
            type="button"
            title="Histórico de execuções"
            className="ds-btn secondary"
            style={{ width: 36, height: 36, padding: 0, display: 'grid', placeItems: 'center' }}
          >
            <Clock size={15} />
          </button>
          <button
            type="button"
            onClick={load}
            className="ds-btn secondary"
            disabled={loading}
            style={{ width: 36, height: 36, padding: 0, display: 'grid', placeItems: 'center' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button type="button" className="ds-btn secondary" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', height: 36, padding: '0 14px' }}>
            <Play size={12} style={{ fill: 'currentColor' }} />
            Testar
          </button>
          <button
            type="button"
            onClick={saveJourney}
            className="ds-btn secondary"
            disabled={saving || !selected.name.trim()}
            style={{ display: 'inline-flex', gap: 6, alignItems: 'center', height: 36, padding: '0 14px' }}
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            Salvar rascunho
          </button>
          <button
            type="button"
            onClick={publishJourney}
            className="ds-btn primary"
            disabled={saving || !selected.name.trim()}
            style={{ display: 'inline-flex', gap: 6, alignItems: 'center', height: 36, padding: '0 16px', borderRadius: 999 }}
          >
            <Check size={13} />
            Publicar
          </button>
        </div>
      </header>

      {/* ── EDITOR BODY: sidebar + canvas ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Blocks sidebar */}
        <div style={{ borderRight: '1px solid var(--border)', padding: 12, background: 'var(--bg-muted)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--fg-primary)', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            <Workflow size={14} />
            Blocos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {BLOCKS.map(block => {
              const Icon = block.icon;
              return (
                <div
                  key={block.type}
                  draggable
                  onDragStart={event => event.dataTransfer.setData('application/x-automation-node', block.type)}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    padding: 10,
                    background: 'var(--bg-surface)',
                    cursor: 'grab',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, display: 'grid', placeItems: 'center', background: `${block.color}22`, color: block.color }}>
                      <Icon size={14} />
                    </span>
                    <strong style={{ color: 'var(--fg-primary)', fontSize: 12 }}>{block.label}</strong>
                  </div>
                  <p style={{ margin: '7px 0 0', color: 'var(--fg-muted)', fontSize: 11, lineHeight: 1.35 }}>{block.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Canvas + panel wrapper */}
        <div style={{ position: 'relative', overflow: 'hidden' }}>

        {/* Canvas */}
        <div
          ref={canvasRef}
          onDrop={onDropBlock}
          onDragOver={event => event.preventDefault()}
          onMouseMove={moveNode}
          onMouseUp={() => setDragNodeId(null)}
          onMouseLeave={() => setDragNodeId(null)}
          onClick={() => setSelectedNodeId(null)}
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'auto',
            background:
              'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            backgroundColor: 'var(--bg-app)',
          }}
        >
          <svg style={{ position: 'absolute', inset: 0, width: 1800, height: 1200, pointerEvents: 'none', overflow: 'visible' }}>
            {selected.edges.map(edge => {
              const source = selected.nodes.find(node => node.id === edge.source);
              const target = selected.nodes.find(node => node.id === edge.target);
              if (!source || !target) return null;
              const x1 = source.x + NODE_W;
              const y1 = source.y + NODE_H / 2;
              const x2 = target.x;
              const y2 = target.y + NODE_H / 2;
              const mid = Math.max(70, Math.abs(x2 - x1) / 2);
              return (
                <g key={edge.id}>
                  <path
                    d={`M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    markerEnd="url(#arrow)"
                  />
                </g>
              );
            })}
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L8,3 z" fill="var(--accent)" />
              </marker>
            </defs>
          </svg>

          {selected.edges.map(edge => {
            const source = selected.nodes.find(node => node.id === edge.source);
            const target = selected.nodes.find(node => node.id === edge.target);
            if (!source || !target) return null;
            return (
              <button
                key={`btn-${edge.id}`}
                type="button"
                onClick={event => { event.stopPropagation(); removeEdge(edge.id); }}
                title="Remover conexao"
                style={{
                  position: 'absolute',
                  left: (source.x + target.x + NODE_W) / 2,
                  top: (source.y + target.y + NODE_H) / 2 - 12,
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--fg-muted)',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  zIndex: 4,
                }}
              >
                <X size={12} />
              </button>
            );
          })}

          {selected.nodes.map(node => {
            const meta = blockMeta(node.type);
            const Icon = meta.icon;
            const active = selectedNodeId === node.id;
            const connecting = connectFrom === node.id;
            return (
              <div
                key={node.id}
                onMouseDown={event => startMoveNode(event, node)}
                onClick={event => { event.stopPropagation(); setSelectedNodeId(node.id); }}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: NODE_W,
                  minHeight: NODE_H,
                  border: `1px solid ${active || connecting ? meta.color : 'var(--border)'}`,
                  borderRadius: 'var(--r-lg)',
                  background: 'var(--bg-surface)',
                  boxShadow: active ? `0 0 0 3px ${meta.color}22` : 'var(--shadow-sm)',
                  padding: 12,
                  cursor: dragNodeId === node.id ? 'grabbing' : 'grab',
                  zIndex: active ? 8 : 5,
                  transition: 'box-shadow .12s, border-color .12s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', background: `${meta.color}22`, color: meta.color }}>
                    <Icon size={16} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', color: 'var(--fg-primary)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.label}</strong>
                    <span style={{ display: 'block', color: 'var(--fg-muted)', fontSize: 11, marginTop: 2 }}>{meta.label}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onMouseDown={event => event.stopPropagation()}
                    onClick={event => { event.stopPropagation(); connectNode(node.id); }}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      padding: '5px 8px',
                      background: connecting ? `${meta.color}22` : 'var(--bg-elevated)',
                      color: connecting ? meta.color : 'var(--fg-muted)',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {connectFrom && connectFrom !== node.id ? 'Ligar aqui' : 'Conectar'}
                  </button>
                  <MousePointer2 size={13} style={{ color: 'var(--fg-subtle)' }} />
                </div>
              </div>
            );
          })}

          {selected.nodes.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--fg-muted)', fontSize: 14 }}>
              Arraste blocos da esquerda para montar a jornada.
            </div>
          )}

          {/* Canvas footer */}
          <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '6px 12px', fontSize: 12, color: 'var(--fg-muted)', pointerEvents: 'none' }}>
            <Search size={12} />
            {selected.nodes.length} blocos · {selected.edges.length} conexões
          </div>
          <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button type="button" style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--fg-muted)', cursor: 'default', display: 'grid', placeItems: 'center', fontSize: 16, lineHeight: 1 }}>+</button>
            <button type="button" style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--fg-muted)', cursor: 'default', display: 'grid', placeItems: 'center', fontSize: 16, lineHeight: 1 }}>−</button>
          </div>
        </div>

        {/* ── CONFIG PANEL (n8n style) ─────────────────────────────────────────── */}
        {(() => {
          if (!selectedNodeId || !panelValues) return null;
          const panelNode = selected.nodes.find(n => n.id === selectedNodeId);
          if (!panelNode) return null;
          const meta = blockMeta(panelNode.type);
          const Icon = meta.icon;
          return (
            <div
              style={{
                position: 'absolute', top: 0, right: 0, bottom: 0, width: 340,
                background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', zIndex: 30,
                boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
              }}
            >
              {/* Panel header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', background: `${meta.color}18`, color: meta.color, flexShrink: 0 }}>
                    <Icon size={20} />
                  </span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-primary)' }}>{meta.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>Configurar bloco</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNodeId(null)}
                  style={{ border: 'none', background: 'var(--bg-soft)', color: 'var(--fg-muted)', cursor: 'pointer', display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 'var(--r-sm)' }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Panel form */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Node name */}
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Nome do bloco</span>
                  <input
                    value={panelValues.label}
                    onChange={e => setPanelValues(prev => prev ? { ...prev, label: e.target.value } : prev)}
                    className="ds-input"
                    style={{ width: '100%' }}
                  />
                </label>

                {/* Type-specific fields */}
                {panelNode.type === 'trigger' && panelTextField('event', 'Evento de entrada', 'webhook_received, tag_added...')}
                {panelNode.type === 'condition' && (<>
                  {panelTextField('field', 'Campo ou tag', 'jobTitle, tags, score...')}
                  {panelTextField('operator', 'Operador', 'contém, igual, maior que...')}
                  {panelTextField('value', 'Valor', 'CEO, decisor, 50...')}
                </>)}
                {panelNode.type === 'wait' && (<>
                  {panelTextField('amount', 'Tempo', '2')}
                  {panelTextField('unit', 'Unidade', 'horas ou dias')}
                </>)}
                {panelNode.type === 'internal_action' && (<>
                  {panelTextField('action', 'Ação', 'add_tag, set_status, add_score...')}
                  {panelTextField('value', 'Valor', 'persona:decisor, MQL, 10...')}
                </>)}
                {panelNode.type === 'rd_conversion' && (<>
                  {panelTextField('conversionIdentifier', 'Identificador', 'interesse_decisor')}
                  {panelTextField('conversionName', 'Nome da conversão', 'Interesse - Decisor')}
                </>)}
                {panelNode.type === 'whatsapp_message' && (<>
                  {panelTextField('templateName', 'Template WhatsApp', 'diagnostico_site_01')}
                  {panelTextField('messageGoal', 'Objetivo da mensagem', 'Convidar para diagnóstico')}
                </>)}
                {panelNode.type === 'pipedrive_action' && (<>
                  {panelTextField('action', 'Ação Pipedrive', 'create_deal, update_stage...')}
                  {panelTextField('pipeline', 'Pipeline', 'novo_cliente')}
                </>)}
                {panelNode.type === 'end' && panelTextField('reason', 'Motivo de encerramento', 'mql_created, opted_out...')}
              </div>

              {/* Panel footer */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={savePanel}
                  className="ds-btn primary"
                  style={{ flex: 1, display: 'inline-flex', gap: 7, alignItems: 'center', justifyContent: 'center', height: 40 }}
                >
                  <Check size={14} />
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => { removeNode(panelNode.id); }}
                  className="ds-btn danger"
                  style={{ width: 40, height: 40, display: 'grid', placeItems: 'center' }}
                  title="Remover bloco"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })()}

        </div>{/* end canvas+panel wrapper */}
      </div>
    </div>
  );
};

export default AutomationJourneysView;
