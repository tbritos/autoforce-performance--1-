import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Database, Filter, Search, Users } from 'lucide-react';
import { DataService } from '../services/dataService';
import { WebhookLead } from '../types';

const WebhookLeadsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<WebhookLead[]>([]);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await DataService.getWebhookLeads({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      setLeads(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar leads via webhook:', error);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [dateRange.end, dateRange.start]);

  const fmtDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('pt-BR');
    return value;
  };

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return leads;
    return leads.filter(item => {
      const conversion = (item.conversionIdentifier || item.conversionName || '').toLowerCase();
      const name = (item.name || '').toLowerCase();
      const email = (item.email || '').toLowerCase();
      return conversion.includes(query) || name.includes(query) || email.includes(query);
    });
  }, [leads, search]);

  const conversionRows = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number; lastSeen?: string | null }>();
    filteredLeads.forEach(lead => {
      const label = lead.conversionIdentifier || lead.conversionName || 'Sem conversao';
      const key = label;
      const current = map.get(key) || { key, label, count: 0, lastSeen: lead.lastConversionDate };
      current.count += 1;
      if (lead.lastConversionDate) {
        if (!current.lastSeen || new Date(lead.lastConversionDate) > new Date(current.lastSeen)) {
          current.lastSeen = lead.lastConversionDate;
        }
      }
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filteredLeads]);

  const topConversion = conversionRows.length > 0 ? conversionRows[0] : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in-up">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database className="text-autoforce-blue" />
            Leads via Webhook
          </h2>
          <p className="text-autoforce-lightGrey text-sm">
            Conversoes e volume de leads por conversao (dados locais via webhook).
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
          <div className="flex items-center gap-2 text-xs text-autoforce-lightGrey border border-autoforce-grey/30 rounded-lg px-2 py-1">
            <Search size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversao, nome ou email"
              className="bg-transparent text-xs text-white placeholder:text-autoforce-grey focus:outline-none"
            />
          </div>
          <span className="text-xs text-autoforce-lightGrey">Fonte agnostica: qualquer webhook de leads.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-autoforce-lightGrey uppercase tracking-wider">Total de Leads</span>
            <Users size={16} className="text-autoforce-blue" />
          </div>
          <p className="text-2xl font-bold text-white mt-3">{filteredLeads.length}</p>
          <p className="text-xs text-autoforce-grey mt-1">No periodo filtrado</p>
        </div>
        <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-autoforce-lightGrey uppercase tracking-wider">Conversoes</span>
            <Filter size={16} className="text-autoforce-accent" />
          </div>
          <p className="text-2xl font-bold text-white mt-3">{conversionRows.length}</p>
          <p className="text-xs text-autoforce-grey mt-1">Tipos de conversao</p>
        </div>
        <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-autoforce-lightGrey uppercase tracking-wider">Top Conversao</span>
            <Database size={16} className="text-autoforce-accent" />
          </div>
          <p className="text-lg font-semibold text-white mt-3">
            {topConversion ? topConversion.label : 'Sem dados'}
          </p>
          <p className="text-xs text-autoforce-grey mt-1">
            {topConversion ? `${topConversion.count} leads` : 'Aguardando integracao'}
          </p>
        </div>
      </div>

      <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-autoforce-grey/20 flex items-center justify-between">
          <h3 className="text-white font-bold">Detalhe por Conversao</h3>
          <span className="text-xs text-autoforce-grey">
            {loading ? 'Carregando...' : `${conversionRows.length} conversoes`}
          </span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-autoforce-lightGrey">Carregando conversoes...</div>
        ) : conversionRows.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-white font-semibold">Nenhum lead encontrado.</p>
            <p className="text-sm text-autoforce-lightGrey">
              Verifique se o webhook de leads esta enviando eventos para esta API.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-autoforce-black/50 text-autoforce-grey text-xs uppercase font-bold">
                <tr>
                  <th className="p-4">Conversao</th>
                  <th className="p-4 text-center">Leads</th>
                  <th className="p-4 text-right">Ultima Conversao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-autoforce-grey/10">
                {conversionRows.map(item => (
                  <tr key={item.key} className="hover:bg-autoforce-blue/5 transition-colors">
                    <td className="p-4 text-white font-medium">{item.label}</td>
                    <td className="p-4 text-center text-white font-semibold">{item.count}</td>
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

export default WebhookLeadsView;
