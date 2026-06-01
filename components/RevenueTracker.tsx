
import React, { useState, useEffect, useMemo } from 'react';
import { RevenueEntry } from '../types';
import { DataService } from '../services/dataService';
import { DollarSign, Briefcase, Globe, Package, TrendingUp, Loader2, Filter, X, Calendar, Trash2, ExternalLink, Link } from 'lucide-react';

const RevenueTracker: React.FC = () => {
  const originOptions = ['Google Ads', 'Facebook/Meta', 'Indicação', 'Organico', 'Outros'];
  const productOptions = ['Autodromo', 'Autopilot', 'Autobot', 'Nitroads', 'Fluxo de IA'];

  const [history, setHistory] = useState<RevenueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [filterProducts, setFilterProducts] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => { loadData(); }, [filterOrigin, filterProducts]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await DataService.getRevenueHistory({
        origin: filterOrigin || undefined,
        products: filterProducts.length > 0 ? filterProducts : undefined,
      });
      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load revenue history', error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entry: RevenueEntry) => {
    const confirmed = window.confirm(`Remover o ganho de ${entry.businessName}?`);
    if (!confirmed) return;
    setDeletingId(entry.id);
    try {
      await DataService.deleteRevenueEntry(entry.id);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const clearFilters = () => {
    setFilterStart('');
    setFilterEnd('');
    setFilterOrigin('');
    setFilterProducts([]);
  };

  const toggleFilterProduct = (value: string) => {
    setFilterProducts(prev =>
      prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
    );
  };

  const filteredHistory = useMemo(() => {
    if (!Array.isArray(history)) return [];
    return history.filter(entry => {
      const entryDate = new Date(entry.date);
      const start = filterStart ? new Date(filterStart) : new Date('1900-01-01');
      const end = filterEnd ? new Date(filterEnd) : new Date('2100-12-31');
      end.setHours(23, 59, 59, 999);
      const entryProducts = Array.isArray(entry.product) ? entry.product : [entry.product];
      const matchesOrigin = !filterOrigin || entry.origin === filterOrigin;
      const matchesProduct = filterProducts.length === 0 || filterProducts.some(prod => entryProducts.includes(prod));
      return entryDate >= start && entryDate <= end && matchesOrigin && matchesProduct;
    });
  }, [history, filterStart, filterEnd, filterOrigin, filterProducts]);

  useEffect(() => { setCurrentPage(1); }, [filterStart, filterEnd, filterOrigin, filterProducts, history]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, currentPage, pageSize]);

  useEffect(() => { setCurrentPage(prev => Math.min(prev, totalPages)); }, [totalPages]);

  const formatCurrency = (val: number) => {
    if (isNaN(val)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const totalSetup = useMemo(() => filteredHistory.reduce((acc, curr) => acc + (curr.setupValue || 0), 0), [filteredHistory]);
  const totalMRR   = useMemo(() => filteredHistory.reduce((acc, curr) => acc + (curr.mrrValue || 0), 0), [filteredHistory]);
  const hasActiveFilters = Boolean(filterStart || filterEnd || filterOrigin || filterProducts.length > 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in-up">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <DollarSign className="text-autoforce-success" />
          Ganhos de Marketing
        </h2>
        <p className="text-autoforce-lightGrey text-sm">Vendas inbound geradas automaticamente via Pipedrive.</p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-autoforce-darkest to-autoforce-darkBlue/20 border border-autoforce-grey/20 p-6 rounded-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-autoforce-lightGrey text-xs font-bold uppercase tracking-wider">Total Setup Gerado</p>
              {hasActiveFilters && <span className="text-[10px] bg-autoforce-blue/20 text-autoforce-blue px-1.5 py-0.5 rounded">Filtrado</span>}
            </div>
            <p className="text-3xl font-display font-bold text-white">{formatCurrency(totalSetup)}</p>
          </div>
          <div className="bg-autoforce-blue/20 p-3 rounded-full text-autoforce-blue"><Briefcase size={24} /></div>
        </div>
        <div className="bg-gradient-to-br from-autoforce-darkest to-autoforce-darkBlue/20 border border-autoforce-grey/20 p-6 rounded-xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-autoforce-lightGrey text-xs font-bold uppercase tracking-wider">Total MRR Adicionado</p>
              {hasActiveFilters && <span className="text-[10px] bg-autoforce-blue/20 text-autoforce-blue px-1.5 py-0.5 rounded">Filtrado</span>}
            </div>
            <p className="text-3xl font-display font-bold text-green-400">{formatCurrency(totalMRR)}</p>
          </div>
          <div className="bg-green-500/20 p-3 rounded-full text-green-500"><TrendingUp size={24} /></div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-autoforce-darkest/60 border border-autoforce-grey/20 rounded-2xl p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-autoforce-blue" />
            <span className="text-sm font-bold text-white">Filtros</span>
            {hasActiveFilters && <span className="text-[10px] bg-autoforce-blue/20 text-autoforce-blue px-1.5 py-0.5 rounded">Ativos</span>}
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-autoforce-lightGrey hover:text-white px-3 py-1.5 rounded-full border border-autoforce-grey/30">
              Limpar filtros
            </button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[auto_auto_1fr] gap-4 items-end">
          <div>
            <label className="block text-[10px] font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Periodo</label>
            <div className="flex items-center gap-2">
              <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)}
                className="bg-autoforce-black text-white text-xs px-3 py-2 rounded border border-autoforce-grey/30 focus:border-autoforce-blue outline-none w-[140px]" />
              <span className="text-autoforce-grey text-xs">ate</span>
              <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)}
                className="bg-autoforce-black text-white text-xs px-3 py-2 rounded border border-autoforce-grey/30 focus:border-autoforce-blue outline-none w-[140px]" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Origem</label>
            <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)}
              className="bg-autoforce-black text-white text-xs px-3 py-2 rounded border border-autoforce-grey/30 focus:border-autoforce-blue outline-none min-w-[160px]">
              <option value="">Todas</option>
              {originOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Produtos</label>
            <div className="flex flex-wrap gap-2">
              {productOptions.map(option => {
                const isActive = filterProducts.includes(option);
                return (
                  <button key={option} type="button" onClick={() => toggleFilterProduct(option)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition ${isActive ? 'bg-autoforce-blue/20 text-autoforce-blue border-autoforce-blue/40' : 'text-autoforce-lightGrey border-autoforce-grey/30 hover:border-autoforce-blue/40'}`}>
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-autoforce-grey/20 flex justify-between items-center">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Calendar size={18} className="text-autoforce-lightGrey" />
            Historico de Vendas
          </h3>
          <div className="text-xs text-autoforce-lightGrey">
            {filteredHistory.length} registro{filteredHistory.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-autoforce-black/50 text-autoforce-grey text-xs uppercase font-bold">
              <tr>
                <th className="p-4">Data</th>
                <th className="p-4">Cliente / Lead</th>
                <th className="p-4">Detalhes</th>
                <th className="p-4 text-right">Setup</th>
                <th className="p-4 text-right">MRR</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-autoforce-grey/10">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-autoforce-lightGrey"><Loader2 className="animate-spin inline" size={18} /></td></tr>
              ) : filteredHistory.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-autoforce-lightGrey">Nenhuma venda encontrada.</td></tr>
              ) : (
                paginatedHistory.map(entry => (
                  <tr key={entry.id} className="hover:bg-autoforce-blue/5 transition-colors">
                    <td className="p-4 text-autoforce-lightGrey whitespace-nowrap">
                      {new Date(entry.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-white">{entry.businessName}</div>
                      {entry.leadEmail && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Link size={10} className="text-autoforce-blue" />
                          <span className="text-[11px] text-autoforce-blue">{entry.leadName || entry.leadEmail}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-xs text-autoforce-lightGrey">
                          <Globe size={10} /> {entry.origin}
                          {entry.closedBy && <span className="ml-1">· {entry.closedBy}</span>}
                        </span>
                        {(entry.product?.length ?? 0) > 0 && (
                          <span className="flex items-center gap-1 text-xs text-autoforce-blue">
                            <Package size={10} /> {entry.product.join(', ')}
                          </span>
                        )}
                        {(entry.whyBought?.length ?? 0) > 0 && (
                          <span className="text-[11px] text-autoforce-lightGrey/70 italic">{entry.whyBought!.join(' · ')}</span>
                        )}
                        {(entry.currentSupplier?.length ?? 0) > 0 && (
                          <span className="text-[11px] text-autoforce-lightGrey/60">Anterior: {entry.currentSupplier!.join(', ')}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right font-mono text-autoforce-lightGrey whitespace-nowrap">
                      {formatCurrency(entry.setupValue)}
                    </td>
                    <td className="p-4 text-right font-mono text-green-400 font-bold whitespace-nowrap">
                      {formatCurrency(entry.mrrValue)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {entry.dealUrl && (
                          <a href={entry.dealUrl} target="_blank" rel="noopener noreferrer"
                            className="p-2 rounded-lg border border-autoforce-grey/20 text-autoforce-blue hover:text-white hover:border-autoforce-blue/40"
                            title="Abrir no Pipedrive">
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <button type="button" onClick={() => handleDelete(entry)} disabled={deletingId === entry.id}
                          className="p-2 rounded-lg border border-autoforce-grey/20 text-red-300 hover:text-red-200 hover:border-red-400/40 disabled:opacity-50"
                          title="Remover">
                          {deletingId === entry.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredHistory.length > pageSize && (
          <div className="flex items-center justify-between p-4 border-t border-autoforce-grey/20">
            <span className="text-xs text-autoforce-lightGrey">Página {currentPage} de {totalPages}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-bold rounded bg-autoforce-black text-white border border-autoforce-grey/30 disabled:opacity-50">
                Anterior
              </button>
              <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-bold rounded bg-autoforce-black text-white border border-autoforce-grey/30 disabled:opacity-50">
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default RevenueTracker;
