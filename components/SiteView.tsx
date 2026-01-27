import React, { useMemo, useState, useEffect } from 'react';
import { LandingPage } from '../types';
import { DataService } from '../services/dataService';
import {
    ExternalLink, Activity, Calendar, Search,
    ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, MousePointerClick
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;
type SortKey = 'name' | 'users' | 'avgEngagementTime' | 'bounceRate' | 'totalClicks';

const SiteView: React.FC = () => {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('users');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [dateRange, setDateRange] = useState('30days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState<Array<{
    label: string;
    users: number;
    bounceRate: number;
    clicks: number;
    avgEngagementSeconds: number;
  }>>([]);
  const [summaryYear, setSummaryYear] = useState(() => new Date().getFullYear());
  const [summaryMonth, setSummaryMonth] = useState(() => new Date().getMonth());
  const [showMonths, setShowMonths] = useState(false);
  const [showQuarters, setShowQuarters] = useState(false);
  const [showYear, setShowYear] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const end = new Date();
    const start = new Date();
    let startDateStr = '';
    let endDateStr = end.toISOString().split('T')[0];

    if (dateRange === '7days') { start.setDate(end.getDate() - 7); startDateStr = start.toISOString().split('T')[0]; }
    else if (dateRange === '30days') { start.setDate(end.getDate() - 30); startDateStr = start.toISOString().split('T')[0]; }
    else if (dateRange === '90days') { start.setDate(end.getDate() - 90); startDateStr = start.toISOString().split('T')[0]; }
    else if (dateRange === 'custom') {
        if (!customStart || !customEnd) { setLoading(false); return; }
        startDateStr = customStart; endDateStr = customEnd;
    }

    const data = await DataService.getLandingPagesGA(startDateStr, endDateStr, 'site.autoforce.com');
    setPages(data);
    setLoading(false);
  };

  useEffect(() => {
    if (dateRange !== 'custom') fetchData();
    else if (dateRange === 'custom' && customStart && customEnd) fetchData();
  }, [dateRange, customStart, customEnd]);

  const parseTime = (timeStr: string | undefined) => {
      if (!timeStr || timeStr === '-') return 0;
      const minutesMatch = timeStr.match(/(\d+)m/);
      const secondsMatch = timeStr.match(/(\d+)s/);
      return (minutesMatch ? parseInt(minutesMatch[1]) * 60 : 0) + (secondsMatch ? parseInt(secondsMatch[1]) : 0);
  };

  const formatTime = (seconds: number) => {
      if (!Number.isFinite(seconds) || seconds <= 0) return '-';
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      if (mins > 0) return `${mins}m ${String(secs).padStart(2, '0')}s`;
      return `${secs}s`;
  };

  const startOfWeek = (date: Date) => {
      const day = date.getDay();
      const diff = (day + 6) % 7;
      const start = new Date(date);
      start.setDate(date.getDate() - diff);
      start.setHours(12, 0, 0, 0);
      return start;
  };

  const endOfWeek = (date: Date) => {
      const start = startOfWeek(date);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(12, 0, 0, 0);
      return end;
  };

  const formatDate = (date: Date) => {
      const dd = String(date.getDate()).padStart(2, '0');
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const yy = String(date.getFullYear()).slice(2);
      return `${dd}/${mm}/${yy}`;
  };

  const formatISO = (date: Date) => date.toISOString().split('T')[0];

  const monthLabel = (index: number) => {
      const labels = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      return labels[index] ?? '';
  };

  const monthBounds = (y: number, m: number) => {
      const start = new Date(y, m, 1, 12, 0, 0);
      const end = new Date(y, m + 1, 0, 12, 0, 0);
      return { start, end };
  };

  const yearOptions = useMemo(() => {
      const years = new Set<number>();
      pages.forEach(page => {
          years.add(summaryYear);
      });
      years.add(new Date().getFullYear());
      return Array.from(years.values()).sort((a, b) => b - a);
  }, [pages, summaryYear]);

  const buildSummaryPeriods = () => {
      const { start: monthStart, end: monthEnd } = monthBounds(summaryYear, summaryMonth);
      const weeks: { label: string; start: Date; end: Date }[] = [];
      const cursor = new Date(monthStart);
      while (cursor <= monthEnd) {
          const weekStart = startOfWeek(cursor);
          const weekEnd = endOfWeek(cursor);
          weeks.push({
              label: `Semana ${formatDate(weekStart)} a ${formatDate(weekEnd)}`,
              start: weekStart,
              end: weekEnd,
          });
          cursor.setDate(cursor.getDate() + 7);
      }

      const months = Array.from({ length: 12 }).map((_, idx) => {
          const bounds = monthBounds(summaryYear, idx);
          return { label: monthLabel(idx), start: bounds.start, end: bounds.end };
      });

      const quarters = [
          { label: `Q1/${summaryYear}`, start: new Date(summaryYear, 0, 1, 12, 0, 0), end: new Date(summaryYear, 3, 0, 12, 0, 0) },
          { label: `Q2/${summaryYear}`, start: new Date(summaryYear, 3, 1, 12, 0, 0), end: new Date(summaryYear, 6, 0, 12, 0, 0) },
          { label: `Q3/${summaryYear}`, start: new Date(summaryYear, 6, 1, 12, 0, 0), end: new Date(summaryYear, 9, 0, 12, 0, 0) },
          { label: `Q4/${summaryYear}`, start: new Date(summaryYear, 9, 1, 12, 0, 0), end: new Date(summaryYear, 12, 0, 12, 0, 0) },
      ];

      const yearRow = { label: `${summaryYear}`, start: new Date(summaryYear, 0, 1, 12, 0, 0), end: new Date(summaryYear, 12, 0, 12, 0, 0) };

      return { weeks, months, quarters, yearRow };
  };

  useEffect(() => {
      const loadSummary = async () => {
          setSummaryLoading(true);
          try {
              const { weeks, months, quarters, yearRow } = buildSummaryPeriods();
              const periods = [...weeks, ...months, ...quarters, yearRow];
              const results = await Promise.allSettled(
                  periods.map(async (period) => {
                      const data = await DataService.getLandingPagesGA(formatISO(period.start), formatISO(period.end), 'site.autoforce.com');
                      const totals = data.reduce(
                          (acc, page) => {
                              const users = page.users || 0;
                              acc.users += users;
                              acc.clicks += page.totalClicks || 0;
                              acc.bounceWeighted += (page.bounceRate || 0) * users;
                              acc.timeWeighted += parseTime(page.avgEngagementTime) * users;
                              return acc;
                          },
                          { users: 0, clicks: 0, bounceWeighted: 0, timeWeighted: 0 }
                      );
                      const bounceRate = totals.users > 0 ? totals.bounceWeighted / totals.users : 0;
                      const avgEngagementSeconds = totals.users > 0 ? totals.timeWeighted / totals.users : 0;
                      return {
                          label: period.label,
                          users: totals.users,
                          clicks: totals.clicks,
                          bounceRate,
                          avgEngagementSeconds,
                      };
                  })
              );
              const rows = results.map((result, index) => {
                  if (result.status === 'fulfilled') return result.value;
                  console.error('Erro ao carregar resumo do site:', result.reason);
                  return {
                      label: periods[index].label,
                      users: 0,
                      clicks: 0,
                      bounceRate: 0,
                      avgEngagementSeconds: 0,
                  };
              });
              setSummaryRows(rows);
          } catch (error) {
              console.error('Erro ao montar resumo do site:', error);
              setSummaryRows([]);
          } finally {
              setSummaryLoading(false);
          }
      };

      loadSummary();
  }, [summaryYear, summaryMonth]);

  const summaryMap = useMemo(() => {
      const map = new Map<string, typeof summaryRows[number]>();
      summaryRows.forEach(row => map.set(row.label, row));
      return map;
  }, [summaryRows]);

  const summaryPeriods = useMemo(() => buildSummaryPeriods(), [summaryYear, summaryMonth]);

  const filteredPages = pages.filter(page => {
      const searchLower = searchTerm.toLowerCase();
      return (page.name || '').toLowerCase().includes(searchLower) || (page.path || '').toLowerCase().includes(searchLower);
  });

  const sortedPages = [...filteredPages].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortKey) {
          case 'name': valA = (a.name || a.path || '').toLowerCase(); valB = (b.name || b.path || '').toLowerCase(); break;
          case 'users': valA = a.users || 0; valB = b.users || 0; break;
          case 'avgEngagementTime': valA = parseTime(a.avgEngagementTime); valB = parseTime(b.avgEngagementTime); break;
          case 'bounceRate': valA = a.bounceRate || 0; valB = b.bounceRate || 0; break;
          case 'totalClicks': valA = a.totalClicks || 0; valB = b.totalClicks || 0; break;
          default: return 0;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
  });

  const totalPages = Math.ceil(sortedPages.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPages = sortedPages.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleSort = (key: SortKey) => {
      if (sortKey === key) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
      else { setSortKey(key); setSortDirection('desc'); }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
      if (sortKey !== columnKey) return <ArrowUpDown size={12} className="opacity-30 ml-1" />;
      return sortDirection === 'asc' ? <ArrowUp size={12} className="text-autoforce-blue ml-1" /> : <ArrowDown size={12} className="text-autoforce-blue ml-1" />;
  };

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in-up">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-4 bg-autoforce-darkest p-6 rounded-xl border border-autoforce-grey/20">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-[#E37400] rounded-full flex items-center justify-center"><Activity size={14} className="text-white" /></div>
                    <h2 className="text-xl font-bold text-white">Site AutoForce (site.autoforce.com)</h2>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500' : 'bg-green-500'} animate-pulse`}></span>
                    <span className="text-xs text-autoforce-lightGrey font-bold uppercase tracking-wider">{loading ? 'Sincronizando...' : 'Dados Atualizados'}</span>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row items-end gap-3 w-full xl:w-auto">
                 <div className="relative flex-1 w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-autoforce-lightGrey" size={16} />
                    <input type="text" placeholder="Buscar pagina..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full bg-autoforce-black border border-autoforce-grey/30 text-white pl-9 pr-4 py-1.5 rounded-lg text-sm focus:border-autoforce-blue outline-none" />
                 </div>
                 <div className="flex items-center gap-2 bg-autoforce-black p-1.5 rounded-lg border border-autoforce-grey/30">
                    <Calendar size={14} className="text-autoforce-lightGrey ml-2"/>
                    <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="bg-autoforce-black text-white text-xs font-bold outline-none cursor-pointer p-1">
                        <option className="bg-autoforce-darkest text-white" value="7days">Ultimos 7 dias</option>
                        <option className="bg-autoforce-darkest text-white" value="30days">Ultimos 30 dias</option>
                        <option className="bg-autoforce-darkest text-white" value="90days">Ultimos 90 dias</option>
                        <option className="bg-autoforce-darkest text-white" value="custom">Personalizado</option>
                    </select>
                </div>
                {dateRange === 'custom' && (
                    <div className="flex items-center gap-2 animate-fade-in-left">
                        <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="bg-autoforce-black border border-autoforce-grey/30 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-autoforce-blue" />
                        <span className="text-autoforce-grey">-</span>
                        <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="bg-autoforce-black border border-autoforce-grey/30 text-white text-xs rounded px-2 py-1.5 outline-none focus:border-autoforce-blue" />
                    </div>
                )}
            </div>
        </div>

        <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-lg overflow-hidden shadow-lg flex flex-col">
            <div className="p-6 border-b border-autoforce-grey/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-autoforce-lightGrey">
                    <Activity size={16} className="text-autoforce-accent" />
                    <span className="text-sm font-bold">Indicadores gerais do site</span>
                </div>
                <div className="flex items-center gap-2">
                    <select value={summaryYear} onChange={(e) => setSummaryYear(Number(e.target.value))} className="bg-autoforce-black/50 border border-autoforce-grey/20 rounded-full px-3 py-1.5 text-xs text-white">
                        {yearOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                    <select value={summaryMonth} onChange={(e) => setSummaryMonth(Number(e.target.value))} className="bg-autoforce-black/50 border border-autoforce-grey/20 rounded-full px-3 py-1.5 text-xs text-white">
                        {Array.from({ length: 12 }).map((_, index) => (
                            <option key={index} value={index}>{monthLabel(index)}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm table-fixed">
                    <colgroup>
                        <col className="w-[26%]" />
                        <col className="w-[12%]" />
                        <col className="w-[12%]" />
                        <col className="w-[10%]" />
                        <col className="w-[14%]" />
                        <col className="w-[13%]" />
                        <col className="w-[13%]" />
                    </colgroup>
                    <thead className="text-[11px] uppercase tracking-wider text-autoforce-lightGrey border-b border-autoforce-grey/20">
                        <tr>
                            <th className="py-2 pr-4">Semanas</th>
                            <th className="py-2 pr-4 text-center">Visitas (Usuarios ativos)</th>
                            <th className="py-2 pr-4 text-center">Taxa Rejeição</th>
                            <th className="py-2 pr-4 text-center">Cliques</th>
                            <th className="py-2 pr-4 text-center">Tempo Medio Permanencia</th>
                            <th className="py-2 pr-4 text-center">Respostas formulario</th>
                            <th className="py-2 text-center">PageSpeed (Mobile)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-autoforce-grey/10">
                        {summaryLoading ? (
                            <tr><td colSpan={7} className="py-6 text-center text-autoforce-lightGrey">Carregando indicadores...</td></tr>
                        ) : summaryRows.length === 0 ? (
                            <tr><td colSpan={7} className="py-6 text-center text-autoforce-lightGrey">Sem dados para o período.</td></tr>
                        ) : (
                            <>
                                {summaryPeriods.weeks.map((period) => {
                                    const row = summaryMap.get(period.label);
                                    if (!row) return null;
                                    return (
                                        <tr key={row.label} className="text-sm text-white">
                                            <td className="py-3 pr-4 truncate">{row.label}</td>
                                            <td className="py-3 pr-4 text-center">{row.users.toLocaleString()}</td>
                                            <td className="py-3 pr-4 text-center">{row.bounceRate ? `${row.bounceRate.toFixed(2)}%` : '—'}</td>
                                            <td className="py-3 pr-4 text-center">{row.clicks.toLocaleString()}</td>
                                            <td className="py-3 pr-4 text-center">{formatTime(row.avgEngagementSeconds)}</td>
                                            <td className="py-3 pr-4 text-center">—</td>
                                            <td className="py-3 text-center">—</td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-autoforce-blue/10 text-white text-xs uppercase tracking-wider">
                                    <td colSpan={7} className="py-2 px-3">
                                        <button type="button" onClick={() => setShowMonths(prev => !prev)} className="hover:text-white">
                                            Meses
                                        </button>
                                    </td>
                                </tr>
                                {showMonths && summaryPeriods.months.map((period) => {
                                    const row = summaryMap.get(period.label);
                                    if (!row) return null;
                                    return (
                                        <tr key={row.label} className="text-sm text-white">
                                            <td className="py-3 pr-4 truncate">{row.label}</td>
                                            <td className="py-3 pr-4 text-center">{row.users.toLocaleString()}</td>
                                            <td className="py-3 pr-4 text-center">{row.bounceRate ? `${row.bounceRate.toFixed(2)}%` : '—'}</td>
                                            <td className="py-3 pr-4 text-center">{row.clicks.toLocaleString()}</td>
                                            <td className="py-3 pr-4 text-center">{formatTime(row.avgEngagementSeconds)}</td>
                                            <td className="py-3 pr-4 text-center">—</td>
                                            <td className="py-3 text-center">—</td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-autoforce-blue/10 text-white text-xs uppercase tracking-wider">
                                    <td colSpan={7} className="py-2 px-3">
                                        <button type="button" onClick={() => setShowQuarters(prev => !prev)} className="hover:text-white">
                                            Trimestres
                                        </button>
                                    </td>
                                </tr>
                                {showQuarters && summaryPeriods.quarters.map((period) => {
                                    const row = summaryMap.get(period.label);
                                    if (!row) return null;
                                    return (
                                        <tr key={row.label} className="text-sm text-white">
                                            <td className="py-3 pr-4 truncate">{row.label}</td>
                                            <td className="py-3 pr-4 text-center">{row.users.toLocaleString()}</td>
                                            <td className="py-3 pr-4 text-center">{row.bounceRate ? `${row.bounceRate.toFixed(2)}%` : '—'}</td>
                                            <td className="py-3 pr-4 text-center">{row.clicks.toLocaleString()}</td>
                                            <td className="py-3 pr-4 text-center">{formatTime(row.avgEngagementSeconds)}</td>
                                            <td className="py-3 pr-4 text-center">—</td>
                                            <td className="py-3 text-center">—</td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-autoforce-blue/10 text-white text-xs uppercase tracking-wider">
                                    <td colSpan={7} className="py-2 px-3">
                                        <button type="button" onClick={() => setShowYear(prev => !prev)} className="hover:text-white">
                                            Ano
                                        </button>
                                    </td>
                                </tr>
                                {showYear && (() => {
                                    const row = summaryMap.get(summaryPeriods.yearRow.label);
                                    if (!row) return null;
                                    return (
                                        <tr key={row.label} className="text-sm text-white">
                                            <td className="py-3 pr-4 truncate">{row.label}</td>
                                            <td className="py-3 pr-4 text-center">{row.users.toLocaleString()}</td>
                                            <td className="py-3 pr-4 text-center">{row.bounceRate ? `${row.bounceRate.toFixed(2)}%` : '—'}</td>
                                            <td className="py-3 pr-4 text-center">{row.clicks.toLocaleString()}</td>
                                            <td className="py-3 pr-4 text-center">{formatTime(row.avgEngagementSeconds)}</td>
                                            <td className="py-3 pr-4 text-center">—</td>
                                            <td className="py-3 text-center">—</td>
                                        </tr>
                                    );
                                })()}
                            </>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-lg overflow-hidden shadow-lg flex flex-col min-h-[400px]">
            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-autoforce-lightGrey gap-4">
                    <div className="w-8 h-8 border-4 border-autoforce-blue border-t-transparent rounded-full animate-spin"></div>
                    <p>Buscando dados do site...</p>
                </div>
            ) : (
                <>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-autoforce-black/40 text-autoforce-lightGrey text-xs uppercase tracking-wider border-b border-autoforce-grey/20">
                                <th className="p-4 cursor-pointer hover:text-white" onClick={() => handleSort('name')}><div className="flex items-center">Caminho <SortIcon columnKey="name"/></div></th>
                                <th className="p-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('users')}><div className="flex items-center justify-end">Usuarios ativos <SortIcon columnKey="users"/></div></th>
                                <th className="p-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('totalClicks')}><div className="flex items-center justify-end">Cliques <SortIcon columnKey="totalClicks"/></div></th>
                                <th className="p-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('avgEngagementTime')}><div className="flex items-center justify-end">Tempo medio <SortIcon columnKey="avgEngagementTime"/></div></th>
                                <th className="p-4 text-right cursor-pointer hover:text-white" onClick={() => handleSort('bounceRate')}><div className="flex items-center justify-end">Bounce <SortIcon columnKey="bounceRate"/></div></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-autoforce-grey/10">
                            {paginatedPages.length > 0 ? (
                                paginatedPages.map((page) => (
                                    <tr key={page.id} className="hover:bg-autoforce-blue/5 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-white text-sm md:text-base line-clamp-1" title={page.name}>{page.name || page.path}</span>
                                                <div className="flex items-center gap-1 mt-1 text-xs text-autoforce-blue"><span className="line-clamp-1 max-w-[200px]">{page.path}</span><ExternalLink size={10} /></div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right text-white font-mono">{page.users.toLocaleString()}</td>
                                        <td className="p-4 text-right text-autoforce-lightGrey font-mono"><div className="flex items-center justify-end gap-1"><MousePointerClick size={12} className="opacity-50"/>{(page.totalClicks || 0).toLocaleString()}</div></td>
                                        <td className="p-4 text-right text-autoforce-lightGrey">{page.avgEngagementTime || '-'}</td>
                                        <td className="p-4 text-right"><span className={`px-2 py-1 rounded text-xs font-bold ${ (page.bounceRate || 0) > 50 ? 'bg-red-900/30 text-red-400' : 'text-autoforce-lightGrey'}`}>{(page.bounceRate || 0)}%</span></td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={5} className="p-8 text-center text-autoforce-lightGrey">Nenhuma pagina encontrada.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-autoforce-grey/20 flex items-center justify-between bg-autoforce-black/20 mt-auto">
                    <span className="text-xs text-autoforce-lightGrey">{paginatedPages.length > 0 ? `Exibindo ${startIndex + 1}-${Math.min(startIndex + ITEMS_PER_PAGE, sortedPages.length)} de ${sortedPages.length}` : '0 resultados'}</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={18} /></button>
                        <span className="text-sm font-bold text-white px-2">Pag {currentPage}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded hover:bg-white/10 text-white disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={18} /></button>
                    </div>
                </div>
                </>
            )}
        </div>
    </div>
  );
};

export default SiteView;
