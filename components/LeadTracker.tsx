import React, { useState, useEffect, useMemo } from 'react';
import { DailyLeadEntry } from '../types';
import { DataService } from '../services/dataService';
import { Calendar, Save, TrendingUp, Filter, Plus, FileSpreadsheet, Loader2, X, Calculator, ChevronLeft, ChevronRight } from 'lucide-react';

const ITEMS_PER_PAGE = 7; // Define quantos itens aparecem por página

const LeadTracker: React.FC = () => {
  const [history, setHistory] = useState<DailyLeadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados da Paginação
// Agora ele tenta ler do navegador antes de usar o 1
const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('leads_current_page');
    return saved ? Number(saved) : 1;
});

// Salva no navegador sempre que mudar a página
useEffect(() => {
    localStorage.setItem('leads_current_page', currentPage.toString());
}, [currentPage]);


  // Form State
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [mqlInput, setMqlInput] = useState<number>(0);
  const [sqlInput, setSqlInput] = useState<number>(0);
  
  // Filters State
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  // 🧮 CÁLCULO AUTOMÁTICO DA CONVERSÃO DO INPUT
  const currentConversion = mqlInput > 0 ? (sqlInput / mqlInput) * 100 : 0;

  useEffect(() => {
    loadHistory();
  }, []);

  // Volta para página 1 se mudar o filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStart, filterEnd]);

  // Preenche o formulário se selecionar uma data que já existe
  useEffect(() => {
    if (history && Array.isArray(history)) {
        const existingEntry = history.find(h => h.date.startsWith(selectedDate));
        if (existingEntry) {
            setMqlInput(existingEntry.mql || 0);
            setSqlInput(existingEntry.sql || 0);
        } else {
            setMqlInput(0);
            setSqlInput(0);
        }
    }
  }, [selectedDate, history]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await DataService.getDailyLeadsHistory();
      setHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
        await DataService.saveDailyLeadEntry({
            date: selectedDate,
            mql: mqlInput,
            sql: sqlInput,
            sales: 0,
            conversionRate: currentConversion
        });
        await loadHistory();
    } catch (err) {
        console.error(err);
    } finally {
        setSaving(false);
    }
  };

  // --- LÓGICA DE FILTROS E PAGINAÇÃO ---

  const clearFilters = () => {
      setFilterStart('');
      setFilterEnd('');
  };

  // 1. Aplica o filtro de data
  const filteredHistory = useMemo(() => {
      const list = Array.isArray(history) ? history : [];
      return list.filter(entry => {
          if (!filterStart && !filterEnd) return true;
          const entryDate = new Date(entry.date);
          const start = filterStart ? new Date(filterStart) : new Date('1900-01-01');
          const end = filterEnd ? new Date(filterEnd) : new Date('2100-12-31');
          end.setHours(23, 59, 59, 999);
          
          const entryTime = entryDate.getTime();
          return entryTime >= start.getTime() && entryTime <= end.getTime();
      });
  }, [history, filterStart, filterEnd]);

  // 2. Calcula Totais do Período Filtrado
  const periodTotals = useMemo(() => {
      return filteredHistory.reduce((acc, curr) => ({
          mql: acc.mql + (curr.mql || 0),
          sql: acc.sql + (curr.sql || 0),
      }), { mql: 0, sql: 0 });
  }, [filteredHistory]);

  // 3. Aplica a Paginação
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedData = filteredHistory.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
  );

  const goToNextPage = () => setCurrentPage(p => Math.min(p + 1, totalPages));
  const goToPrevPage = () => setCurrentPage(p => Math.max(p - 1, 1));


  // --- FORMATADORES ---
  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  const fmtDate = (d: string) => {
      if(!d) return '-';
      const parts = d.split('-'); 
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`; 
      const dateObj = new Date(d);
      if(!isNaN(dateObj.getTime())) return dateObj.toLocaleDateString('pt-BR');
      return d;
  }

  // --- ESTATÍSTICAS DO CARD SUPERIOR (Mantido) ---
  const stats = useMemo(() => {
    const target = new Date(selectedDate);
    if (isNaN(target.getTime())) {
        return {
            day: { mql: 0, sql: 0, sales: 0, conversion: 0 },
            week: { mql: 0, sql: 0, sales: 0, conversion: 0 },
            month: { mql: 0, sql: 0, sales: 0, conversion: 0 },
        };
    }

    const targetMonth = target.getMonth();
    const targetYear = target.getFullYear();
    const dayOfWeek = target.getDay(); 
    const startOfWeek = new Date(target);
    startOfWeek.setDate(target.getDate() - dayOfWeek);
    startOfWeek.setHours(0,0,0,0);
    const endOfTargetDay = new Date(target);
    endOfTargetDay.setHours(23, 59, 59, 999);

    let dayMql = mqlInput || 0;
    let daySql = sqlInput || 0; 
    let weekMql = dayMql; let weekSql = daySql;
    let monthMql = dayMql; let monthSql = daySql;

    const safeHistory = Array.isArray(history) ? history : [];

    safeHistory.forEach(entry => {
        if (entry.date.startsWith(selectedDate)) return; 
        const entryDate = new Date(entry.date); 

        if (entryDate >= startOfWeek && entryDate <= endOfTargetDay) {
            weekMql += (entry.mql || 0);
            weekSql += (entry.sql || 0);
        }
        if (entryDate.getMonth() === targetMonth && entryDate.getFullYear() === targetYear && entryDate <= endOfTargetDay) {
            monthMql += (entry.mql || 0);
            monthSql += (entry.sql || 0);
        }
    });

    const calcConv = (m: number, s: number) => m > 0 ? (s / m) * 100 : 0;

    return {
        day: { mql: dayMql, sql: daySql, sales: 0, conversion: calcConv(dayMql, daySql) },
        week: { mql: weekMql, sql: weekSql, sales: 0, conversion: calcConv(weekMql, weekSql) },
        month: { mql: monthMql, sql: monthSql, sales: 0, conversion: calcConv(monthMql, monthSql) },
    };
  }, [history, selectedDate, mqlInput, sqlInput]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in-up">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="text-autoforce-blue" />
                    Acompanhamento Diário
                </h2>
                <p className="text-autoforce-lightGrey text-sm">Registro e controle de leads diários.</p>
            </div>
        </div>

        {/* Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Formulário de Input */}
            <div className="lg:col-span-4 bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6 shadow-lg h-fit">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <Plus size={16} className="text-autoforce-accent"/>
                    Registro de Dados
                </h3>
                
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Data</label>
                        <div className="relative">
                            <input 
                                type="date" 
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded-lg px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none"
                            />
                            <Calendar className="absolute right-3 top-2.5 text-autoforce-grey pointer-events-none" size={16} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">MQLs</label>
                            <input 
                                type="number" 
                                min="0"
                                value={mqlInput}
                                onChange={(e) => setMqlInput(Number(e.target.value))}
                                className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded-lg px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">SQLs</label>
                            <input 
                                type="number" 
                                min="0"
                                value={sqlInput}
                                onChange={(e) => setSqlInput(Number(e.target.value))}
                                className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded-lg px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none font-mono"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Calculator size={12}/> Taxa de Conversão
                        </label>
                        <input 
                            type="text" 
                            readOnly
                            disabled
                            value={`${currentConversion.toFixed(1)}%`}
                            className="w-full bg-autoforce-blue/10 border border-autoforce-blue/30 rounded-lg px-3 py-2 text-autoforce-blue font-bold focus:outline-none cursor-not-allowed text-center"
                        />
                    </div>

                    <div className="pt-2">
                        <button 
                            type="submit" 
                            disabled={saving}
                            className="w-full bg-autoforce-blue hover:bg-autoforce-secondary text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-autoforce-blue/20"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18} />}
                            {saving ? 'Salvando...' : 'Salvar Dados'}
                        </button>
                    </div>
                </form>
            </div>

            {/* CARD DE VISÃO GERAL (Direita) */}
            <div className="lg:col-span-8 space-y-4">
                <div className="bg-white rounded-lg overflow-hidden border border-autoforce-grey/20 text-autoforce-black shadow-lg">
                    <div className="bg-autoforce-blue px-6 py-3 flex justify-between items-center text-white">
                        <span className="font-bold flex items-center gap-2">
                            <TrendingUp size={18} className="text-autoforce-yellow" />
                            Performance Consolidada
                        </span>
                        <span className="text-xs bg-white/20 px-2 py-1 rounded">Ref: {fmtDate(selectedDate)}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-200">
                        {/* Dia */}
                        <div className="p-4 flex flex-col items-center">
                            <h4 className="text-xs font-bold text-autoforce-blue uppercase tracking-wider mb-4 bg-blue-50 px-2 py-1 rounded w-full text-center">Dia {fmtDate(selectedDate)}</h4>
                            <div className="space-y-3 w-full max-w-[150px]">
                                <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                                    <span className="text-xs text-gray-500 font-semibold">MQL</span>
                                    <span className="font-bold">{stats.day.mql}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                                    <span className="text-xs text-gray-500 font-semibold">SQL</span>
                                    <span className="font-bold">{stats.day.sql}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-500 font-semibold">Conv.</span>
                                    <span className={`font-bold ${stats.day.conversion > 10 ? 'text-green-600' : 'text-gray-800'}`}>{fmt(stats.day.conversion)}</span>
                                </div>
                            </div>
                        </div>
                        {/* Semana */}
                        <div className="p-4 flex flex-col items-center bg-gray-50/50">
                            <h4 className="text-xs font-bold text-autoforce-blue uppercase tracking-wider mb-4 bg-blue-50 px-2 py-1 rounded w-full text-center">Semana Atual</h4>
                            <div className="space-y-3 w-full max-w-[150px]">
                                <div className="flex justify-between items-center border-b border-gray-200 pb-1">
                                    <span className="text-xs text-gray-500 font-semibold">MQL</span>
                                    <span className="font-bold">{stats.week.mql}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-gray-200 pb-1">
                                    <span className="text-xs text-gray-500 font-semibold">SQL</span>
                                    <span className="font-bold">{stats.week.sql}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-500 font-semibold">Conv.</span>
                                    <span className={`font-bold ${stats.week.conversion > 10 ? 'text-green-600' : 'text-gray-800'}`}>{fmt(stats.week.conversion)}</span>
                                </div>
                            </div>
                        </div>
                        {/* Mês */}
                        <div className="p-4 flex flex-col items-center">
                            <h4 className="text-xs font-bold text-autoforce-blue uppercase tracking-wider mb-4 bg-blue-50 px-2 py-1 rounded w-full text-center">Mês Atual</h4>
                            <div className="space-y-3 w-full max-w-[150px]">
                                <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                                    <span className="text-xs text-gray-500 font-semibold">MQL</span>
                                    <span className="font-bold">{stats.month.mql}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                                    <span className="text-xs text-gray-500 font-semibold">SQL</span>
                                    <span className="font-bold">{stats.month.sql}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-500 font-semibold">Conv.</span>
                                    <span className={`font-bold ${stats.month.conversion > 10 ? 'text-green-600' : 'text-gray-800'}`}>{fmt(stats.month.conversion)}</span>
                                </div>
                                <div className="w-full bg-gray-200 h-1.5 rounded-full mt-2">
                                     <div className="h-full bg-autoforce-accent rounded-full" style={{width: `${Math.min(stats.month.conversion, 100)}%`}}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* --- TABELA DE HISTÓRICO --- */}
        <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl overflow-hidden flex flex-col">
            
            {/* Header com Filtros */}
            <div className="p-6 border-b border-autoforce-grey/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="text-white font-bold flex items-center gap-2">
                    <Calendar size={18} className="text-autoforce-lightGrey" />
                    Histórico Completo
                </h3>
                
                <div className="flex items-center gap-2 bg-autoforce-black/50 p-1.5 rounded-lg border border-autoforce-grey/30">
                    <div className="flex items-center gap-2 px-2">
                        <Filter size={14} className="text-autoforce-blue" />
                        <span className="text-xs font-bold text-autoforce-lightGrey uppercase">Filtro:</span>
                    </div>
                    <input 
                        type="date" 
                        value={filterStart}
                        onChange={(e) => setFilterStart(e.target.value)}
                        className="bg-autoforce-darkest text-white text-xs px-2 py-1.5 rounded border border-autoforce-grey/30 focus:border-autoforce-blue outline-none"
                    />
                    <span className="text-autoforce-grey text-xs">até</span>
                    <input 
                        type="date" 
                        value={filterEnd}
                        onChange={(e) => setFilterEnd(e.target.value)}
                        className="bg-autoforce-darkest text-white text-xs px-2 py-1.5 rounded border border-autoforce-grey/30 focus:border-autoforce-blue outline-none"
                    />
                    {(filterStart || filterEnd) && (
                        <button onClick={clearFilters} className="text-autoforce-lightGrey hover:text-white p-1">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* RESUMO DO PERÍODO SELECIONADO (NOVA PARTE) */}
            <div className="bg-autoforce-blue/5 border-b border-autoforce-blue/10 px-6 py-3 flex gap-8 items-center text-sm">
                <span className="text-autoforce-lightGrey font-bold uppercase text-xs">Total no Período:</span>
                <div className="flex gap-2 items-center">
                    <span className="text-autoforce-grey">MQL:</span>
                    <span className="text-white font-bold">{periodTotals.mql}</span>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="text-autoforce-grey">SQL:</span>
                    <span className="text-white font-bold">{periodTotals.sql}</span>
                </div>
                <div className="flex gap-2 items-center">
                    <span className="text-autoforce-grey">Média Conv:</span>
                    <span className="text-white font-bold">
                        {periodTotals.mql > 0 
                            ? ((periodTotals.sql / periodTotals.mql) * 100).toFixed(1) 
                            : '0.0'}%
                    </span>
                </div>
            </div>
            
            {/* Tabela */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-autoforce-black/50 text-autoforce-grey text-xs uppercase font-bold">
                        <tr>
                            <th className="p-4">Data</th>
                            <th className="p-4 text-center">MQL</th>
                            <th className="p-4 text-center">SQL</th>
                            <th className="p-4 text-right">Taxa Conv.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-autoforce-grey/10">
                        {loading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-autoforce-lightGrey">Carregando histórico...</td></tr>
                        ) : filteredHistory.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-autoforce-lightGrey">Nenhum registro encontrado no período.</td></tr>
                        ) : (
                            paginatedData.map((entry) => (
                                <tr key={entry.id} className="hover:bg-autoforce-blue/5 transition-colors">
                                    <td className="p-4 text-white font-medium border-l-4 border-transparent hover:border-autoforce-accent">{fmtDate(entry.date)}</td>
                                    <td className="p-4 text-center text-autoforce-lightGrey">{entry.mql}</td>
                                    <td className="p-4 text-center text-white font-bold">{entry.sql}</td>
                                    <td className="p-4 text-right">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${entry.conversionRate > 15 ? 'bg-green-900/40 text-green-400' : 'bg-autoforce-blue/10 text-autoforce-blue'}`}>
                                            {fmt(entry.conversionRate)}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* RODAPÉ DA PAGINAÇÃO */}
            {filteredHistory.length > 0 && (
                <div className="p-4 border-t border-autoforce-grey/20 flex justify-between items-center bg-autoforce-black/30">
                    <span className="text-xs text-autoforce-grey">
                        Mostrando página <span className="text-white font-bold">{currentPage}</span> de {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button 
                            onClick={goToPrevPage}
                            disabled={currentPage === 1}
                            className="p-2 rounded bg-autoforce-black border border-autoforce-grey/30 text-white hover:bg-autoforce-blue hover:border-autoforce-blue disabled:opacity-50 disabled:hover:bg-autoforce-black transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button 
                            onClick={goToNextPage}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded bg-autoforce-black border border-autoforce-grey/30 text-white hover:bg-autoforce-blue hover:border-autoforce-blue disabled:opacity-50 disabled:hover:bg-autoforce-black transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>

    </div>
  );
};

export default LeadTracker;
