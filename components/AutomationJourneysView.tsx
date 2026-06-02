import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  GitBranch,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Route,
  Tags,
  Workflow,
  Zap,
} from 'lucide-react';
import { DataService } from '../services/dataService';
import { LeadClassificationRule, LeadRuleAction } from '../types';

const JOURNEY_STAGES = [
  {
    title: 'Entrada do lead',
    description: 'Webhooks, formularios e conversoes criam ou atualizam o perfil central.',
    icon: Database,
    color: '#456CEC',
  },
  {
    title: 'Classificacao',
    description: 'Regras aplicam persona, dor, score, tags e campos internos.',
    icon: Tags,
    color: '#22C55E',
  },
  {
    title: 'Nutricao',
    description: 'RD Station envia e-mails e o WhatsApp entra nos pontos certos da cadencia.',
    icon: Mail,
    color: '#F59E0B',
  },
  {
    title: 'Comercial',
    description: 'Quando vira MQL/SQL, o sistema acompanha Pipedrive, proposta, ganho e perdido.',
    icon: GitBranch,
    color: '#8B5CF6',
  },
];

const JOURNEY_BLUEPRINT = [
  {
    step: '1',
    title: 'Lead capturado',
    details: 'Recebe origem, campanha, formulario, campos preenchidos e consentimentos.',
    owner: 'Banco de Leads',
  },
  {
    step: '2',
    title: 'Regra base roda',
    details: 'Define tags como decisor, segmento, dor inicial, cargo e temperatura.',
    owner: 'Regras',
  },
  {
    step: '3',
    title: 'Conversao no RD',
    details: 'Cria evento de entrada no fluxo de e-mail correto: interesse_decisor, diagnostico_site etc.',
    owner: 'RD Station',
  },
  {
    step: '4',
    title: 'WhatsApp intercalado',
    details: 'Agenda mensagens com template aprovado e respeita pausa, resposta e descadastro.',
    owner: 'WhatsApp',
  },
  {
    step: '5',
    title: 'Dor confirmada',
    details: 'Novo formulario ou diagnostico atualiza o lead e dispara a proxima jornada.',
    owner: 'Automacao',
  },
  {
    step: '6',
    title: 'MQL / SQL',
    details: 'Quando atinge criterio comercial, cria ou atualiza negocio no Pipedrive.',
    owner: 'Pipedrive',
  },
];

const ROADMAP = [
  { title: 'Eventos do lead', description: 'Historico unico de entrada, tag, conversao RD, WhatsApp, MQL e Pipedrive.', status: 'Planejado' },
  { title: 'Fila de acoes', description: 'Executar acoes externas com retry, logs e status por lead.', status: 'Planejado' },
  { title: 'WhatsApp Cloud API', description: 'Conectar templates, numero oficial, opt-in e logs de envio/resposta.', status: 'Pendente' },
  { title: 'Builder de jornadas', description: 'Criar blocos de espera, condicoes, ramificacoes e saidas.', status: 'Pendente' },
];

const actionLabels: Record<LeadRuleAction['type'], string> = {
  add_tag: 'Adicionar tag',
  remove_tag: 'Remover tag',
  add_score: 'Somar score',
  set_custom_field: 'Atualizar campo',
  set_status: 'Mudar etapa',
  set_persona: 'Definir persona',
  set_pain: 'Definir dor',
  move_funnel_stage: 'Mover funil',
  rd_create_conversion: 'Conversao RD',
  pipedrive_create_deal: 'Criar negocio',
};

const badgeStyle = (tone: 'success' | 'warning' | 'muted' | 'accent'): React.CSSProperties => {
  const palette = {
    success: { bg: 'rgba(34,197,94,.12)', fg: 'var(--success)' },
    warning: { bg: 'rgba(234,179,8,.12)', fg: 'var(--warning)' },
    muted: { bg: 'var(--bg-soft)', fg: 'var(--fg-muted)' },
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)' },
  }[tone];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 9px',
    borderRadius: 999,
    background: palette.bg,
    color: palette.fg,
    fontSize: 12,
    fontWeight: 800,
  };
};

