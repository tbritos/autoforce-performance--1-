import React, { useEffect, useMemo, useState } from 'react';
import { Megaphone, TrendingUp, Target, Calendar } from 'lucide-react';
import { DataService } from '../services/dataService';
import { MetaCampaign } from '../types';

const CampaignsView: React.FC = () => {
  const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [dateRange, setDateRange] = useState('30days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { startDateStr, endDateStr } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    if (dateRange === '7days') start.setDate(end.getDate() - 7);
    if (dateRange === '30days') start.setDate(end.getDate() - 30);
    if (dateRange === '90days') start.setDate(end.getDate() - 90);
    return {
      startDateStr: dateRange === 'custom' ? customStart : start.toISOString().split('T')[0],
      endDateStr: dateRange === 'custom' ? customEnd : end.toISOString().split('T')[0],
    };
  }, [dateRange, customStart, customEnd]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  useEffect(() => {
    if (dateRange === 'custom' && (!customStart || !customEnd)) {
      return;
    }
    const loadMeta = async () => {
      setLoadingMeta(true);
      try {
        const data = await DataService.getMetaCampaigns(startDateStr, endDateStr);
        setMetaCampaigns(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
        setMetaCampaigns([]);
      } finally {
        setLoadingMeta(false);
      }
    };
    loadMeta();
  }, [startDateStr, endDateStr, dateRange, customStart, customEnd]);

  const [platform, setPlatform] = useState<'meta' | 'google'>('meta');
  const [sortKey, setSortKey] = useState<'name' | 'spend' | 'cpc' | 'ctr' | 'reach' | 'impressions' | 'cpm'>('spend');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const googleCampaigns = [
    {
      id: 'google-1',
      name: 'Search AutoForce',
      spend: 0,
      cpc: 0,
      ctr: 0,
      reach: 0,
      impressions: 0,
      cpm: 0,
    },
  ];

  const handleSort = (key: 'name' | 'spend' | 'cpc' | 'ctr' | 'reach' | 'impressions' | 'cpm') => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('desc');
  };

  const sortCampaigns = <T extends { name: string; spend: number; cpc: number; ctr: number; reach: number; impressions: number; cpm: number }>(
    items: T[]
  ) => {
    const sorted = [...items].sort((a, b) => {
      if (sortKey === 'name') {
        const diff = a.name.localeCompare(b.name);
        return sortDirection === 'asc' ? diff : -diff;
      }
      const diff = (a[sortKey] || 0) - (b[sortKey] || 0);
      return sortDirection === 'asc' ? diff : -diff;
    });
    return sorted;
  };
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in-up">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Megaphone className="text-autoforce-blue" />
            Campanhas Ativas
          </h2>
          <p className="text-autoforce-lightGrey text-sm">
            Monitoramento rapido das campanhas em Meta Ads e Google Ads.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-autoforce-lightGrey">
          <div className="flex items-center gap-2 bg-autoforce-darkest border border-autoforce-grey/30 p-1 rounded">
            <button
              type="button"
              onClick={() => setPlatform('meta')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition ${platform === 'meta' ? 'bg-autoforce-blue text-white' : 'text-autoforce-lightGrey hover:text-white'}`}
            >
              Meta Ads
            </button>
            <button
              type="button"
              onClick={() => setPlatform('google')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition ${platform === 'google' ? 'bg-autoforce-blue text-white' : 'text-autoforce-lightGrey hover:text-white'}`}
            >
              Google Ads
            </button>
          </div>
          <div className="flex items-center gap-2 bg-autoforce-darkest border border-autoforce-grey/30 px-3 py-2 rounded">
            <Calendar size={14} className="text-autoforce-blue" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
            >
              <option className="bg-autoforce-darkest text-white" value="7days">Ultimos 7 dias</option>
              <option className="bg-autoforce-darkest text-white" value="30days">Ultimos 30 dias</option>
              <option className="bg-autoforce-darkest text-white" value="90days">Ultimos 90 dias</option>
              <option className="bg-autoforce-darkest text-white" value="custom">Personalizado</option>
            </select>
          </div>
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-autoforce-darkest border border-autoforce-grey/30 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-autoforce-blue"
              />
              <span className="text-autoforce-grey">-</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-autoforce-darkest border border-autoforce-grey/30 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-autoforce-blue"
              />
            </div>
          )}
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

      <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Megaphone size={18} className={platform === 'meta' ? 'text-autoforce-blue' : 'text-autoforce-accent'} />
            {platform === 'meta' ? 'Meta Ads' : 'Google Ads'}
          </h3>
          <span className="text-xs text-autoforce-lightGrey uppercase tracking-wider">
            {platform === 'meta' ? 'Campanhas ativas' : 'Aguardando integracao'}
          </span>
        </div>
        {platform === 'meta' ? (
          loadingMeta ? (
            <div className="py-8 text-center text-sm text-autoforce-lightGrey">Carregando campanhas...</div>
          ) : metaCampaigns.length === 0 ? (
            <div className="py-8 text-center text-sm text-autoforce-lightGrey">Nenhuma campanha retornada.</div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-autoforce-lightGrey">
              <thead className="text-xs text-autoforce-grey uppercase bg-autoforce-black/50">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'name' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      Nome da campanha {sortKey === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('spend')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'spend' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      Investimento {sortKey === 'spend' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('cpc')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'cpc' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      CPC {sortKey === 'cpc' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('ctr')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'ctr' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      CTR {sortKey === 'ctr' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('reach')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'reach' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      Alcance {sortKey === 'reach' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('impressions')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'impressions' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      Impressoes {sortKey === 'impressions' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3 rounded-r-lg">
                    <button
                      type="button"
                      onClick={() => handleSort('cpm')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'cpm' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      CPM {sortKey === 'cpm' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortCampaigns(metaCampaigns).map((item) => (
                  <tr key={item.id} className="border-b border-autoforce-grey/10 hover:bg-autoforce-blue/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                    <td className="px-4 py-3">{formatCurrency(item.spend)}</td>
                    <td className="px-4 py-3">{formatCurrency(item.cpc)}</td>
                    <td className="px-4 py-3 text-white font-semibold">{item.ctr.toFixed(2)}%</td>
                    <td className="px-4 py-3">{item.reach.toLocaleString()}</td>
                    <td className="px-4 py-3">{item.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3">{formatCurrency(item.cpm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-autoforce-lightGrey">
              <thead className="text-xs text-autoforce-grey uppercase bg-autoforce-black/50">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'name' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      Nome da campanha {sortKey === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('spend')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'spend' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      Investimento {sortKey === 'spend' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('cpc')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'cpc' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      CPC {sortKey === 'cpc' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('ctr')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'ctr' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      CTR {sortKey === 'ctr' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('reach')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'reach' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      Alcance {sortKey === 'reach' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('impressions')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'impressions' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      Impressoes {sortKey === 'impressions' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3 rounded-r-lg">
                    <button
                      type="button"
                      onClick={() => handleSort('cpm')}
                      className={`text-left font-bold uppercase tracking-wider ${sortKey === 'cpm' ? 'text-white' : 'text-autoforce-grey'}`}
                    >
                      CPM {sortKey === 'cpm' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortCampaigns(googleCampaigns).map((item) => (
                  <tr key={item.id} className="border-b border-autoforce-grey/10 hover:bg-autoforce-blue/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                    <td className="px-4 py-3">{formatCurrency(item.spend)}</td>
                    <td className="px-4 py-3">{formatCurrency(item.cpc)}</td>
                    <td className="px-4 py-3 text-white font-semibold">{item.ctr.toFixed(2)}%</td>
                    <td className="px-4 py-3">{item.reach.toLocaleString()}</td>
                    <td className="px-4 py-3">{item.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3">{formatCurrency(item.cpm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-autoforce-grey mt-3">
          Periodo ativo baseado no intervalo selecionado.
        </p>
      </div>
    </div>
  );
};

export default CampaignsView;
