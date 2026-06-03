import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
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
  UserPlus,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { DataService } from '../services/dataService';
import {
  AutomationJourney,
  AutomationJourneyEdge,
  AutomationJourneyNode,
  AutomationJourneyStatus,
  AutomationNodeType,
  WhatsAppTemplate,
  PipedriveStage,
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
  { type: 'trigger',          label: 'Entrada',      description: 'Lead entrou, tag aplicada ou webhook recebido',  color: '#456CEC', icon: Zap },
  { type: 'condition',        label: 'Condição',     description: 'Cargo, tag, score, dor, origem ou campo',        color: '#22C55E', icon: GitBranch },
  { type: 'wait',             label: 'Esperar',      description: 'Aguardar horas ou dias antes do próximo passo',  color: '#F59E0B', icon: Clock },
  { type: 'internal_action',  label: 'Ação interna', description: 'Adicionar tag, score, etapa ou campo',           color: '#14B8A6', icon: Tags },
  { type: 'rd_conversion',    label: 'RD Station',   description: 'Criar conversão para entrar em fluxo de e-mail', color: '#8B5CF6', icon: Mail },
  { type: 'whatsapp_message', label: 'WhatsApp',     description: 'Enviar template ou mensagem da cadência',        color: '#10B981', icon: MessageCircle },
  { type: 'pipedrive_action', label: 'Pipedrive',    description: 'Criar ou atualizar negócio comercial',           color: '#EF4444', icon: Database },
  { type: 'end',              label: 'Fim',          description: 'Encerrar a jornada ou aguardar evento',          color: '#64748B', icon: Pause },
];

const LEAD_STATUS_OPTIONS = [
  { value: 'Novo', label: 'Novo' },
  { value: 'MQL', label: 'MQL' },
  { value: 'SQL', label: 'SQL' },
  { value: 'Oportunidade', label: 'Oportunidade' },
  { value: 'Cliente', label: 'Cliente' },
  { value: 'Inativo', label: 'Inativo' },
];

const defaultNodes = (): AutomationJourneyNode[] => [
  {
    id: `node-${Date.now()}-1`,
    type: 'trigger',
    label: 'Entrada',
    x: 160,
    y: 200,
    config: {},
  },
];

const defaultEdges = (): AutomationJourneyEdge[] => [];

const blockMeta = (type: AutomationNodeType) => BLOCKS.find(block => block.type === type) ?? BLOCKS[0];

function nodeSubtitle(node: AutomationJourneyNode): { text: string; warn: boolean } {
  const c = (node.config ?? {}) as Record<string, string>;
  switch (node.type) {
    case 'trigger': {
      if (!c.event) return { text: '⚠ Configure o gatilho', warn: true };
      const labels: Record<string, string> = {
        lead_created:   'Lead entrou na base',
        conversion:     c.eventValue ? `Conversão: ${c.eventValue}` : 'Conversão específica',
        tag_added:      c.eventValue ? `Tag: ${c.eventValue}` : 'Tag aplicada',
        score_reached:  c.eventValue ? `Score ≥ ${c.eventValue}` : 'Score atingiu limite',
        status_changed: c.eventValue ? `Etapa → ${c.eventValue}` : 'Etapa mudou',
      };
      return { text: labels[c.event] ?? c.event, warn: false };
    }
    case 'wait':
      if (c.amount && c.unit) return { text: `Aguardar ${c.amount} ${c.unit}`, warn: false };
      return { text: 'Definir tempo...', warn: false };
    case 'condition':
      if (c.field && c.value) return { text: `${c.field} ${c.operator ?? ''} ${c.value}`.trim(), warn: false };
      return { text: 'Definir condição...', warn: false };
    case 'internal_action': {
      const labels: Record<string, string> = {
        add_tag:    c.value ? `+tag: ${c.value}` : 'Adicionar tag',
        remove_tag: c.value ? `-tag: ${c.value}` : 'Remover tag',
        set_status: c.value ? `Etapa: ${c.value}` : 'Mudar etapa',
        add_score:  c.value ? `+${c.value} pts` : 'Adicionar score',
        set_score:  c.value ? `Score: ${c.value}` : 'Definir score',
      };
      return { text: c.action ? (labels[c.action] ?? c.action) : 'Definir ação...', warn: false };
    }
    case 'rd_conversion':
      return { text: c.conversionName || c.conversionIdentifier || 'Configurar conversão...', warn: false };
    case 'whatsapp_message':
      return { text: c.templateName || 'Selecionar template...', warn: false };
    case 'pipedrive_action': {
      const labels: Record<string, string> = {
        create_deal:  c.pipeline ? `Criar · ${c.pipeline === 'novo_cliente' ? 'Novo Cliente' : 'Upsell'}` : 'Criar negócio',
        update_stage: 'Mudar estágio',
        mark_won:     'Marcar como ganho',
        mark_lost:    'Marcar como perdido',
      };
      return { text: c.action ? (labels[c.action] ?? c.action) : 'Definir ação...', warn: false };
    }
    case 'end':
      return { text: c.reason || 'Encerrar jornada', warn: false };
    default:
      return { text: blockMeta(node.type).label, warn: false };
  }
}

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
            boxShadow: 'var(--shadow-md)',
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

// ── Smart Select (searchable, portal dropdown, works inside modals) ──────────

type SmartSelectOption = {
  value: string;
  label: string;
  description?: string;
};

