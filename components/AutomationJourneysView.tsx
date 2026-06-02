import React from 'react';
import { LeadRulesPanel } from './LeadHubView';

const AutomationJourneysView: React.FC = () => {
  return (
    <div style={{ padding: '24px 28px 64px', maxWidth: 1480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-fade-in-up">
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--fg-primary)', margin: 0 }}>
            Automacao/Jornadas
          </h1>
        </div>
      </header>

      <section className="ds-card" style={{ padding: 0, overflow: 'visible' }}>
        <div style={{ padding: 18 }}>
          <LeadRulesPanel />
        </div>
      </section>
    </div>
  );
};

export default AutomationJourneysView;
