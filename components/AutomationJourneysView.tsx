import React from 'react';
import { Database, GitBranch, Mail, MessageCircle, Tags, Workflow } from 'lucide-react';
import { LeadRulesPanel } from './LeadHubView';

const journeyBlocks = [
  {
    title: 'Entrada',
    description: 'Webhooks e formularios atualizam o Banco de Leads.',
    icon: Database,
    color: '#456CEC',
  },
  {
    title: 'Classificacao',
    description: 'Condições aplicam tags, persona, dor, score e etapa.',
    icon: Tags,
    color: '#22C55E',
  },
  {
    title: 'RD Station',
    description: 'Ações externas criam conversoes para entrar nos fluxos de e-mail.',
    icon: Mail,
    color: '#F59E0B',
  },
  {
    title: 'WhatsApp',
    description: 'Sera a proxima acao externa para intercalar mensagens na jornada.',
    icon: MessageCircle,
    color: '#10B981',
  },
  {
    title: 'Pipedrive',
    description: 'Quando virar MQL/SQL, cria ou atualiza o processo comercial.',
    icon: GitBranch,
    color: '#8B5CF6',
  },
];

const AutomationJourneysView: React.FC = () => {
  return (
    <div style={{ padding: '24px 28px 64px', maxWidth: 1480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-fade-in-up">
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            borderRadius: 999,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 800,
          }}>
            <Workflow size={14} />
            Automacao central
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--fg-primary)', margin: '12px 0 4px' }}>
            Automacao/Jornadas
          </h1>
          <p style={{ fontSize: 14, color: 'var(--fg-muted)', margin: 0, maxWidth: 820 }}>
            Crie as regras que classificam leads e disparam ações internas ou externas, como conversao no RD Station e, depois, WhatsApp/Pipedrive.
          </p>
        </div>
      </header>

      <section className="ds-card" style={{ padding: 0, overflow: 'visible' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, color: 'var(--fg-primary)', fontSize: 18, fontWeight: 800 }}>
            Criar e gerenciar automacoes
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: 13 }}>
            Use o botão <strong>Nova regra</strong> para montar condições, ações internas e ações externas. Essa é a parte funcional da jornada hoje.
          </p>
        </div>
        <div style={{ padding: 18 }}>
          <LeadRulesPanel />
        </div>
      </section>

      <section className="ds-card" style={{ padding: 18 }}>
        <h2 style={{ margin: 0, color: 'var(--fg-primary)', fontSize: 17, fontWeight: 800 }}>
          Como essa automacao vira uma jornada completa
        </h2>
        <p style={{ margin: '5px 0 16px', color: 'var(--fg-muted)', fontSize: 13 }}>
          A regra decide quem entra e quais ações rodam. A próxima etapa é adicionar fila, espera entre passos e WhatsApp como ação externa real.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
          {journeyBlocks.map(block => {
            const Icon = block.icon;
            return (
              <article
                key={block.title}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-lg)',
                  background: 'var(--bg-elevated)',
                  padding: 14,
                  minHeight: 118,
                }}
              >
                <span style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  display: 'grid',
                  placeItems: 'center',
                  background: `${block.color}20`,
                  color: block.color,
                  marginBottom: 12,
                }}>
                  <Icon size={17} />
                </span>
                <h3 style={{ margin: 0, color: 'var(--fg-primary)', fontSize: 14, fontWeight: 800 }}>{block.title}</h3>
                <p style={{ margin: '7px 0 0', color: 'var(--fg-muted)', fontSize: 12.5, lineHeight: 1.45 }}>{block.description}</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AutomationJourneysView;
