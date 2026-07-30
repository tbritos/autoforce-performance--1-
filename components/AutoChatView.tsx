import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CircleDashed,
  Instagram,
  MessageCircle,
  PlugZap,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';

type AutoChatTab = 'flows' | 'conversations' | 'contacts' | 'metrics' | 'integration';

const TABS: Array<{
  id: AutoChatTab;
  label: string;
  icon: React.ElementType;
}> = [
  { id: 'flows', label: 'Fluxos', icon: Workflow },
  { id: 'conversations', label: 'Conversas', icon: MessageCircle },
  { id: 'contacts', label: 'Contatos', icon: Users },
  { id: 'metrics', label: 'Métricas', icon: BarChart3 },
  { id: 'integration', label: 'Integração', icon: PlugZap },
];

const FLOW_TEMPLATES = [
  {
    title: 'Comentário para DM',
    description: 'Quando alguém comentar em um post ou Reel, iniciar uma conversa no direct.',
    label: 'Planejado para o MVP',
    color: '#8b5cf6',
  },
  {
    title: 'Palavra-chave na DM',
    description: 'Responder e direcionar o fluxo conforme a palavra enviada pela pessoa.',
    label: 'Planejado para o MVP',
    color: '#2563eb',
  },
  {
    title: 'Resposta ao Story',
    description: 'Continuar automaticamente a conversa iniciada por uma resposta ao Story.',
    label: 'Planejado para o MVP',
    color: '#0ea5e9',
  },
  {
    title: 'Boas-vindas a seguidores',
    description: 'Enviar uma primeira mensagem quando uma nova pessoa seguir o perfil.',
    label: 'Beta controlada pela Meta',
    color: '#ec4899',
  },
];

