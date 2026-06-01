
import React, { useState, useEffect, useMemo } from 'react';
import { RevenueEntry } from '../types';
import { DataService } from '../services/dataService';
import {
  DollarSign, Briefcase, Globe, Package, TrendingUp, Loader2, Filter,
  Calendar, Trash2, ExternalLink, Link, X, User, FileText, ShoppingBag,
  MessageSquare, ChevronRight, Search, Users, Trophy, CheckCircle,
} from 'lucide-react';

// ─── Detail Drawer ────────────────────────────────────────────────────────────

const EntryDrawer: React.FC<{
  entry: RevenueEntry;
  onClose: () => void;
  onDelete: (entry: RevenueEntry) => void;
  deleting: boolean;
  formatCurrency: (v: number) => string;
}> = ({ entry, onClose, onDelete, deleting, formatCurrency }) => {
  const [visible, setVisible] = useState(false);
  const initials = entry.businessName.slice(0, 2).toUpperCase();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
  };

  const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
      <p className="text-[10px] font-bold text-autoforce-grey uppercase tracking-widest mb-2">{label}</p>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div className={`relative flex flex-col w-full max-w-sm bg-autoforce-darkest border-l border-autoforce-grey/20 shadow-2xl h-screen transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-b from-autoforce-darkBlue/20 to-autoforce-darkest border-b border-autoforce-grey/20 p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-autoforce-blue/20 border border-autoforce-blue/30 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-black text-autoforce-blue">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-autoforce-grey uppercase tracking-widest mb-0.5">Ganho</p>
                <h3 className="text-base font-black text-white leading-tight truncate">{entry.businessName}</h3>
              </div>
            </div>
            <button onClick={handleClose} className="p-1.5 rounded-lg text-autoforce-grey hover:text-white hover:bg-autoforce-grey/10 transition flex-shrink-0 ml-2">
              <X size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-500/15 text-green-400 border border-green-500/25">
              <CheckCircle size={10} /> GANHO
            </span>
            <span className="text-xs text-autoforce-lightGrey">
              {new Date(entry.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            {entry.leadEmail && (
              <span className="flex items-center gap-1 text-xs text-autoforce-blue/70 truncate">
                <Link size={10} /> {entry.leadName || entry.leadEmail}
              </span>
            )}
          </div>
        </div>

        {/* MRR + Setup */}
        <div className="flex-shrink-0 grid grid-cols-2 divide-x divide-autoforce-grey/20 border-b border-autoforce-grey/20">
          <div className="p-4 bg-green-500/8">
            <p className="text-[10px] font-bold text-autoforce-lightGrey uppercase tracking-widest mb-1">MRR Mensal</p>
            <p className="text-2xl font-black text-green-400">{formatCurrency(entry.mrrValue)}</p>
            <p className="text-[10px] text-autoforce-grey mt-0.5">por mês</p>
          </div>
          <div className="p-4 bg-autoforce-darkest">
            <p className="text-[10px] font-bold text-autoforce-lightGrey uppercase tracking-widest mb-1">Setup</p>
            <p className="text-2xl font-black text-white">{formatCurrency(entry.setupValue)}</p>
            <p className="text-[10px] text-autoforce-grey mt-0.5">único</p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-autoforce-grey/5">

          {/* Origem + Vendedor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-3">
              <p className="text-[9px] font-bold text-autoforce-grey uppercase tracking-widest mb-1.5">Origem</p>
              <div className="flex items-center gap-1.5">
                <Globe size={12} className="text-autoforce-blue flex-shrink-0" />
                <span className="text-xs font-semibold text-white truncate">{entry.origin || '—'}</span>
              </div>
            </div>
            <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-3">
              <p className="text-[9px] font-bold text-autoforce-grey uppercase tracking-widest mb-1.5">Vendedor</p>
              <div className="flex items-center gap-1.5">
                <User size={12} className="text-autoforce-blue flex-shrink-0" />
                <span className="text-xs font-semibold text-white truncate">{entry.closedBy || '—'}</span>
              </div>
            </div>
          </div>

          {(entry.product?.length ?? 0) > 0 && (
            <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-3">
              <p className="text-[9px] font-bold text-autoforce-grey uppercase tracking-widest mb-2">Produtos Vendidos</p>
              <div className="flex flex-wrap gap-1.5">
                {entry.product.map(p => (
                  <span key={p} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-autoforce-blue/15 text-autoforce-blue border border-autoforce-blue/25">
                    <Package size={9} /> {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(entry.whyBought?.length ?? 0) > 0 && (
            <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-3">
              <p className="text-[9px] font-bold text-autoforce-grey uppercase tracking-widest mb-2">Motivo da Compra</p>
              <div className="space-y-1.5">
                {entry.whyBought!.map(r => (
                  <div key={r} className="flex items-start gap-2 bg-autoforce-grey/10 rounded-lg px-2.5 py-2">
                    <MessageSquare size={10} className="text-autoforce-lightGrey mt-0.5 flex-shrink-0" />
                    <span className="text-[11px] text-autoforce-lightGrey leading-relaxed">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(entry.currentSupplier?.length ?? 0) > 0 && (
            <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-3">
              <p className="text-[9px] font-bold text-autoforce-grey uppercase tracking-widest mb-2">Fornecedor Anterior</p>
              <div className="flex flex-wrap gap-1.5">
                {entry.currentSupplier!.map(s => (
                  <span key={s} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-autoforce-grey/15 text-autoforce-lightGrey border border-autoforce-grey/20">
                    <ShoppingBag size={9} /> {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(entry.dealUrl || entry.contractLink) && (
            <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-3">
              <p className="text-[9px] font-bold text-autoforce-grey uppercase tracking-widest mb-2">Links</p>
              <div className="flex flex-col gap-2">
                {entry.dealUrl && (
                  <a href={entry.dealUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-autoforce-blue/15 text-autoforce-blue border border-autoforce-blue/25 hover:bg-autoforce-blue/25 transition group">
                    <ExternalLink size={13} />
                    Abrir no Pipedrive
                    <ChevronRight size={12} className="ml-auto opacity-0 group-hover:opacity-100 transition" />
                  </a>
                )}
                {entry.contractLink && (
                  <a href={entry.contractLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-autoforce-grey/15 text-autoforce-lightGrey border border-autoforce-grey/25 hover:text-white transition group">
                    <FileText size={13} />
                    Ver Contrato
                    <ChevronRight size={12} className="ml-auto opacity-0 group-hover:opacity-100 transition" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-autoforce-grey/20 bg-autoforce-darkest flex items-center justify-between">
          <button type="button" onClick={() => onDelete(entry)} disabled={deleting}
            className="flex items-center gap-2 text-xs text-red-400/60 hover:text-red-400 disabled:opacity-40 transition">
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Remover
          </button>
          <button onClick={handleClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-autoforce-grey/10 text-autoforce-lightGrey hover:text-white border border-autoforce-grey/20 transition">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const RevenueTracker: React.FC = () => {
  const [history, setHistory] = useState<RevenueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<RevenueEntry | null>(null);

  const [filterSearch, setFilterSearch] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [filterVendedor, setFilterVendedor] = useState('');
  const [filterProducts, setFilterProducts] = useState<string[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await DataService.getRevenueHistory({});
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (entry: RevenueEntry) => {
    if (!window.confirm(`Remover o ganho de ${entry.businessName}?`)) return;
    setDeletingId(entry.id);
    try {
      await DataService.deleteRevenueEntry(entry.id);
      setSelectedEntry(null);
      await loadData();
    } catch (err) { console.error(err); }
    finally { setDeletingId(null); }
  };

  const clearFilters = () => {
    setFilterSearch(''); setFilterStart(''); setFilterEnd('');
    setFilterOrigin(''); setFilterVendedor(''); setFilterProducts([]);
  };
  const toggleProduct = (v: string) =>
    setFilterProducts(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v]);

  const originOptions   = useMemo(() => [...new Set(history.map(e => e.origin).filter(Boolean) as string[])].sort(), [history]);
  const vendedorOptions = useMemo(() => [...new Set(history.map(e => e.closedBy).filter(Boolean) as string[])].sort(), [history]);
  const productOptions  = useMemo(() => [...new Set(history.flatMap(e => e.product ?? []).filter(Boolean))].sort(), [history]);

  const filteredHistory = useMemo(() => history.filter(entry => {
    const d = new Date(entry.date);
    const s = filterStart ? new Date(filterStart) : new Date('1900-01-01');
    const e = filterEnd   ? new Date(filterEnd)   : new Date('2100-12-31');
    e.setHours(23, 59, 59, 999);
    const prods = Array.isArray(entry.product) ? entry.product : [entry.product];
    return d >= s && d <= e
      && (!filterSearch   || entry.businessName.toLowerCase().includes(filterSearch.toLowerCase()))
      && (!filterOrigin   || entry.origin === filterOrigin)
      && (!filterVendedor || entry.closedBy === filterVendedor)
      && (filterProducts.length === 0 || filterProducts.some(p => prods.includes(p)));
  }), [history, filterSearch, filterStart, filterEnd, filterOrigin, filterVendedor, filterProducts]);

  useEffect(() => { setCurrentPage(1); }, [filterSearch, filterStart, filterEnd, filterOrigin, filterVendedor, filterProducts]);
  useEffect(() => { setCurrentPage(p => Math.min(p, Math.max(1, Math.ceil(filteredHistory.length / pageSize)))); }, [filteredHistory.length]);

  const totalPages       = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const paginatedHistory = useMemo(() => filteredHistory.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredHistory, currentPage]);
  const formatCurrency   = (val: number) => isNaN(val) ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const totalMRR         = useMemo(() => filteredHistory.reduce((a, c) => a + (c.mrrValue || 0), 0), [filteredHistory]);
  const totalSetup       = useMemo(() => filteredHistory.reduce((a, c) => a + (c.setupValue || 0), 0), [filteredHistory]);
  const hasFilters       = Boolean(filterSearch || filterStart || filterEnd || filterOrigin || filterVendedor || filterProducts.length);

  const chips = [
    ...(filterSearch   ? [{ label: `"${filterSearch}"`, clear: () => setFilterSearch('')   }] : []),
    ...(filterOrigin   ? [{ label: filterOrigin,         clear: () => setFilterOrigin('')   }] : []),
    ...(filterVendedor ? [{ label: filterVendedor,        clear: () => setFilterVendedor('') }] : []),
    ...(filterStart    ? [{ label: `De ${filterStart}`,  clear: () => setFilterStart('')    }] : []),
    ...(filterEnd      ? [{ label: `Até ${filterEnd}`,   clear: () => setFilterEnd('')      }] : []),
    ...filterProducts.map(p => ({ label: p, clear: () => toggleProduct(p) })),
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in-up">

      {selectedEntry && (
        <EntryDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)}
          onDelete={handleDelete} deleting={deletingId === selectedEntry.id} formatCurrency={formatCurrency} />
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-white flex items-center gap-2">
          <DollarSign size={22} className="text-green-400" />
          Ganhos de Marketing
        </h2>
        <p className="text-autoforce-lightGrey text-sm mt-0.5">Vendas inbound geradas via Pipedrive</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-autoforce-darkest to-autoforce-darkBlue/20 border border-autoforce-grey/20 p-5 rounded-2xl">
          <div className="flex items-start justify-between mb-4">
            <p className="text-[11px] font-bold text-autoforce-lightGrey uppercase tracking-widest">Total de Ganhos</p>
            <div className="p-2 rounded-xl bg-autoforce-blue/15 text-autoforce-blue"><Trophy size={16} /></div>
          </div>
          <p className="text-4xl font-black text-white">{filteredHistory.length}</p>
          {hasFilters && history.length !== filteredHistory.length && (
            <p className="text-xs text-autoforce-lightGrey mt-1.5">de {history.length} no total</p>
          )}
        </div>

        <div className="bg-gradient-to-br from-autoforce-darkest to-green-900/10 border border-autoforce-grey/20 p-5 rounded-2xl">
          <div className="flex items-start justify-between mb-4">
            <p className="text-[11px] font-bold text-autoforce-lightGrey uppercase tracking-widest">Total MRR</p>
            <div className="p-2 rounded-xl bg-green-500/15 text-green-400"><TrendingUp size={16} /></div>
          </div>
          <p className="text-3xl font-black text-green-400">{formatCurrency(totalMRR)}</p>
          <p className="text-xs text-autoforce-lightGrey mt-1.5">receita mensal recorrente</p>
        </div>

        <div className="bg-gradient-to-br from-autoforce-darkest to-autoforce-darkBlue/20 border border-autoforce-grey/20 p-5 rounded-2xl">
          <div className="flex items-start justify-between mb-4">
            <p className="text-[11px] font-bold text-autoforce-lightGrey uppercase tracking-widest">Total Setup</p>
            <div className="p-2 rounded-xl bg-autoforce-blue/15 text-autoforce-blue"><Briefcase size={16} /></div>
          </div>
          <p className="text-3xl font-black text-white">{formatCurrency(totalSetup)}</p>
          <p className="text-xs text-autoforce-lightGrey mt-1.5">implantação</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-autoforce-blue" />
            <span className="text-sm font-bold text-white">Filtros</span>
            {hasFilters && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-autoforce-blue/15 text-autoforce-blue border border-autoforce-blue/20">
                {chips.length} ativo{chips.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-autoforce-lightGrey hover:text-white flex items-center gap-1 transition">
              <X size={12} /> Limpar tudo
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-autoforce-grey pointer-events-none" />
            <input type="text" placeholder="Buscar cliente..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
              className="w-full bg-autoforce-black text-white text-xs pl-8 pr-8 py-2.5 rounded-xl border border-autoforce-grey/25 focus:border-autoforce-blue/50 outline-none placeholder:text-autoforce-grey/50" />
            {filterSearch && (
              <button onClick={() => setFilterSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-autoforce-grey hover:text-white">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Vendedor */}
          <div className="relative">
            <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-autoforce-grey pointer-events-none" />
            <select value={filterVendedor} onChange={e => setFilterVendedor(e.target.value)}
              className="w-full bg-autoforce-black text-white text-xs pl-8 pr-3 py-2.5 rounded-xl border border-autoforce-grey/25 focus:border-autoforce-blue/50 outline-none appearance-none">
              <option value="">Todos vendedores</option>
              {vendedorOptions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Origem */}
          <div className="relative">
            <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-autoforce-grey pointer-events-none" />
            <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)}
              className="w-full bg-autoforce-black text-white text-xs pl-8 pr-3 py-2.5 rounded-xl border border-autoforce-grey/25 focus:border-autoforce-blue/50 outline-none appearance-none">
              <option value="">Todas origens</option>
              {originOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Período */}
          <div className="flex items-center gap-1.5">
            <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)}
              className="flex-1 bg-autoforce-black text-white text-xs px-2.5 py-2.5 rounded-xl border border-autoforce-grey/25 focus:border-autoforce-blue/50 outline-none min-w-0" />
            <span className="text-autoforce-grey text-xs flex-shrink-0">–</span>
            <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)}
              className="flex-1 bg-autoforce-black text-white text-xs px-2.5 py-2.5 rounded-xl border border-autoforce-grey/25 focus:border-autoforce-blue/50 outline-none min-w-0" />
          </div>
        </div>

        {/* Products */}
        {productOptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {productOptions.map(opt => {
              const active = filterProducts.includes(opt);
              return (
                <button key={opt} onClick={() => toggleProduct(opt)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                    active
                      ? 'bg-autoforce-blue/20 text-autoforce-blue border-autoforce-blue/40'
                      : 'bg-autoforce-black text-autoforce-lightGrey border-autoforce-grey/25 hover:text-white hover:border-autoforce-grey/50'
                  }`}>
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {/* Active chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-autoforce-grey/10">
            {chips.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-autoforce-blue/10 text-autoforce-blue border border-autoforce-blue/20">
                {c.label}
                <button onClick={c.clear} className="hover:text-white transition"><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-autoforce-grey/20 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar size={15} className="text-autoforce-lightGrey" />
            Histórico de Vendas
          </h3>
          <span className="text-xs text-autoforce-lightGrey">
            {filteredHistory.length} ganho{filteredHistory.length !== 1 ? 's' : ''}
            {hasFilters && history.length !== filteredHistory.length && ` de ${history.length}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-autoforce-grey/15">
                <th className="px-5 py-3 text-[10px] font-bold text-autoforce-grey uppercase tracking-widest whitespace-nowrap">Data</th>
                <th className="px-5 py-3 text-[10px] font-bold text-autoforce-grey uppercase tracking-widest">Cliente</th>
                <th className="px-5 py-3 text-[10px] font-bold text-autoforce-grey uppercase tracking-widest">Detalhes</th>
                <th className="px-5 py-3 text-[10px] font-bold text-autoforce-grey uppercase tracking-widest text-right">Setup</th>
                <th className="px-5 py-3 text-[10px] font-bold text-autoforce-grey uppercase tracking-widest text-right">MRR</th>
                <th className="px-5 py-3 text-[10px] font-bold text-autoforce-grey uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-autoforce-grey/10">
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center text-autoforce-lightGrey"><Loader2 className="animate-spin inline" size={20} /></td></tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Trophy size={32} className="mx-auto text-autoforce-grey/30 mb-3" />
                    <p className="text-autoforce-lightGrey text-sm">Nenhum ganho encontrado</p>
                    {hasFilters && <button onClick={clearFilters} className="mt-2 text-xs text-autoforce-blue hover:underline">Limpar filtros</button>}
                  </td>
                </tr>
              ) : paginatedHistory.map(entry => (
                <tr key={entry.id} onClick={() => setSelectedEntry(entry)}
                  className="cursor-pointer group hover:bg-autoforce-blue/5 transition-colors">
                  <td className="px-5 py-4 text-xs text-autoforce-lightGrey whitespace-nowrap">
                    {new Date(entry.date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-bold text-white text-sm group-hover:text-autoforce-blue transition-colors">{entry.businessName}</div>
                    {entry.leadEmail && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Link size={9} className="text-autoforce-blue/60" />
                        <span className="text-[11px] text-autoforce-blue/60">{entry.leadName || entry.leadEmail}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 max-w-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-autoforce-lightGrey">
                        <Globe size={10} />
                        <span>{entry.origin || '—'}</span>
                        {entry.closedBy && <><span className="text-autoforce-grey/30">·</span><span>{entry.closedBy}</span></>}
                      </div>
                      {(entry.product?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {entry.product.map(p => (
                            <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-autoforce-blue/10 text-autoforce-blue border border-autoforce-blue/15">{p}</span>
                          ))}
                        </div>
                      )}
                      {(entry.currentSupplier?.length ?? 0) > 0 && (
                        <p className="text-[11px] text-autoforce-grey/60">Anterior: {entry.currentSupplier!.join(', ')}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-xs text-autoforce-lightGrey whitespace-nowrap">
                    {formatCurrency(entry.setupValue)}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-sm font-bold text-green-400 whitespace-nowrap">
                    {formatCurrency(entry.mrrValue)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                      {entry.dealUrl && (
                        <a href={entry.dealUrl} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg text-autoforce-blue/50 hover:text-autoforce-blue hover:bg-autoforce-blue/10 transition" title="Pipedrive">
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button onClick={() => handleDelete(entry)} disabled={deletingId === entry.id}
                        className="p-1.5 rounded-lg text-red-400/40 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-30 transition" title="Remover">
                        {deletingId === entry.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                      <ChevronRight size={13} className="text-autoforce-grey/30 group-hover:text-autoforce-blue/50 transition-colors" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredHistory.length > pageSize && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-autoforce-grey/20">
            <span className="text-xs text-autoforce-lightGrey">Página {currentPage} de {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-autoforce-black text-white border border-autoforce-grey/25 disabled:opacity-30 hover:border-autoforce-grey/50 transition">
                Anterior
              </button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-autoforce-black text-white border border-autoforce-grey/25 disabled:opacity-30 hover:border-autoforce-grey/50 transition">
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
