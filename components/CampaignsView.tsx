import React from 'react';
import { Megaphone, TrendingUp, Target } from 'lucide-react';

type CampaignItem = {
  id: string;
  name: string;
  status: 'Ativa' | 'Pausada' | 'Em Revisao';
  budget: string;
  start: string;
  end: string;
  kpi: string;
};

const metaCampaigns: CampaignItem[] = [
  {
    id: 'meta-1',
    name: 'Feirao SUVs',
    status: 'Ativa',
    budget: 'R$ 4.500',
    start: '2026-02-01',
    end: '2026-02-20',
    kpi: 'CTR 2.8%',
  },
  {
    id: 'meta-2',
    name: 'Lookalike Leads',
    status: 'Em Revisao',
    budget: 'R$ 2.000',
    start: '2026-02-05',
    end: '2026-02-25',
    kpi: 'CPL R$ 38',
  },
];

const googleCampaigns: CampaignItem[] = [
  {
    id: 'google-1',
    name: 'Search AutoForce',
    status: 'Ativa',
    budget: 'R$ 6.200',
    start: '2026-02-01',
    end: '2026-02-28',
    kpi: 'CPC R$ 3.10',
  },
  {
    id: 'google-2',
    name: 'Display Remarketing',
    status: 'Pausada',
    budget: 'R$ 1.500',
    start: '2026-01-20',
    end: '2026-02-10',
    kpi: 'CPA R$ 120',
  },
];

const statusStyles: Record<CampaignItem['status'], string> = {
  Ativa: 'bg-green-900 text-green-300',
  Pausada: 'bg-yellow-900 text-yellow-300',
  'Em Revisao': 'bg-blue-900 text-blue-300',
};

const CampaignsView: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Megaphone className="text-autoforce-blue" />
            Campanhas Ativas
          </h2>
          <p className="text-autoforce-lightGrey text-sm">
            Monitoramento rapido das campanhas em Meta Ads e Google Ads.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-autoforce-lightGrey">
          <div className="flex items-center gap-2 bg-autoforce-darkest border border-autoforce-grey/30 px-3 py-2 rounded">
            <Target size={14} className="text-autoforce-accent" />
            <span>Foco: Leads Qualificados</span>
          </div>
          <div className="flex items-center gap-2 bg-autoforce-darkest border border-autoforce-grey/30 px-3 py-2 rounded">
            <TrendingUp size={14} className="text-green-400" />
            <span>Relatorio semanal</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <Megaphone size={18} className="text-autoforce-blue" />
            Meta Ads
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-autoforce-lightGrey">
              <thead className="text-xs text-autoforce-grey uppercase bg-autoforce-black/50">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Campanha</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Budget</th>
                  <th className="px-4 py-3 rounded-r-lg">KPI</th>
                </tr>
              </thead>
              <tbody>
                {metaCampaigns.map((item) => (
                  <tr key={item.id} className="border-b border-autoforce-grey/10 hover:bg-autoforce-blue/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${statusStyles[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.budget}</td>
                    <td className="px-4 py-3 text-white font-semibold">{item.kpi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-autoforce-grey mt-3">
            Periodo ativo baseado em data de inicio/fim do briefing.
          </p>
        </div>

        <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <Megaphone size={18} className="text-autoforce-accent" />
            Google Ads
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-autoforce-lightGrey">
              <thead className="text-xs text-autoforce-grey uppercase bg-autoforce-black/50">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Campanha</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Budget</th>
                  <th className="px-4 py-3 rounded-r-lg">KPI</th>
                </tr>
              </thead>
              <tbody>
                {googleCampaigns.map((item) => (
                  <tr key={item.id} className="border-b border-autoforce-grey/10 hover:bg-autoforce-blue/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${statusStyles[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.budget}</td>
                    <td className="px-4 py-3 text-white font-semibold">{item.kpi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-autoforce-grey mt-3">
            Ajuste os KPIs direto com o time de midia.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CampaignsView;
