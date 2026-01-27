
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RevenueEntry } from '../types';
import { DataService } from '../services/dataService';
import { DollarSign, Plus, Briefcase, Globe, Package, TrendingUp, Loader2, Filter, X, Calendar, ChevronDown, Pencil, Trash2 } from 'lucide-react';

const RevenueTracker: React.FC = () => {
  const productOptions = ['Autodromo', 'Autopilot', 'Autobot', 'Nitroads', 'Fluxo de IA'];
  const originOptions = ['Google Ads', 'Facebook/Meta', 'Indicação', 'Organico', 'Outros'];
  const [history, setHistory] = useState<RevenueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [setupValue, setSetupValue] = useState('');
  const [mrrValue, setMrrValue] = useState('');
  const [origin, setOrigin] = useState('Google Ads');
  const [selectedProducts, setSelectedProducts] = useState<string[]>(['Autodromo']);
  const [isProductMenuOpen, setIsProductMenuOpen] = useState(false);
  const productMenuRef = useRef<HTMLDivElement | null>(null);

  // Filters State
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [filterProducts, setFilterProducts] = useState<string[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    loadData();
  }, [filterOrigin, filterProducts]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!productMenuRef.current) return;
      if (!productMenuRef.current.contains(event.target as Node)) {
        setIsProductMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const data = await DataService.getRevenueHistory({
          origin: filterOrigin || undefined,
          products: filterProducts.length > 0 ? filterProducts : undefined,
        });
        setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
        console.error("Failed to load revenue history", error);
        setHistory([]);
    } finally {
        setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !saleDate || !setupValue || !mrrValue || selectedProducts.length === 0) return;

    setSaving(true);
    try {
        const payload = {
            businessName,
            date: saleDate,
            setupValue: parseFloat(setupValue),
            mrrValue: parseFloat(mrrValue),
            origin,
            product: selectedProducts
        };
        if (editingId) {
            await DataService.updateRevenueEntry(editingId, payload);
        } else {
            await DataService.saveRevenueEntry(payload);
        }
        
        // Reset Form
        setBusinessName('');
        setSaleDate(new Date().toISOString().split('T')[0]);
        setSetupValue('');
        setMrrValue('');
        setSelectedProducts(['Autodromo']);
        setEditingId(null);
        
        await loadData();
    } catch (err) {
        console.error(err);
    } finally {
        setSaving(false);
    }
  };

  const handleEdit = (entry: RevenueEntry) => {
      setEditingId(entry.id);
      setBusinessName(entry.businessName);
      setSaleDate(entry.date);
      setSetupValue(String(entry.setupValue ?? 0));
      setMrrValue(String(entry.mrrValue ?? 0));
      setOrigin(entry.origin);
      setSelectedProducts(Array.isArray(entry.product) ? entry.product : [entry.product]);
      setIsProductMenuOpen(false);
  };

  const handleDelete = async (entry: RevenueEntry) => {
      const confirmed = window.confirm(`Remover o ganho de ${entry.businessName}?`);
      if (!confirmed) return;
      setDeletingId(entry.id);
      try {
          await DataService.deleteRevenueEntry(entry.id);
          await loadData();
          if (editingId === entry.id) {
              setEditingId(null);
              setBusinessName('');
              setSaleDate(new Date().toISOString().split('T')[0]);
              setSetupValue('');
              setMrrValue('');
              setOrigin('Google Ads');
              setSelectedProducts(['Autodromo']);
          }
      } catch (err) {
          console.error(err);
      } finally {
          setDeletingId(null);
      }
  };

  const handleCancelEdit = () => {
      setEditingId(null);
      setBusinessName('');
      setSaleDate(new Date().toISOString().split('T')[0]);
      setSetupValue('');
      setMrrValue('');
      setOrigin('Google Ads');
      setSelectedProducts(['Autodromo']);
  };

  const clearFilters = () => {
      setFilterStart('');
      setFilterEnd('');
      setFilterOrigin('');
      setFilterProducts([]);
  };

  const toggleSelectedProduct = (value: string) => {
      setSelectedProducts(prev =>
        prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
      );
  };

  const toggleFilterProduct = (value: string) => {
      setFilterProducts(prev =>
        prev.includes(value) ? prev.filter(item => item !== value) : [...prev, value]
      );
  };

  // Filter Logic (Derived State)
  const filteredHistory = useMemo(() => {
      if (!Array.isArray(history)) return [];
      return history.filter(entry => {
        const entryDate = new Date(entry.date);
        const start = filterStart ? new Date(filterStart) : new Date('1900-01-01');
        const end = filterEnd ? new Date(filterEnd) : new Date('2100-12-31');
        end.setHours(23, 59, 59, 999);

        const entryProducts = Array.isArray(entry.product) ? entry.product : [entry.product];
        const matchesOrigin = !filterOrigin || entry.origin === filterOrigin;
        const matchesProduct =
          filterProducts.length === 0 || filterProducts.some(prod => entryProducts.includes(prod));

        return entryDate >= start && entryDate <= end && matchesOrigin && matchesProduct;
    });
  }, [history, filterStart, filterEnd, filterOrigin, filterProducts]);

  useEffect(() => {
      setCurrentPage(1);
  }, [filterStart, filterEnd, filterOrigin, filterProducts, history]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const paginatedHistory = useMemo(() => {
      const start = (currentPage - 1) * pageSize;
      return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, currentPage, pageSize]);

  useEffect(() => {
      setCurrentPage(prev => Math.min(prev, totalPages));
  }, [totalPages]);

  const formatCurrency = (val: number) => {
      if (isNaN(val)) return 'R$ 0,00';
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Calculate Totals based on Filtered Data
  const totalSetup = useMemo(() => filteredHistory.reduce((acc, curr) => acc + (curr.setupValue || 0), 0), [filteredHistory]);
  const totalMRR = useMemo(() => filteredHistory.reduce((acc, curr) => acc + (curr.mrrValue || 0), 0), [filteredHistory]);
  const hasActiveFilters = Boolean(filterStart || filterEnd || filterOrigin || filterProducts.length > 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in-up">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <DollarSign className="text-autoforce-success" />
                    Ganhos de Marketing
                </h2>
                <p className="text-autoforce-lightGrey text-sm">Registre as vendas, setup e receita recorrente (MRR) geradas.</p>
            </div>
        </div>

        {/* Totals Cards (Reactive to Filters) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-autoforce-darkest to-autoforce-darkBlue/20 border border-autoforce-grey/20 p-6 rounded-xl flex items-center justify-between transition-all duration-300">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-autoforce-lightGrey text-xs font-bold uppercase tracking-wider">Total Setup Gerado</p>
                        {hasActiveFilters && <span className="text-[10px] bg-autoforce-blue/20 text-autoforce-blue px-1.5 py-0.5 rounded">Filtrado</span>}
                    </div>
                    <p className="text-3xl font-display font-bold text-white">{formatCurrency(totalSetup)}</p>
                </div>
                <div className="bg-autoforce-blue/20 p-3 rounded-full text-autoforce-blue">
                    <Briefcase size={24} />
                </div>
            </div>
            <div className="bg-gradient-to-br from-autoforce-darkest to-autoforce-darkBlue/20 border border-autoforce-grey/20 p-6 rounded-xl flex items-center justify-between transition-all duration-300">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-autoforce-lightGrey text-xs font-bold uppercase tracking-wider">Total MRR Adicionado</p>
                        {hasActiveFilters && <span className="text-[10px] bg-autoforce-blue/20 text-autoforce-blue px-1.5 py-0.5 rounded">Filtrado</span>}
                    </div>
                    <p className="text-3xl font-display font-bold text-green-400">{formatCurrency(totalMRR)}</p>
                </div>
                <div className="bg-green-500/20 p-3 rounded-full text-green-500">
                    <TrendingUp size={24} />
                </div>
            </div>
        </div>

        {/* Filters */}
        <div className="bg-autoforce-darkest/60 border border-autoforce-grey/20 rounded-2xl p-4 md:p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-autoforce-blue" />
                    <span className="text-sm font-bold text-white">Filtros</span>
                    {hasActiveFilters && (
                        <span className="text-[10px] bg-autoforce-blue/20 text-autoforce-blue px-1.5 py-0.5 rounded">Ativos</span>
                    )}
                </div>
                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="text-xs text-autoforce-lightGrey hover:text-white px-3 py-1.5 rounded-full border border-autoforce-grey/30"
                    >
                        Limpar filtros
                    </button>
                )}
            </div>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-[auto_auto_1fr] gap-4 items-end">
                <div>
                    <label className="block text-[10px] font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Periodo</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="date" 
                            value={filterStart}
                            onChange={(e) => setFilterStart(e.target.value)}
                            className="bg-autoforce-black text-white text-xs px-3 py-2 rounded border border-autoforce-grey/30 focus:border-autoforce-blue outline-none w-[140px]"
                        />
                        <span className="text-autoforce-grey text-xs">ate</span>
                        <input 
                            type="date" 
                            value={filterEnd}
                            onChange={(e) => setFilterEnd(e.target.value)}
                            className="bg-autoforce-black text-white text-xs px-3 py-2 rounded border border-autoforce-grey/30 focus:border-autoforce-blue outline-none w-[140px]"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Origem</label>
                    <select
                        value={filterOrigin}
                        onChange={(e) => setFilterOrigin(e.target.value)}
                        className="bg-autoforce-black text-white text-xs px-3 py-2 rounded border border-autoforce-grey/30 focus:border-autoforce-blue outline-none min-w-[160px]"
                    >
                        <option value="">Todas</option>
                        {originOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Produtos</label>
                    <div className="flex flex-wrap gap-2">
                        {productOptions.map(option => {
                            const isActive = filterProducts.includes(option);
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => toggleFilterProduct(option)}
                                    className={`px-2.5 py-1 rounded-full text-xs border transition ${
                                        isActive
                                            ? 'bg-autoforce-blue/20 text-autoforce-blue border-autoforce-blue/40'
                                            : 'text-autoforce-lightGrey border-autoforce-grey/30 hover:border-autoforce-blue/40'
                                    }`}
                                >
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Form */}
            <div className="lg:col-span-4 h-fit bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6 shadow-lg lg:sticky top-6">
                <div className="flex items-center justify-between mb-6 border-b border-autoforce-grey/20 pb-4">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Plus size={16} className="text-autoforce-accent"/>
                        Novo Negocio
                    </h3>
                    {editingId && (
                        <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="text-xs text-autoforce-lightGrey hover:text-white"
                        >
                            Cancelar edição
                        </button>
                    )}
                </div>
                
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Nome do Negocio</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                placeholder="Ex: Grupo Sinal"
                                className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded-lg px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none pl-9"
                            />
                            <Briefcase className="absolute left-3 top-2.5 text-autoforce-grey" size={14} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Data da Venda</label>
                        <input
                            type="date"
                            value={saleDate}
                            onChange={(e) => setSaleDate(e.target.value)}
                            className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded-lg px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Valor Setup (R$)</label>
                            <input 
                                type="number" 
                                min="0"
                                step="0.01"
                                value={setupValue}
                                onChange={(e) => setSetupValue(e.target.value)}
                                placeholder="0,00"
                                className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded-lg px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Valor MRR (R$)</label>
                            <input 
                                type="number" 
                                min="0"
                                step="0.01"
                                value={mrrValue}
                                onChange={(e) => setMrrValue(e.target.value)}
                                placeholder="0,00"
                                className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded-lg px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none font-mono"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Origem</label>
                            <div className="relative">
                                <select 
                                    value={origin}
                                    onChange={(e) => setOrigin(e.target.value)}
                                    className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded-lg px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none pl-9 appearance-none"
                                >
                                    {originOptions.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                                <Globe className="absolute left-3 top-2.5 text-autoforce-grey" size={14} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Produtos</label>
                            <div className="relative" ref={productMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsProductMenuOpen(prev => !prev)}
                                    className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded-lg px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm flex items-center justify-between"
                                >
                                    <span className="truncate">
                                        {selectedProducts.length > 0
                                            ? `${selectedProducts.length} selecionados`
                                            : 'Selecione produtos'}
                                    </span>
                                    <ChevronDown size={14} className="text-autoforce-grey" />
                                </button>
                                {isProductMenuOpen && (
                                    <div className="absolute z-20 mt-2 w-full bg-autoforce-darkest border border-autoforce-grey/30 rounded-lg p-2 max-h-56 overflow-y-auto shadow-lg">
                                        <div className="flex items-center justify-between px-2 py-1 border-b border-autoforce-grey/20 mb-1">
                                            <span className="text-[10px] text-autoforce-lightGrey">
                                                {selectedProducts.length} selecionados
                                            </span>
                                            {selectedProducts.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedProducts([])}
                                                    className="text-[10px] text-autoforce-blue hover:text-autoforce-secondary"
                                                >
                                                    Limpar
                                                </button>
                                            )}
                                        </div>
                                        {productOptions.map(option => {
                                            const isActive = selectedProducts.includes(option);
                                            return (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    onClick={() => toggleSelectedProduct(option)}
                                                    className={`w-full text-left px-3 py-2 rounded text-xs transition ${
                                                        isActive
                                                            ? 'bg-autoforce-blue/20 text-autoforce-blue'
                                                            : 'text-autoforce-lightGrey hover:bg-white/5'
                                                    }`}
                                                >
                                                    {option}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button 
                            type="submit" 
                            disabled={saving}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18}/> : <Plus size={18} />}
                            {saving ? 'Adicionando...' : editingId ? 'Atualizar Ganho' : 'Adicionar Ganho'}
                        </button>
                    </div>
                </form>
            </div>

            {/* List */}
            <div className="lg:col-span-8 bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-autoforce-grey/20 flex justify-between items-center">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Calendar size={18} className="text-autoforce-lightGrey" />
                        Historico de Vendas
                    </h3>
                    <div className="text-xs text-autoforce-lightGrey">
                        Exibindo {paginatedHistory.length} de {filteredHistory.length} registros
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-autoforce-black/50 text-autoforce-grey text-xs uppercase font-bold">
                            <tr>
                                <th className="p-4">Data</th>
                                <th className="p-4">Cliente</th>
                            <th className="p-4">Origem / Produto</th>
                            <th className="p-4 text-right">Setup</th>
                            <th className="p-4 text-right">MRR</th>
                            <th className="p-4 text-right">ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-autoforce-grey/10">
                        {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-autoforce-lightGrey">Carregando...</td></tr>
                            ) : filteredHistory.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-autoforce-lightGrey">Nenhuma venda encontrada no perÃ­odo.</td></tr>
                            ) : (
                                paginatedHistory.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-autoforce-blue/5 transition-colors">
                                        <td className="p-4 text-autoforce-lightGrey">{new Date(entry.date).toLocaleDateString('pt-BR')}</td>
                                        <td className="p-4 font-bold text-white">{entry.businessName}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="flex items-center gap-1 text-xs text-autoforce-lightGrey"><Globe size={10}/> {entry.origin}</span>
                                                <span className="flex items-center gap-1 text-xs text-autoforce-blue"><Package size={10}/> {entry.product.join(', ')}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-autoforce-lightGrey">{formatCurrency(entry.setupValue)}</td>
                                        <td className="p-4 text-right font-mono text-green-400 font-bold">{formatCurrency(entry.mrrValue)}</td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEdit(entry)}
                                                    className="p-2 rounded-lg border border-autoforce-grey/20 text-autoforce-lightGrey hover:text-white hover:border-autoforce-blue/40"
                                                    title="Editar"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(entry)}
                                                    disabled={deletingId === entry.id}
                                                    className="p-2 rounded-lg border border-autoforce-grey/20 text-red-300 hover:text-red-200 hover:border-red-400/40 disabled:opacity-50"
                                                    title="Remover"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {filteredHistory.length > 0 && (
                    <div className="flex items-center justify-between p-4 border-t border-autoforce-grey/20">
                        <span className="text-xs text-autoforce-lightGrey">Pagina {currentPage} de {totalPages}</span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 text-xs font-bold rounded bg-autoforce-black text-white border border-autoforce-grey/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Anterior
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 text-xs font-bold rounded bg-autoforce-black text-white border border-autoforce-grey/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Proxima
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>

    </div>
  );
};

export default RevenueTracker;