function SmartSelect({
  value,
  options,
  onChange,
  placeholder = 'Selecionar...',
  loading = false,
}: {
  value: string;
  options: SmartSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropPos, setDropPos] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const DROPDOWN_MAX_H = 260;

  const handleOpen = () => {
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const openUpward = spaceBelow < DROPDOWN_MAX_H + 8 && r.top > DROPDOWN_MAX_H;
      setDropPos({
        top: openUpward ? undefined : r.bottom + 4,
        bottom: openUpward ? window.innerHeight - r.top + 4 : undefined,
        left: r.left,
        width: r.width,
      });
    }
    setOpen(prev => !prev);
    if (!open) setSearch('');
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !dropdownRef.current?.contains(t)) {
        setOpen(false);
      }
    };
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
  }, [open]);

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;
  const selectedOpt = options.find(o => o.value === value);

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 42,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    border: `1.5px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 10, background: 'var(--bg-surface)',
    color: selectedOpt ? 'var(--fg-primary)' : 'var(--fg-muted)',
    padding: '0 12px', fontSize: 14, cursor: 'pointer',
    boxShadow: open ? '0 0 0 3px var(--accent-soft)' : 'none',
    transition: 'border-color .12s, box-shadow .12s',
  };

  return (
    <div style={{ position: 'relative' }}>
      <button ref={buttonRef} type="button" onClick={handleOpen} style={inputStyle}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', flex: 1 }}>
          {loading ? 'Carregando...' : (selectedOpt?.label ?? placeholder)}
        </span>
        <ChevronDown
          size={15}
          style={{ color: 'var(--fg-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        />
      </button>

      {open && dropPos && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed', zIndex: 1200,
            top: dropPos.top,
            bottom: dropPos.bottom,
            left: dropPos.left,
            width: dropPos.width,
            maxHeight: DROPDOWN_MAX_H,
            border: '1.5px solid var(--border)', borderRadius: 10,
            background: 'var(--bg-elevated)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {options.length > 5 && (
            <div style={{ padding: '8px 8px 4px' }}>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                style={{
                  width: '100%', height: 34, padding: '0 10px', boxSizing: 'border-box',
                  border: '1px solid var(--border)', borderRadius: 7,
                  background: 'var(--bg-surface)', color: 'var(--fg-primary)',
                  fontSize: 13, outline: 'none',
                }}
              />
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: 5 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '10px 8px', fontSize: 13, color: 'var(--fg-muted)', textAlign: 'center' }}>
                Nenhum resultado
              </div>
            ) : filtered.map(opt => {
              const isActive = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
                  style={{
                    width: '100%', minHeight: 36, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 8,
                    border: 'none', borderRadius: 7,
                    background: isActive ? 'var(--accent-soft)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--fg-primary)',
                    padding: '7px 10px', fontSize: 13,
                    fontWeight: isActive ? 700 : 400,
                    textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  <div>
                    <div style={{ lineHeight: 1.3 }}>{opt.label}</div>
                    {opt.description && (
                      <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 1 }}>{opt.description}</div>
                    )}
                  </div>
                  {isActive && <Check size={14} style={{ flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Tag Selector (async, fetches available tags from API) ─────────────────────

function TagSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    DataService.getAllLeadTags()
      .then(t => setTags(t))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const options: SmartSelectOption[] = tags.map(tag => ({ value: tag, label: tag }));

  return (
    <SmartSelect
      value={value}
      options={options}
      onChange={onChange}
      placeholder="Selecionar tag..."
      loading={loading}
    />
  );
}

// ── Webhook Source Selector (async, fetches webhook sources from API) ─────────

function WebhookSourceSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [sources, setSources] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    DataService.listLeadWebhooks()
      .then(s => setSources(s.filter(w => w.isActive)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const options: SmartSelectOption[] = sources.map(s => ({
    value: s.id,
    label: s.name,
    description: s.type,
  }));

  return (
    <SmartSelect
      value={value}
      options={options}
      onChange={onChange}
      placeholder="Selecionar conversão..."
      loading={loading}
    />
  );
}

// ── RD Station Field Selector ─────────────────────────────────────────────────

function RDFieldSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [fields, setFields] = useState<Array<{ uuid: string; api_identifier: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    DataService.getRdStationFields()
      .then(f => setFields(f))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const options: SmartSelectOption[] = fields.map(f => ({
    value: f.api_identifier,
    label: f.label,
    description: f.api_identifier,
  }));

  return (
    <SmartSelect
      value={value}
      options={options}
      onChange={onChange}
      placeholder="Campo do RD Station..."
      loading={loading}
    />
  );
}

// ── WhatsApp Template Selector ────────────────────────────────────────────────

function extractTemplateVars(components: WhatsAppTemplate['components']): string[] {
  const vars: string[] = [];
  for (const comp of components) {
    if ((comp.type === 'HEADER' || comp.type === 'BODY') && comp.text) {
      const matches = comp.text.match(/\{\{\d+\}\}/g) ?? [];
      vars.push(...matches);
    }
  }
  return [...new Set(vars)].sort((a, b) => {
    return parseInt(a.replace(/\D/g, '')) - parseInt(b.replace(/\D/g, ''));
  });
}

function WhatsAppTemplateSelector({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (name: string, template: WhatsAppTemplate | undefined) => void;
}) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    DataService.getWhatsAppTemplates()
      .then(t => setTemplates(t))
      .catch(e => setError(e instanceof Error ? e.message : 'Erro ao carregar templates'))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div style={{ fontSize: 12, color: 'var(--red-600)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>
        {error}
      </div>
    );
  }

  const options: SmartSelectOption[] = templates.map(t => ({
    value: t.name,
    label: t.name,
    description: `${t.category} · ${t.language}`,
  }));

  return (
    <SmartSelect
      value={value}
      options={options}
      onChange={name => onSelect(name, templates.find(t => t.name === name))}
      placeholder="Selecionar template aprovado..."
      loading={loading}
    />
  );
}

// ── Pipedrive Stage Selector ──────────────────────────────────────────────────

function PipedriveStageSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [stages, setStages] = useState<PipedriveStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    DataService.getPipedriveStages()
      .then(s => setStages(s))
      .catch(e => setError(e instanceof Error ? e.message : 'Erro ao carregar estágios'))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div style={{ fontSize: 12, color: 'var(--red-600)', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>
        {error}
      </div>
    );
  }

  // Group by pipeline_name for description
  const options: SmartSelectOption[] = stages.map(s => ({
    value: String(s.id),
    label: s.name,
    description: s.pipeline_name,
  }));

  return (
    <SmartSelect
      value={value}
      options={options}
      onChange={onChange}
      placeholder="Selecionar estágio..."
      loading={loading}
    />
  );
}

// ── Lead field options (campos do nosso sistema) ──────────────────────────────

const OUR_LEAD_FIELDS: SmartSelectOption[] = [
  { value: 'name',        label: 'Nome completo',   description: 'lead.name' },
  { value: 'email',       label: 'Email',           description: 'lead.email' },
  { value: 'phone',       label: 'Telefone',        description: 'lead.phone' },
  { value: 'jobTitle',    label: 'Cargo',           description: 'lead.jobTitle' },
  { value: 'companyName', label: 'Empresa',         description: 'lead.companyName' },
  { value: 'origin',      label: 'Origem',          description: 'lead.origin' },
  { value: 'campaign',    label: 'Campanha',        description: 'lead.campaign' },
  { value: 'status',      label: 'Etapa',           description: 'lead.status' },
  { value: 'score',       label: 'Score',           description: 'lead.score' },
];

// ── Template Textarea (textarea + field chips that insert variables) ──────────

const NOTE_VARS = [
  { label: 'Nome',       var: '{nome}' },
  { label: 'Empresa',    var: '{empresa}' },
  { label: 'Cargo',      var: '{cargo}' },
  { label: 'Email',      var: '{email}' },
  { label: 'Telefone',   var: '{telefone}' },
  { label: 'Campanha',   var: '{campanha}' },
  { label: 'Origem',     var: '{origem}' },
  { label: 'Score',      var: '{score}' },
  { label: 'Landing',    var: '{landing_page}' },
];

function TemplateTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insertVar = (varStr: string) => {
    const el = ref.current;
    if (!el) { onChange(value + varStr); return; }
    const start = el.selectionStart ?? value.length;
    const end   = el.selectionEnd   ?? value.length;
    const next  = value.slice(0, start) + varStr + value.slice(end);
    onChange(next);
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + varStr.length, start + varStr.length);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%', padding: '10px 12px', boxSizing: 'border-box',
          border: '1.5px solid var(--border)', borderRadius: 10,
          background: 'var(--bg-surface)', color: 'var(--fg-primary)',
          fontSize: 13, outline: 'none', resize: 'vertical', lineHeight: 1.5,
          fontFamily: 'inherit',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-soft)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {NOTE_VARS.map(v => (
          <button
            key={v.var}
            type="button"
            onClick={() => insertVar(v.var)}
            style={{
              padding: '3px 9px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'var(--bg-subtle)', color: 'var(--fg-secondary)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const emptyDraft = () => {
  const nodes = defaultNodes();
  return {
    id: '',
    name: 'Nova jornada',
    description: null,
    status: 'DRAFT' as AutomationJourneyStatus,
    nodes,
    edges: defaultEdges(),
    triggerType: 'webhook_received',
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const AutomationJourneysView: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();

  const [journeys, setJourneys] = useState<AutomationJourney[]>([]);
  const [selected, setSelected] = useState<AutomationJourney>(emptyDraft());
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
  const [modalNodeId, setModalNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!modalNodeId) { setPanelValues(null); return; }
    const node = selected.nodes.find(n => n.id === modalNodeId);
    if (!node) { setPanelValues(null); return; }
    setPanelValues({ label: node.label, config: { ...(node.config ?? {}) } as Record<string, string> });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalNodeId]);

  const savePanel = () => {
    if (!modalNodeId || !panelValues) return;
    const node = selected.nodes.find(n => n.id === modalNodeId);
    const label = node ? blockMeta(node.type).label : panelValues.label;
    updateNode(modalNodeId, { label, config: panelValues.config });
    setModalNodeId(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await DataService.listAutomationJourneys();
      setJourneys(data);
    } catch (error) {
      console.error('Erro ao carregar jornadas', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Delete selected node with Delete/Backspace key
  useEffect(() => {
    if (!routeId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // don't interfere with text editing
      if (!selectedNodeId || modalNodeId) return;
      removeNode(selectedNodeId);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, selectedNodeId, modalNodeId]);

  // Sync selected journey with URL param
  useEffect(() => {
    if (!routeId) return;
    if (routeId === 'new') {
      setSelected(emptyDraft());
      setSelectedNodeId(null);
      setConnectFrom(null);
      return;
    }
    const found = journeys.find(j => j.id === routeId);
    if (found) {
      setSelected(found);
      setSelectedNodeId(null);
      setConnectFrom(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, journeys]);

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
    navigate('/automation/new');
  };

  const openJourney = (journey: AutomationJourney) => {
    navigate('/automation/' + journey.id);
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
      if (routeId === 'new') navigate('/automation/' + saved.id, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  const publishJourney = async () => {
    if (!selected.name.trim()) return;
    const triggerNode = selected.nodes.find(n => n.type === 'trigger');
    if (!triggerNode?.config?.event) {
      alert('Configure o bloco Entrada antes de publicar. Dê um duplo clique nele para abrir as configurações.');
      setModalNodeId(triggerNode?.id ?? null);
      return;
    }
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
      if (routeId === 'new') navigate('/automation/' + saved.id, { replace: true });
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
    setSelectedNodeId(null);
    navigate('/automation');
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
    const node = selected.nodes.find(n => n.id === id);
    if (node?.type === 'trigger') return; // trigger is mandatory and cannot be deleted
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
    // Trigger is mandatory and unique — block adding a second one
    if (type === 'trigger' && selected.nodes.some(n => n.type === 'trigger')) return;
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

  // ── Panel field helpers ──────────────────────────────────────────────────────

  const fieldInputStyle: React.CSSProperties = {
    width: '100%', height: 42, padding: '0 12px', boxSizing: 'border-box',
    border: '1.5px solid var(--border)', borderRadius: 10,
    background: 'var(--bg-surface)', color: 'var(--fg-primary)',
    fontSize: 14, outline: 'none',
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 800, color: 'var(--fg-muted)',
    textTransform: 'uppercase', letterSpacing: '.05em',
  };

  const panelTextField = (key: string, label: string, placeholder: string, type = 'text') => (
    <label key={key} style={{ display: 'grid', gap: 7 }}>
      <span style={fieldLabelStyle}>{label}</span>
      <input
        type={type}
        value={String(panelValues?.config[key] ?? '')}
        onChange={e => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, [key]: e.target.value } } : prev)}
        placeholder={placeholder}
        style={fieldInputStyle}
        onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-soft)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
      />
    </label>
  );

  const panelSelectField = (key: string, label: string, options: SmartSelectOption[], placeholder?: string) => (
    <div key={key} style={{ display: 'grid', gap: 7 }}>
      <span style={fieldLabelStyle}>{label}</span>
      <SmartSelect
        value={String(panelValues?.config[key] ?? '')}
        options={options}
        onChange={v => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, [key]: v } } : prev)}
        placeholder={placeholder ?? 'Selecionar...'}
      />
    </div>
  );

  const panelTagField = (key: string, label: string) => (
    <div key={key} style={{ display: 'grid', gap: 7 }}>
      <span style={fieldLabelStyle}>{label}</span>
      <TagSelector
        value={String(panelValues?.config[key] ?? '')}
        onChange={v => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, [key]: v } } : prev)}
      />
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────

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

  if (!routeId) {
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
                    height: 20,
                    borderRadius: 999,
                    border: `1.5px solid ${isActive ? 'var(--green-500)' : 'var(--border)'}`,
                    background: isActive ? 'var(--green-500)' : 'transparent',
                    padding: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: isActive ? 'flex-end' : 'flex-start',
                    alignItems: 'center',
                    flexShrink: 0,
                    transition: 'background .15s, border-color .15s',
                  }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: 999,
                    background: isActive ? '#fff' : 'var(--fg-muted)',
                    display: 'block', flexShrink: 0,
                    transition: 'background .15s',
                  }} />
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
        gap: 16, padding: '0 20px', height: 58, flexShrink: 0,
        borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)',
      }}>
        {/* Left: back + breadcrumb + name + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => navigate('/automation')}
            style={{
              width: 34, height: 34, padding: 0, display: 'grid', placeItems: 'center', flexShrink: 0,
              border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)',
              color: 'var(--fg-muted)', cursor: 'pointer',
            }}
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
                padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, flexShrink: 0,
                background: selected.status === 'ACTIVE' ? 'rgba(34,197,94,0.12)' : selected.status === 'PAUSED' ? 'rgba(245,158,11,0.12)' : 'var(--bg-muted)',
                color: selected.status === 'ACTIVE' ? '#22C55E' : selected.status === 'PAUSED' ? '#F59E0B' : 'var(--fg-muted)',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor', display: 'block', flexShrink: 0 }} />
                {statusLabel[selected.status]}
              </span>
            </div>
          </div>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <button
            type="button"
            title="Histórico de execuções"
            style={{
              width: 34, height: 34, padding: 0, display: 'grid', placeItems: 'center', flexShrink: 0,
              border: '1px solid var(--border)', borderRadius: 999, background: 'var(--bg-surface)',
              color: 'var(--fg-muted)', cursor: 'pointer',
            }}
          >
            <Clock size={15} />
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            title="Recarregar"
            style={{
              width: 34, height: 34, padding: 0, display: 'grid', placeItems: 'center', flexShrink: 0,
              border: '1px solid var(--border)', borderRadius: 999, background: 'var(--bg-surface)',
              color: 'var(--fg-muted)', cursor: 'pointer', opacity: loading ? 0.5 : 1,
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <span style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0, margin: '0 2px' }} />

          <button
            type="button"
            style={{
              display: 'inline-flex', gap: 6, alignItems: 'center', height: 34, padding: '0 14px',
              border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)',
              color: 'var(--fg-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Play size={11} style={{ fill: 'currentColor' }} />
            Testar
          </button>
          <button
            type="button"
            onClick={saveJourney}
            disabled={saving || !selected.name.trim()}
            style={{
              display: 'inline-flex', gap: 6, alignItems: 'center', height: 34, padding: '0 14px',
              border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)',
              color: 'var(--fg-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              opacity: saving || !selected.name.trim() ? 0.5 : 1,
            }}
          >
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            Salvar rascunho
          </button>
          <button
            type="button"
            onClick={publishJourney}
            disabled={saving || !selected.name.trim()}
            style={{
              display: 'inline-flex', gap: 6, alignItems: 'center', height: 34, padding: '0 18px',
              border: 'none', borderRadius: 999, background: 'var(--accent)',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              opacity: saving || !selected.name.trim() ? 0.6 : 1,
              boxShadow: '0 2px 8px rgba(69,108,236,0.35)',
            }}
          >
            <Check size={13} />
            Publicar
          </button>
        </div>
      </header>

      {/* ── EDITOR BODY: toolbar + canvas ──────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Horizontal blocks toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
          borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)',
          flexShrink: 0, overflowX: 'auto',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 900, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.07em', flexShrink: 0, marginRight: 6 }}>
            <Workflow size={13} />
            Blocos
          </span>
          <span style={{ width: 1, height: 18, background: 'var(--border)', flexShrink: 0, marginRight: 2 }} />
          {BLOCKS.filter(block => block.type !== 'trigger').map(block => {
            const Icon = block.icon;
            return (
              <div
                key={block.type}
                draggable
                onDragStart={event => event.dataTransfer.setData('application/x-automation-node', block.type)}
                title={block.description}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 11px 5px 7px', borderRadius: 8, flexShrink: 0,
                  border: '1px solid var(--border)', background: 'var(--bg-surface)',
                  cursor: 'grab', userSelect: 'none',
                }}
              >
                <span style={{ width: 24, height: 24, borderRadius: 6, display: 'grid', placeItems: 'center', background: `${block.color}18`, color: block.color, flexShrink: 0 }}>
                  <Icon size={13} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-primary)', whiteSpace: 'nowrap' }}>{block.label}</span>
              </div>
            );
          })}
        </div>

        {/* Canvas + panel wrapper */}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>

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
                onDoubleClick={event => { event.stopPropagation(); setModalNodeId(node.id); }}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: NODE_W,
                  minHeight: NODE_H,
                  border: `1.5px solid ${active || connecting ? meta.color : nodeSubtitle(node).warn ? '#F59E0B' : 'var(--border)'}`,
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
                  <span style={{ position: 'relative', width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', background: `${meta.color}22`, color: meta.color, flexShrink: 0 }}>
                    <Icon size={16} />
                    {nodeSubtitle(node).warn && (
                      <span style={{
                        position: 'absolute', top: -3, right: -3,
                        width: 10, height: 10, borderRadius: 999,
                        background: '#F59E0B', border: '2px solid var(--bg-surface)',
                      }} />
                    )}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', color: 'var(--fg-primary)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.label}</strong>
                    {(() => { const sub = nodeSubtitle(node); return (
                      <span style={{ display: 'block', color: sub.warn ? '#F59E0B' : 'var(--fg-muted)', fontSize: 11, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sub.text}
                      </span>
                    ); })()}
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

        {/* ── CONFIG MODAL (portal, centralizado) ─────────────────────────────── */}
        {(() => {
          if (!modalNodeId || !panelValues) return null;
          const panelNode = selected.nodes.find(n => n.id === modalNodeId);
          if (!panelNode) return null;
          const meta = blockMeta(panelNode.type);
          const Icon = meta.icon;
          return createPortal(
            <>
              {/* Backdrop */}
              <div
                onClick={() => setModalNodeId(null)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 1000,
                  background: 'rgba(0,0,0,0.45)',
                  backdropFilter: 'blur(2px)',
                }}
              />
              {/* Modal */}
              <div
                style={{
                  position: 'fixed', zIndex: 1001,
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 480, maxHeight: '82vh',
                  borderRadius: 16,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
                  display: 'flex', flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Modal header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{
                      width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center',
                      background: `${meta.color}18`, color: meta.color, flexShrink: 0,
                      border: `1px solid ${meta.color}30`,
                    }}>
                      <Icon size={22} />
                    </span>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--fg-primary)' }}>{meta.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>{meta.description}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalNodeId(null)}
                    style={{
                      border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-muted)',
                      cursor: 'pointer', display: 'grid', placeItems: 'center',
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Modal form */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

                  {/* ── TRIGGER ── */}
                  {panelNode.type === 'trigger' && (() => {
                    const triggerOptions = [
                      { value: 'lead_created',    icon: UserPlus,   label: 'Lead entrou na base',     description: 'Qualquer novo lead cadastrado na base',      subField: null },
                      { value: 'conversion',      icon: Zap,        label: 'Conversão específica',    description: 'Lead chegou por um webhook específico',       subField: 'webhook' },
                      { value: 'tag_added',       icon: Tags,       label: 'Tag aplicada',            description: 'Uma tag foi adicionada ao lead',             subField: 'tag' },
                      { value: 'score_reached',   icon: TrendingUp, label: 'Score atingiu limite',    description: 'Score chegou a um valor mínimo definido',    subField: 'score' },
                      { value: 'status_changed',  icon: ArrowRight, label: 'Etapa mudou',             description: 'Lead mudou para uma etapa específica',       subField: 'status' },
                    ];
                    const selectedEvent = panelValues.config.event || '';
                    const activeOpt = triggerOptions.find(o => o.value === selectedEvent);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <span style={fieldLabelStyle}>Qual é o gatilho?</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          {triggerOptions.map(opt => {
                            const OIcon = opt.icon;
                            const isSelected = selectedEvent === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, event: opt.value, eventValue: '' } } : prev)}
                                style={{
                                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 13px',
                                  border: `1.5px solid ${isSelected ? '#456CEC' : 'var(--border)'}`,
                                  borderRadius: 10,
                                  background: isSelected ? 'rgba(69,108,236,0.07)' : 'var(--bg-surface)',
                                  cursor: 'pointer', textAlign: 'left',
                                  transition: 'border-color .12s, background .12s',
                                }}
                              >
                                <span style={{
                                  width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0,
                                  background: isSelected ? 'rgba(69,108,236,0.14)' : 'var(--bg-subtle)',
                                  color: isSelected ? '#456CEC' : 'var(--fg-muted)',
                                }}>
                                  <OIcon size={14} />
                                </span>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? '#456CEC' : 'var(--fg-primary)', lineHeight: 1.3 }}>{opt.label}</div>
                                  <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3, lineHeight: 1.35 }}>{opt.description}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Sub-field for selected trigger */}
                        {activeOpt?.subField === 'webhook' && (
                          <div style={{ display: 'grid', gap: 7 }}>
                            <span style={fieldLabelStyle}>Qual conversão?</span>
                            <WebhookSourceSelector
                              value={String(panelValues.config.eventValue ?? '')}
                              onChange={v => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, eventValue: v } } : prev)}
                            />
                            <span style={{ fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                              Crie o webhook em Banco de Leads → Webhooks de entrada, faça um disparo teste e ele aparecerá aqui.
                            </span>
                          </div>
                        )}
                        {activeOpt?.subField === 'tag' && (
                          <div style={{ display: 'grid', gap: 7 }}>
                            <span style={fieldLabelStyle}>Qual tag dispara?</span>
                            <TagSelector
                              value={String(panelValues.config.eventValue ?? '')}
                              onChange={v => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, eventValue: v } } : prev)}
                            />
                          </div>
                        )}
                        {activeOpt?.subField === 'status' && (
                          <div style={{ display: 'grid', gap: 7 }}>
                            <span style={fieldLabelStyle}>Qual etapa?</span>
                            <SmartSelect
                              value={String(panelValues.config.eventValue ?? '')}
                              options={LEAD_STATUS_OPTIONS}
                              onChange={v => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, eventValue: v } } : prev)}
                              placeholder="Selecionar etapa..."
                            />
                          </div>
                        )}
                        {activeOpt?.subField === 'score' && (
                          <label style={{ display: 'grid', gap: 7 }}>
                            <span style={fieldLabelStyle}>Score mínimo</span>
                            <input
                              type="number" min={0}
                              value={String(panelValues.config.eventValue ?? '')}
                              onChange={e => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, eventValue: e.target.value } } : prev)}
                              placeholder="ex: 50"
                              style={fieldInputStyle}
                              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-soft)'; }}
                              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── CONDITION ── */}
                  {panelNode.type === 'condition' && (() => {
                    const conditionFieldOptions: SmartSelectOption[] = [
                      { value: 'tag',         label: 'Tag',     description: 'Verifica se o lead tem uma tag' },
                      { value: 'score',       label: 'Score',   description: 'Verifica o score do lead' },
                      { value: 'status',      label: 'Etapa',   description: 'Verifica a etapa atual do lead' },
                      { value: 'jobTitle',    label: 'Cargo',   description: 'Verifica o cargo do lead' },
                      { value: 'companyName', label: 'Empresa', description: 'Verifica o nome da empresa' },
                      { value: 'origin',      label: 'Origem',  description: 'Verifica de onde veio o lead' },
                    ];

                    const operatorsByField: Record<string, SmartSelectOption[]> = {
                      tag:    [{ value: 'has', label: 'possui a tag' }, { value: 'not_has', label: 'não possui a tag' }],
                      score:  [{ value: 'gte', label: 'maior ou igual a' }, { value: 'lte', label: 'menor ou igual a' }, { value: 'eq', label: 'igual a' }],
                      status: [{ value: 'is', label: 'é' }, { value: 'is_not', label: 'não é' }],
                    };
                    const defaultOperators: SmartSelectOption[] = [
                      { value: 'contains',     label: 'contém' },
                      { value: 'equals',       label: 'igual a' },
                      { value: 'not_contains', label: 'não contém' },
                    ];

                    const field = panelValues.config.field ?? '';
                    const operators = operatorsByField[field] ?? defaultOperators;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {panelSelectField('field', 'Campo a verificar', conditionFieldOptions, 'Selecionar campo...')}
                        {field && panelSelectField('operator', 'Condição', operators, 'Selecionar condição...')}
                        {field === 'tag' && panelTagField('value', 'Qual tag?')}
                        {field === 'status' && panelSelectField('value', 'Qual etapa?', LEAD_STATUS_OPTIONS, 'Selecionar etapa...')}
                        {field === 'score' && panelTextField('value', 'Valor do score', 'ex: 50', 'number')}
                        {field && field !== 'tag' && field !== 'status' && field !== 'score' && panelTextField('value', 'Valor esperado', 'ex: CEO, acelerador...')}
                      </div>
                    );
                  })()}

                  {/* ── WAIT ── */}
                  {panelNode.type === 'wait' && (() => {
                    const unitOptions: SmartSelectOption[] = [
                      { value: 'minutes', label: 'Minutos' },
                      { value: 'hours',   label: 'Horas' },
                      { value: 'days',    label: 'Dias' },
                      { value: 'weeks',   label: 'Semanas' },
                    ];
                    const amount = panelValues.config.amount ?? '';
                    const unit = panelValues.config.unit ?? '';
                    const unitLabel = unitOptions.find(u => u.value === unit)?.label?.toLowerCase() ?? unit;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <label style={{ display: 'grid', gap: 7 }}>
                            <span style={fieldLabelStyle}>Quantidade</span>
                            <input
                              type="number" min={1}
                              value={amount}
                              onChange={e => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, amount: e.target.value } } : prev)}
                              placeholder="ex: 2"
                              style={fieldInputStyle}
                              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-soft)'; }}
                              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                            />
                          </label>
                          <div style={{ display: 'grid', gap: 7 }}>
                            <span style={fieldLabelStyle}>Unidade</span>
                            <SmartSelect
                              value={unit}
                              options={unitOptions}
                              onChange={v => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, unit: v } } : prev)}
                              placeholder="Selecionar..."
                            />
                          </div>
                        </div>
                        {amount && unit && (
                          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-subtle)', fontSize: 13, color: 'var(--fg-muted)' }}>
                            Aguarda <strong style={{ color: 'var(--fg-primary)' }}>{amount} {unitLabel}</strong> antes de continuar.
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── INTERNAL ACTION ── */}
                  {panelNode.type === 'internal_action' && (() => {
                    const actionOptions: SmartSelectOption[] = [
                      { value: 'add_tag',    label: 'Adicionar tag',   description: 'Aplica uma tag ao lead' },
                      { value: 'remove_tag', label: 'Remover tag',     description: 'Remove uma tag do lead' },
                      { value: 'set_status', label: 'Mudar etapa',     description: 'Muda a etapa do lead no funil' },
                      { value: 'add_score',  label: 'Adicionar score', description: 'Incrementa o score do lead' },
                      { value: 'set_score',  label: 'Definir score',   description: 'Define um score fixo' },
                    ];
                    const action = panelValues.config.action ?? '';

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {panelSelectField('action', 'Ação a executar', actionOptions, 'Selecionar ação...')}
                        {(action === 'add_tag' || action === 'remove_tag') && panelTagField('value', 'Qual tag?')}
                        {action === 'set_status' && panelSelectField('value', 'Nova etapa', LEAD_STATUS_OPTIONS, 'Selecionar etapa...')}
                        {(action === 'add_score' || action === 'set_score') && panelTextField('value', 'Valor do score', 'ex: 10', 'number')}
                      </div>
                    );
                  })()}

                  {/* ── RD STATION ── */}
                  {panelNode.type === 'rd_conversion' && (() => {
                    // fieldMappings stored as JSON string in config.fieldMappings
                    const mappings: Array<{ ourField: string; rdField: string }> = (() => {
                      try { return JSON.parse(panelValues.config.fieldMappings || '[]'); } catch { return []; }
                    })();
                    const setMappings = (next: Array<{ ourField: string; rdField: string }>) => {
                      setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, fieldMappings: JSON.stringify(next) } } : prev);
                    };
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {panelTextField('conversionIdentifier', 'Identificador da conversão', 'ex: interesse_decisor')}
                        {panelTextField('conversionName', 'Nome da conversão', 'ex: Interesse - Decisor')}

                        <div style={{ display: 'grid', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={fieldLabelStyle}>Campos adicionais</span>
                            <button
                              type="button"
                              onClick={() => setMappings([...mappings, { ourField: '', rdField: '' }])}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                border: '1px solid var(--border)', borderRadius: 6,
                                background: 'var(--bg-subtle)', color: 'var(--fg-primary)',
                                padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              <Plus size={12} /> Adicionar campo
                            </button>
                          </div>

                          {mappings.length === 0 && (
                            <div style={{ fontSize: 12, color: 'var(--fg-muted)', padding: '8px 0' }}>
                              Nenhum campo adicional. Clique em "Adicionar campo" para mapear campos do lead para o RD Station.
                            </div>
                          )}

                          {mappings.map((mapping, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 6, alignItems: 'center' }}>
                              <SmartSelect
                                value={mapping.ourField}
                                options={OUR_LEAD_FIELDS}
                                onChange={v => setMappings(mappings.map((m, j) => j === i ? { ...m, ourField: v } : m))}
                                placeholder="Nosso campo..."
                              />
                              <RDFieldSelector
                                value={mapping.rdField}
                                onChange={v => setMappings(mappings.map((m, j) => j === i ? { ...m, rdField: v } : m))}
                              />
                              <button
                                type="button"
                                onClick={() => setMappings(mappings.filter((_, j) => j !== i))}
                                style={{
                                  width: 32, height: 42, display: 'grid', placeItems: 'center',
                                  border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
                                  background: 'rgba(239,68,68,0.06)', color: '#EF4444', cursor: 'pointer',
                                }}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── WHATSAPP ── */}
                  {panelNode.type === 'whatsapp_message' && (() => {
                    const templateName = panelValues.config.templateName ?? '';
                    const phoneField = panelValues.config.phoneField ?? 'phone';

                    const storedComponents: WhatsAppTemplate['components'] = (() => {
                      try { return JSON.parse(panelValues.config.templateComponents || '[]'); } catch { return []; }
                    })();
                    const vars = extractTemplateVars(storedComponents);

                    const varMappings: Record<string, string> = (() => {
                      try { return JSON.parse(panelValues.config.varMappings || '{}'); } catch { return {}; }
                    })();

                    const setVarMapping = (placeholder: string, leadField: string) => {
                      const next = { ...varMappings, [placeholder]: leadField };
                      setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, varMappings: JSON.stringify(next) } } : prev);
                    };

                    // Body text for preview
                    const bodyComp = storedComponents.find(c => c.type === 'BODY');

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                        {/* Template */}
                        <div style={{ display: 'grid', gap: 7 }}>
                          <span style={fieldLabelStyle}>Template</span>
                          <WhatsAppTemplateSelector
                            value={templateName}
                            onSelect={(name, tpl) => {
                              setPanelValues(prev => prev ? {
                                ...prev,
                                config: {
                                  ...prev.config,
                                  templateName: name,
                                  templateComponents: JSON.stringify(tpl?.components ?? []),
                                  varMappings: '{}',
                                },
                              } : prev);
                            }}
                          />
                          <span style={{ fontSize: 11, color: 'var(--fg-subtle)' }}>Apenas templates com status APPROVED aparecem aqui.</span>
                        </div>

                        {/* Phone field */}
                        <div style={{ display: 'grid', gap: 7 }}>
                          <span style={fieldLabelStyle}>Campo do telefone</span>
                          <SmartSelect
                            value={phoneField}
                            options={OUR_LEAD_FIELDS.filter(f => f.value === 'phone' || f.value === 'name' || f.value === 'email')}
                            onChange={v => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, phoneField: v } } : prev)}
                            placeholder="Selecionar campo..."
                          />
                        </div>

                        {/* Variable mapping */}
                        {vars.length > 0 && (
                          <div style={{ display: 'grid', gap: 10 }}>
                            <span style={fieldLabelStyle}>Variáveis do template</span>
                            {vars.map(placeholder => (
                              <div key={placeholder} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 8, alignItems: 'center' }}>
                                <div style={{
                                  height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                                  borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#10B981', fontFamily: 'monospace',
                                }}>
                                  {placeholder}
                                </div>
                                <SmartSelect
                                  value={varMappings[placeholder] ?? ''}
                                  options={OUR_LEAD_FIELDS}
                                  onChange={v => setVarMapping(placeholder, v)}
                                  placeholder="Campo do lead..."
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Body preview */}
                        {bodyComp?.text && (
                          <div style={{ borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border)', padding: '10px 14px' }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Prévia do corpo</div>
                            <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{bodyComp.text}</div>
                          </div>
                        )}

                      </div>
                    );
                  })()}

                  {/* ── PIPEDRIVE ── */}
                  {panelNode.type === 'pipedrive_action' && (() => {
                    const pipedriveActions: SmartSelectOption[] = [
                      { value: 'create_deal',  label: 'Criar negócio',       description: 'Abre um novo negócio no Pipedrive' },
                      { value: 'update_stage', label: 'Mudar estágio',       description: 'Move o negócio para outro estágio' },
                      { value: 'mark_won',     label: 'Marcar como ganho',   description: 'Fecha o negócio como ganho' },
                      { value: 'mark_lost',    label: 'Marcar como perdido', description: 'Fecha o negócio como perdido' },
                    ];
                    const pipelineOptions: SmartSelectOption[] = [
                      { value: 'novo_cliente', label: 'Novo Cliente',  description: 'Pipeline de aquisição' },
                      { value: 'upsell',       label: 'Upsell',        description: 'Pipeline de expansão' },
                    ];
                    const action   = panelValues.config.action   ?? '';
                    const stageId  = panelValues.config.stageId  ?? '';
                    const pipeline = panelValues.config.pipeline ?? '';

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Ação */}
                        {panelSelectField('action', 'Ação no Pipedrive', pipedriveActions, 'Selecionar ação...')}

                        {/* create_deal */}
                        {action === 'create_deal' && <>
                          <div style={{ display: 'grid', gap: 7 }}>
                            <span style={fieldLabelStyle}>Pipeline</span>
                            <SmartSelect
                              value={pipeline}
                              options={pipelineOptions}
                              onChange={v => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, pipeline: v } } : prev)}
                              placeholder="Selecionar pipeline..."
                            />
                          </div>
                          {panelSelectField('titleField', 'Título do negócio', OUR_LEAD_FIELDS, 'Selecionar campo...')}
                          <div style={{ display: 'grid', gap: 7 }}>
                            <span style={fieldLabelStyle}>Nota (opcional)</span>
                            <TemplateTextarea
                              value={panelValues?.config.noteTemplate ?? ''}
                              onChange={v => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, noteTemplate: v } } : prev)}
                              placeholder="ex: Lead veio pelo {campanha} com score {score}..."
                            />
                          </div>
                        </>}

                        {/* update_stage */}
                        {action === 'update_stage' && (
                          <div style={{ display: 'grid', gap: 7 }}>
                            <span style={fieldLabelStyle}>Estágio de destino</span>
                            <PipedriveStageSelector
                              value={stageId}
                              onChange={v => setPanelValues(prev => prev ? { ...prev, config: { ...prev.config, stageId: v } } : prev)}
                            />
                          </div>
                        )}

                        {/* mark_lost */}
                        {action === 'mark_lost' && panelTextField('lostReason', 'Motivo da perda (opcional)', 'ex: Sem budget, Concorrente...')}

                        {/* mark_won: no extra fields needed */}
                        {action === 'mark_won' && (
                          <div style={{ fontSize: 12, color: 'var(--fg-muted)', background: 'var(--bg-subtle)', borderRadius: 8, padding: '10px 12px' }}>
                            Fecha o negócio do lead como <strong style={{ color: 'var(--green-700)' }}>Ganho</strong> no Pipedrive. O lead precisa ter um negócio vinculado.
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── END ── */}
                  {panelNode.type === 'end' && panelTextField('reason', 'Motivo de encerramento', 'ex: mql_created, opted_out...')}
                </div>

                {/* Modal footer */}
                <div style={{
                  display: 'flex', gap: 10, padding: '16px 24px',
                  borderTop: '1px solid var(--border)', flexShrink: 0,
                  background: 'var(--bg-muted)',
                }}>
                  <button
                    type="button"
                    onClick={savePanel}
                    style={{
                      flex: 1, display: 'inline-flex', gap: 7, alignItems: 'center', justifyContent: 'center',
                      height: 42, border: 'none', borderRadius: 10,
                      background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(69,108,236,0.3)',
                    }}
                  >
                    <Check size={15} />
                    Salvar alterações
                  </button>
                  {panelNode.type !== 'trigger' && (
                    <button
                      type="button"
                      onClick={() => { removeNode(panelNode.id); setModalNodeId(null); }}
                      style={{
                        width: 42, height: 42, display: 'grid', placeItems: 'center',
                        border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
                        background: 'rgba(239,68,68,0.06)', color: '#EF4444', cursor: 'pointer',
                      }}
                      title="Remover bloco"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </>,
            document.body
          );
        })()}

        </div>{/* end canvas+panel wrapper */}
      </div>
    </div>
  );
};

export default AutomationJourneysView;