const AutomationJourneysView: React.FC = () => {
  const [rules, setRules] = useState<LeadClassificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRules = async () => {
    setLoading(true);
    setError('');
    try {
      setRules(await DataService.listLeadRules());
    } catch (err) {
      console.error('Erro ao carregar regras de automacao:', err);
      setError('Nao foi possivel carregar as regras existentes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const stats = useMemo(() => {
    const active = rules.filter(rule => rule.isActive).length;
    const externalActions = rules.reduce((sum, rule) => (
      sum + rule.actions.filter(action => action.type === 'rd_create_conversion' || action.type === 'pipedrive_create_deal').length
    ), 0);
    const executions = rules.reduce((sum, rule) => sum + (rule.runCount || rule._count?.executions || 0), 0);

    return { active, externalActions, executions };
  }, [rules]);

  const card: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    background: 'var(--bg-card)',
    boxShadow: 'var(--shadow-sm)',
  };

  return (
    <div style={{ padding: '24px 28px 64px', maxWidth: 1480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-fade-in-up">
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={badgeStyle('accent')}>
            <Workflow size={14} />
            Automacao central
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--fg-primary)', margin: '12px 0 4px' }}>
            Automacao/Jornadas
          </h1>
          <p style={{ fontSize: 14, color: 'var(--fg-muted)', margin: 0, maxWidth: 760 }}>
            Planeje a jornada completa do lead: entrada, classificacao, nutricao por RD, WhatsApp intercalado e passagem para o Pipedrive.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={loadRules}
            disabled={loading}
            className="ds-btn secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            type="button"
            className="ds-btn primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: .75, cursor: 'not-allowed' }}
            title="O builder visual entra na proxima etapa tecnica."
          >
            <Plus size={14} />
            Nova jornada
          </button>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {[
          { label: 'Regras ativas', value: stats.active, icon: CheckCircle2, tone: '#22C55E' },
          { label: 'Execucoes registradas', value: stats.executions, icon: Zap, tone: '#456CEC' },
          { label: 'Acoes externas', value: stats.externalActions, icon: ArrowRight, tone: '#8B5CF6' },
          { label: 'Jornadas modeladas', value: 1, icon: Route, tone: '#F59E0B' },
        ].map(item => {
          const Icon = item.icon;
          return (
            <article key={item.label} style={{ ...card, padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 900 }}>{item.label}</p>
                <strong style={{ display: 'block', marginTop: 10, color: 'var(--fg-primary)', fontSize: 28, lineHeight: 1 }}>{item.value}</strong>
              </div>
              <span style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${item.tone}20`, color: item.tone }}>
                <Icon size={20} />
              </span>
            </article>
          );
        })}
      </section>

      <section style={{ ...card, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--fg-primary)', fontSize: 18, fontWeight: 800 }}>Estrutura da jornada</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: 13 }}>A tela passa a ser o centro das automacoes, separando regras internas e acoes externas.</p>
          </div>
          <span style={badgeStyle('warning')}>
            <Clock size={13} />
            Builder visual em preparacao
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {JOURNEY_STAGES.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <div key={stage.title} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--bg-elevated)', padding: 16, minHeight: 142 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: `${stage.color}20`, color: stage.color }}>
                    <Icon size={17} />
                  </span>
                  <span style={{ color: 'var(--fg-muted)', fontSize: 12, fontWeight: 800 }}>0{index + 1}</span>
                </div>
                <h3 style={{ margin: 0, color: 'var(--fg-primary)', fontSize: 15, fontWeight: 800 }}>{stage.title}</h3>
                <p style={{ margin: '8px 0 0', color: 'var(--fg-muted)', fontSize: 13, lineHeight: 1.5 }}>{stage.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, .65fr)', gap: 16, alignItems: 'start' }}>
        <section style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, color: 'var(--fg-primary)', fontSize: 17, fontWeight: 800 }}>Plano operacional</h2>
              <p style={{ margin: '3px 0 0', color: 'var(--fg-muted)', fontSize: 13 }}>Como a automacao deve se comunicar com e-mail, WhatsApp e CRM.</p>
            </div>
          </div>
          <div style={{ display: 'grid' }}>
            {JOURNEY_BLUEPRINT.map((item, index) => (
              <div key={item.step} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 130px', gap: 14, padding: '16px 18px', borderBottom: index === JOURNEY_BLUEPRINT.length - 1 ? 'none' : '1px solid var(--border)' }}>
                <span style={{ width: 30, height: 30, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 900 }}>{item.step}</span>
                <div>
                  <strong style={{ color: 'var(--fg-primary)', fontSize: 14 }}>{item.title}</strong>
                  <p style={{ margin: '5px 0 0', color: 'var(--fg-muted)', fontSize: 13, lineHeight: 1.5 }}>{item.details}</p>
                </div>
                <span style={{ ...badgeStyle('muted'), justifyContent: 'center', alignSelf: 'start' }}>{item.owner}</span>
              </div>
            ))}
          </div>
        </section>

        <aside style={{ ...card, padding: 18 }}>
          <h2 style={{ margin: 0, color: 'var(--fg-primary)', fontSize: 17, fontWeight: 800 }}>Proxima evolucao tecnica</h2>
          <p style={{ margin: '5px 0 16px', color: 'var(--fg-muted)', fontSize: 13, lineHeight: 1.5 }}>
            Antes de criar jornadas complexas, precisamos registrar eventos e uma fila confiavel de execucao.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ROADMAP.map((item, index) => (
              <div key={item.title} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 12, background: index < 2 ? 'var(--accent-soft)' : 'var(--bg-elevated)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <strong style={{ color: 'var(--fg-primary)', fontSize: 13 }}>{item.title}</strong>
                  <span style={badgeStyle(index < 2 ? 'accent' : 'muted')}>{item.status}</span>
                </div>
                <p style={{ margin: '7px 0 0', color: 'var(--fg-muted)', fontSize: 12, lineHeight: 1.45 }}>{item.description}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--fg-primary)', fontSize: 17, fontWeight: 800 }}>Regras de classificacao existentes</h2>
            <p style={{ margin: '3px 0 0', color: 'var(--fg-muted)', fontSize: 13 }}>Regras criadas na base de leads agora ficam visiveis dentro da area de automacao.</p>
          </div>
          {error && (
            <span style={badgeStyle('warning')}>
              <AlertTriangle size={13} />
              {error}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 28, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <RefreshCw size={16} className="animate-spin" />
            Carregando regras...
          </div>
        ) : rules.length === 0 ? (
          <div style={{ padding: 28, color: 'var(--fg-muted)' }}>
            Nenhuma regra criada ainda. A primeira etapa sera criar regras base para persona, dor, score e entrada no RD.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ color: 'var(--fg-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: .8, textAlign: 'left' }}>
                  <th style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>Regra</th>
                  <th style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>Gatilho</th>
                  <th style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>Acoes</th>
                  <th style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>Execucoes</th>
                  <th style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(rule => (
                  <tr key={rule.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <strong style={{ color: 'var(--fg-primary)', fontSize: 14 }}>{rule.name}</strong>
                      {rule.description && <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: 12 }}>{rule.description}</p>}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--fg-muted)', fontSize: 13 }}>{rule.trigger || 'manual'}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {rule.actions.slice(0, 3).map((action, index) => (
                          <span key={`${rule.id}-${action.type}-${index}`} style={badgeStyle(action.type === 'rd_create_conversion' || action.type === 'pipedrive_create_deal' ? 'accent' : 'muted')}>
                            {actionLabels[action.type] || action.type}
                          </span>
                        ))}
                        {rule.actions.length > 3 && <span style={badgeStyle('muted')}>+{rule.actions.length - 3}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--fg-primary)', fontWeight: 800 }}>{rule.runCount || rule._count?.executions || 0}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={badgeStyle(rule.isActive ? 'success' : 'muted')}>{rule.isActive ? 'Ativa' : 'Pausada'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ ...card, padding: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'rgba(34,197,94,.12)', color: 'var(--success)' }}>
          <MessageCircle size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h2 style={{ margin: 0, color: 'var(--fg-primary)', fontSize: 16, fontWeight: 800 }}>WhatsApp entra como acao externa da jornada</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: 13, lineHeight: 1.5 }}>
            A regra decide quem entra na jornada. A jornada decide quando mandar e-mail, quando mandar WhatsApp, quando esperar resposta e quando enviar para o comercial.
          </p>
        </div>
      </section>
    </div>
  );
};

export default AutomationJourneysView;
