import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Database, Filter, Search, Users } from 'lucide-react';
import { DataService } from '../services/dataService';
import { LeadConversionSummary } from '../types';

const LeadConversionsView: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [conversions, setConversions] = useState<LeadConversionSummary[]>([]);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await DataService.getLeadConversions({
          startDate: dateRange.start,
          endDate: dateRange.end,
        });
        setConversions(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Erro ao carregar conversoes de leads:', error);
        setConversions([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dateRange.end, dateRange.start]);

  const filteredConversions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversions.filter(item => {
      const matchesQuery =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.identifier.toLowerCase().includes(query);
      const matchesSource = sourceFilter === 'all' || item.source === sourceFilter;
      return matchesQuery && matchesSource;
    });
  }, [conversions, search, sourceFilter]);

  const totals = useMemo(() => {
    return filteredConversions.reduce(
      (acc, item) => ({
        leads: acc.leads + item.leads,
        mql: acc.mql + item.mql,
        sql: acc.sql + item.sql,
      }),
      { leads: 0, mql: 0, sql: 0 }
    );
  }, [filteredConversions]);

  const topConversion = useMemo(() => {
    if (filteredConversions.length === 0) return null;
    return [...filteredConversions].sort((a, b) => b.leads - a.leads)[0];
  }, [filteredConversions]);

  const fmtDate = (value: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('pt-BR');
    return value;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in-up">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="text-autoforce-blue" />
            Leads RD Station
          </h2>
          <p className="text-autoforce-lightGrey text-sm">
            Visualize as conversoes do RD Station e entenda quais fontes trazem mais volume.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 bg-autoforce-black/60 border border-autoforce-grey/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-autoforce-lightGrey">
            <CalendarDays size={14} />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="bg-transparent border border-autoforce-grey/30 rounded-lg px-2 py-1 text-xs text-white"
            />
            <span>ate</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="bg-transparent border border-autoforce-grey/30 rounded-lg px-2 py-1 text-xs text-white"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-autoforce-lightGrey">
            <Filter size={14} />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-autoforce-darkest border border-autoforce-grey/30 rounded-lg px-2 py-1 text-xs text-white"
            >
              <option value="all">Todas as fontes</option>
              <option value="rdstation">RD Station</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-xs text-autoforce-lightGrey border border-autoforce-grey/30 rounded-lg px-2 py-1">
            <Search size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversao"
              className="bg-transparent text-xs text-white placeholder:text-autoforce-grey focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-autoforce-lightGrey uppercase tracking-wider">Total de Leads</span>
            <Users size={16} className="text-autoforce-blue" />
          </div>
          <p className="text-2xl font-bold text-white mt-3">{totals.leads}</p>
          <p className="text-xs text-autoforce-grey mt-1">No periodo filtrado</p>
        </div>
        <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-autoforce-lightGrey uppercase tracking-wider">Top Conversao</span>
            <Database size={16} className="text-autoforce-accent" />
          </div>
          <p className="text-lg font-semibold text-white mt-3">
            {topConversion ? topConversion.name : 'Sem dados'}
          </p>
          <p className="text-xs text-autoforce-grey mt-1">
            {topConversion ? `${topConversion.leads} leads` : 'Aguardando integracao'}
          </p>
        </div>
      </div>

      <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-autoforce-grey/20 flex items-center justify-between">
          <h3 className="text-white font-bold">Detalhe por Conversao</h3>
          <span className="text-xs text-autoforce-grey">
            {loading ? 'Carregando...' : `${filteredConversions.length} conversoes`}
          </span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-autoforce-lightGrey">Carregando conversoes...</div>
        ) : filteredConversions.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-white font-semibold">Nenhum lead encontrado.</p>
            <p className="text-sm text-autoforce-lightGrey">
              Conecte o RD Station ou envie leads via webhook para iniciar o monitoramento.
            </p>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="inline-flex items-center gap-2 bg-autoforce-blue/20 border border-autoforce-blue/40 text-autoforce-blue px-4 py-2 rounded-lg text-sm hover:bg-autoforce-blue/30 transition"
            >
              Configurar Integracao
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-autoforce-black/50 text-autoforce-grey text-xs uppercase font-bold">
                <tr>
                  <th className="p-4">Conversao</th>
                  <th className="p-4">Origem</th>
                  <th className="p-4 text-center">Leads</th>
                  <th className="p-4 text-center">MQL</th>
                  <th className="p-4 text-center">SQL</th>
                  <th className="p-4 text-right">Taxa</th>
                  <th className="p-4 text-right">Ultimo Lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-autoforce-grey/10">
                {filteredConversions.map(item => (
                  <tr key={item.id} className="hover:bg-autoforce-blue/5 transition-colors">
                    <td className="p-4 text-white font-medium">
                      <div className="space-y-1">
                        <p>{item.name}</p>
                        <p className="text-xs text-autoforce-grey">{item.identifier}</p>
                      </div>
                    </td>
                    <td className="p-4 text-autoforce-lightGrey">{item.source}</td>
                    <td className="p-4 text-center text-white font-semibold">{item.leads}</td>
                    <td className="p-4 text-center text-autoforce-lightGrey">{item.mql}</td>
                    <td className="p-4 text-center text-autoforce-lightGrey">{item.sql}</td>
                    <td className="p-4 text-right">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-autoforce-blue/10 text-autoforce-blue">
                        {item.conversionRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-4 text-right text-autoforce-lightGrey">{fmtDate(item.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadConversionsView;