function EmptySection({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="autochat-empty">
      <div className="autochat-empty-icon"><Icon size={23} /></div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export default function AutoChatView() {
  const [activeTab, setActiveTab] = useState<AutoChatTab>('flows');

  const openIntegration = () => setActiveTab('integration');

  return (
    <div className="autochat-page" data-testid="autochat-view">
      <style>{`
        .autochat-page {
          min-height: calc(100vh - 56px);
          padding: 24px;
          color: var(--fg-primary);
          background:
            radial-gradient(circle at 92% 2%, rgba(236, 72, 153, 0.08), transparent 24rem),
            var(--bg-app);
        }
        .autochat-shell { max-width: 1440px; margin: 0 auto; }
        .autochat-header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 20px; margin-bottom: 22px;
        }
        .autochat-title-row { display: flex; align-items: center; gap: 13px; }
        .autochat-logo {
          width: 44px; height: 44px; border-radius: 13px; display: grid; place-items: center;
          color: white; flex-shrink: 0;
          background: linear-gradient(135deg, #7c3aed 0%, #db2777 55%, #f97316 100%);
          box-shadow: 0 10px 26px rgba(219, 39, 119, 0.22);
        }
        .autochat-header h1 { margin: 0; font-size: 25px; line-height: 1.15; font-weight: 800; letter-spacing: -0.025em; }
        .autochat-header p { margin: 5px 0 0; font-size: 13px; color: var(--fg-muted); }
        .autochat-title-line { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
        .autochat-building-badge {
          min-height: 22px; padding: 0 8px; display: inline-flex; align-items: center;
          border: 1px solid rgba(245, 158, 11, .28); border-radius: 999px;
          color: #b45309; background: rgba(245, 158, 11, .1);
          font-size: 10px; font-weight: 800; letter-spacing: .02em; text-transform: uppercase;
        }
        .autochat-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          min-height: 38px; padding: 0 15px; border: 0; border-radius: 9px; cursor: pointer;
          color: white; background: var(--af-500); font-size: 13px; font-weight: 700;
          box-shadow: 0 6px 16px rgba(69, 108, 236, 0.2);
          transition: transform .15s ease, filter .15s ease;
        }
        .autochat-primary:hover { transform: translateY(-1px); filter: brightness(1.05); }
        .autochat-tabs {
          display: flex; gap: 4px; padding: 4px; margin-bottom: 16px; overflow-x: auto;
          border: 1px solid var(--border); border-radius: 11px; background: var(--bg-surface);
          width: fit-content; max-width: 100%;
        }
        .autochat-building-notice {
          display: flex; align-items: flex-start; gap: 11px; padding: 13px 15px; margin-bottom: 16px;
          border: 1px solid rgba(245, 158, 11, .28); border-radius: 11px;
          color: var(--fg-primary); background: rgba(245, 158, 11, .08);
        }
        .autochat-building-notice svg { flex-shrink: 0; margin-top: 1px; color: #d97706; }
        .autochat-building-notice strong { display: block; font-size: 12.5px; }
        .autochat-building-notice span {
          display: block; margin-top: 3px; color: var(--fg-muted); font-size: 11.5px; line-height: 1.5;
        }
        .autochat-tab {
          min-height: 34px; padding: 0 12px; display: inline-flex; align-items: center; gap: 7px;
          border: 0; border-radius: 7px; white-space: nowrap; cursor: pointer;
          color: var(--fg-muted); background: transparent; font-size: 12.5px; font-weight: 650;
        }
        .autochat-tab.active {
          color: var(--fg-primary); background: var(--bg-elevated);
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.1);
        }
        .autochat-connect-card {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 16px 18px; margin-bottom: 16px; border: 1px solid rgba(236, 72, 153, 0.24);
          border-radius: 13px; background: linear-gradient(110deg, rgba(236,72,153,.08), rgba(124,58,237,.05));
        }
        .autochat-connect-copy { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .autochat-status-icon {
          width: 34px; height: 34px; display: grid; place-items: center; flex-shrink: 0;
          border-radius: 10px; color: #db2777; background: rgba(236,72,153,.12);
        }
        .autochat-connect-copy strong { display: block; font-size: 13.5px; }
        .autochat-connect-copy span { display: block; margin-top: 3px; color: var(--fg-muted); font-size: 12px; line-height: 1.4; }
        .autochat-link-button {
          border: 0; padding: 7px 2px; display: inline-flex; gap: 6px; align-items: center;
          color: var(--af-400); background: transparent; cursor: pointer; white-space: nowrap;
          font-size: 12.5px; font-weight: 750;
        }
        .autochat-metrics {
          display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px;
        }
        .autochat-metric {
          padding: 15px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-surface);
        }
        .autochat-metric span { display: block; color: var(--fg-muted); font-size: 11.5px; }
        .autochat-metric strong { display: block; margin-top: 8px; font-size: 22px; line-height: 1; }
        .autochat-metric small { display: block; margin-top: 7px; color: var(--fg-subtle); font-size: 10.5px; }
        .autochat-panel {
          border: 1px solid var(--border); border-radius: 13px; background: var(--bg-surface); overflow: hidden;
        }
        .autochat-panel-heading {
          padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
          border-bottom: 1px solid var(--border);
        }
        .autochat-panel-heading h2 { margin: 0; font-size: 14px; font-weight: 800; }
        .autochat-panel-heading p { margin: 4px 0 0; color: var(--fg-muted); font-size: 11.5px; }
        .autochat-template-grid {
          display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0;
        }
        .autochat-template {
          min-height: 176px; padding: 18px; border-right: 1px solid var(--border);
          background: transparent;
        }
        .autochat-template:last-child { border-right: 0; }
        .autochat-template-mark { width: 30px; height: 4px; border-radius: 999px; margin-bottom: 18px; }
        .autochat-template h3 { margin: 0; font-size: 13.5px; font-weight: 800; }
        .autochat-template p { margin: 8px 0 15px; color: var(--fg-muted); font-size: 11.5px; line-height: 1.55; }
        .autochat-badge {
          display: inline-flex; align-items: center; min-height: 22px; padding: 0 8px;
          border-radius: 999px; color: var(--fg-muted); background: var(--bg-elevated);
          border: 1px solid var(--border); font-size: 10px; font-weight: 700;
        }
        .autochat-empty {
          min-height: 390px; padding: 56px 24px; display: flex; flex-direction: column;
          align-items: center; justify-content: center; text-align: center;
          border: 1px solid var(--border); border-radius: 13px; background: var(--bg-surface);
        }
        .autochat-empty-icon {
          width: 48px; height: 48px; margin-bottom: 16px; display: grid; place-items: center;
          border-radius: 14px; color: var(--af-400); background: rgba(69,108,236,.1);
        }
        .autochat-empty h2 { margin: 0; font-size: 16px; font-weight: 800; }
        .autochat-empty p { max-width: 470px; margin: 8px 0 18px; color: var(--fg-muted); font-size: 12.5px; line-height: 1.6; }
        .autochat-integration-grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 16px; }
        .autochat-integration-card {
          padding: 22px; border: 1px solid var(--border); border-radius: 13px; background: var(--bg-surface);
        }
        .autochat-integration-card h2 { margin: 0; font-size: 15px; font-weight: 800; }
        .autochat-integration-card > p { margin: 7px 0 20px; color: var(--fg-muted); font-size: 12px; line-height: 1.55; }
        .autochat-step { display: flex; align-items: flex-start; gap: 10px; margin-top: 14px; }
        .autochat-step-index {
          width: 24px; height: 24px; display: grid; place-items: center; flex-shrink: 0;
          border-radius: 7px; color: var(--af-400); background: rgba(69,108,236,.1); font-size: 10px; font-weight: 800;
        }
        .autochat-step strong { display: block; font-size: 12px; }
        .autochat-step span { display: block; margin-top: 2px; color: var(--fg-muted); font-size: 11px; line-height: 1.45; }
        .autochat-beta {
          padding: 16px; border-radius: 11px; border: 1px solid rgba(245,158,11,.25); background: rgba(245,158,11,.07);
        }
        .autochat-beta strong { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #d97706; }
        .autochat-beta p { margin: 7px 0 0; color: var(--fg-muted); font-size: 11.5px; line-height: 1.55; }
        .autochat-disabled {
          width: 100%; min-height: 38px; margin-top: 18px; border: 1px solid var(--border);
          border-radius: 9px; color: var(--fg-subtle); background: var(--bg-elevated);
          font-size: 12px; font-weight: 700; cursor: not-allowed;
        }
        @media (max-width: 1050px) {
          .autochat-template-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .autochat-template:nth-child(2) { border-right: 0; }
          .autochat-template:nth-child(-n+2) { border-bottom: 1px solid var(--border); }
        }
        @media (max-width: 780px) {
          .autochat-page { padding: 16px; }
          .autochat-header { align-items: flex-start; flex-direction: column; }
          .autochat-primary { width: 100%; }
          .autochat-connect-card { align-items: flex-start; flex-direction: column; }
          .autochat-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .autochat-integration-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 520px) {
          .autochat-header h1 { font-size: 22px; }
          .autochat-tabs { width: 100%; }
          .autochat-template-grid { grid-template-columns: 1fr; }
          .autochat-template { border-right: 0; border-bottom: 1px solid var(--border); }
          .autochat-template:last-child { border-bottom: 0; }
        }
      `}</style>

      <div className="autochat-shell">
        <header className="autochat-header">
          <div className="autochat-title-row">
            <div className="autochat-logo"><Sparkles size={21} /></div>
            <div>
              <div className="autochat-title-line">
                <h1>AutoChat</h1>
                <span className="autochat-building-badge">Em construção</span>
              </div>
              <p>Automação de conversas e relacionamento nos canais da AutoForce.</p>
            </div>
          </div>
          <button type="button" className="autochat-primary" onClick={openIntegration}>
            <Instagram size={15} /> Conectar Instagram
          </button>
        </header>

        <nav className="autochat-tabs" aria-label="Áreas do AutoChat">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`autochat-tab${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </nav>

        <aside className="autochat-building-notice" aria-label="AutoChat em construção">
          <CircleDashed size={18} />
          <div>
            <strong>Esta área ainda está em construção</strong>
            <span>Você está visualizando uma prévia do AutoChat. Nenhuma automação ou integração desta tela está ativa no momento.</span>
          </div>
        </aside>

        {activeTab !== 'integration' && (
          <section className="autochat-connect-card">
            <div className="autochat-connect-copy">
              <div className="autochat-status-icon"><CircleDashed size={18} /></div>
              <div>
                <strong>Instagram ainda não conectado</strong>
                <span>Conecte uma conta profissional para receber eventos e publicar os primeiros fluxos.</span>
              </div>
            </div>
            <button type="button" className="autochat-link-button" onClick={openIntegration}>
              Ver integração <ArrowRight size={14} />
            </button>
          </section>
        )}

        {activeTab === 'flows' && (
          <>
            <section className="autochat-metrics" aria-label="Resumo do AutoChat">
              {[
                ['Fluxos ativos', '—'],
                ['Conversas hoje', '—'],
                ['Taxa de resposta', '—'],
                ['Leads capturados', '—'],
              ].map(([label, value]) => (
                <article className="autochat-metric" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>Disponível após conectar</small>
                </article>
              ))}
            </section>

            <section className="autochat-panel">
              <div className="autochat-panel-heading">
                <div>
                  <h2>Comece por um modelo</h2>
                  <p>Estruturas previstas para os primeiros fluxos do Instagram.</p>
                </div>
                <span className="autochat-badge">Nenhum fluxo criado</span>
              </div>
              <div className="autochat-template-grid">
                {FLOW_TEMPLATES.map(template => (
                  <article className="autochat-template" key={template.title}>
                    <div className="autochat-template-mark" style={{ background: template.color }} />
                    <h3>{template.title}</h3>
                    <p>{template.description}</p>
                    <span className="autochat-badge">{template.label}</span>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'conversations' && (
          <EmptySection
            icon={MessageCircle}
            title="As conversas aparecerão aqui"
            description="A caixa de entrada vai reunir as DMs recebidas, o histórico dos fluxos e a transferência para atendimento humano."
            action={<button type="button" className="autochat-primary" onClick={openIntegration}>Configurar canal</button>}
          />
        )}

        {activeTab === 'contacts' && (
          <EmptySection
            icon={Users}
            title="Nenhum contato do Instagram"
            description="Perfis que interagirem com os fluxos poderão ser identificados, segmentados e vinculados ao Banco de Leads."
            action={<button type="button" className="autochat-primary" onClick={openIntegration}>Conectar Instagram</button>}
          />
        )}

        {activeTab === 'metrics' && (
          <EmptySection
            icon={BarChart3}
            title="Métricas aguardando dados"
            description="Envios, respostas, cliques, leads e reuniões serão apresentados depois que os primeiros fluxos estiverem publicados."
          />
        )}

        {activeTab === 'integration' && (
          <section className="autochat-integration-grid">
            <article className="autochat-integration-card">
              <h2>Conectar Instagram profissional</h2>
              <p>A integração será feita pelo fluxo oficial da Meta. Nenhuma conta está conectada nesta versão inicial da tela.</p>
              {[
                ['Autorizar a conta', 'Entrar com a Meta e selecionar o perfil profissional correto.'],
                ['Validar permissões', 'Confirmar mensagens, comentários e eventos disponíveis para a conta.'],
                ['Publicar um fluxo', 'Escolher um gatilho compatível e ativar a primeira automação.'],
              ].map(([title, description], index) => (
                <div className="autochat-step" key={title}>
                  <div className="autochat-step-index">{index + 1}</div>
                  <div><strong>{title}</strong><span>{description}</span></div>
                </div>
              ))}
              <button type="button" className="autochat-disabled" disabled>
                Configuração da Meta na próxima etapa
              </button>
            </article>

            <article className="autochat-integration-card">
              <div className="autochat-beta">
                <strong><Zap size={14} /> Novo seguidor → DM</strong>
                <p>
                  Este gatilho depende do Follow to DM, recurso beta cuja disponibilidade é controlada pela Meta.
                  O AutoChat só permitirá ativá-lo quando a conta e a aplicação tiverem acesso oficial.
                </p>
              </div>
              <h2 style={{ marginTop: 22 }}>O que entra primeiro</h2>
              <p>Comentário para DM, palavra-chave, resposta ao Story, caixa de entrada e transferência para humano.</p>
              <span className="autochat-badge">Escopo inicial</span>
            </article>
          </section>
        )}
      </div>
    </div>
  );
}
