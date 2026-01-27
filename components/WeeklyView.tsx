import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, BarChart3, Filter } from 'lucide-react';
import { DataService } from '../services/dataService';
import { DailyLeadEntry, RevenueEntry, MetaCampaign } from '../types';

const WeeklyView: React.FC = () => {
  const [dailyLeads, setDailyLeads] = useState<DailyLeadEntry[]>([]);
  const [revenueHistory, setRevenueHistory] = useState<RevenueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaRows, setMetaRows] = useState<Array<{
    label: string;
    start: Date;
    end: Date;
    spend: number;
    clicks: number;
    cpc: number;
    contracts: number;
    mrr: number;
  }>>([]);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [campaignDetails, setCampaignDetails] = useState<Record<string, {
    loading: boolean;
    rows: Array<{
      label: string;
      spend: number;
      ctr: number;
      reach: number;
      impressions: number;
      cpc: number;
      cpm: number;
    }>;
  }>>({});
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth()); // 0-11
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [leadsData, revenueData] = await Promise.all([
          DataService.getDailyLeadsHistory(),
          DataService.getRevenueHistory(),
        ]);
        setDailyLeads(Array.isArray(leadsData) ? leadsData : []);
        setRevenueHistory(Array.isArray(revenueData) ? revenueData : []);
      } catch (error) {
        console.error('Erro ao carregar leads diários:', error);
        setDailyLeads([]);
        setRevenueHistory([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        const start = new Date(year, 0, 1, 12, 0, 0);
        const end = new Date(year, 11, 31, 12, 0, 0);
        const data = await DataService.getMetaCampaigns(formatISO(start), formatISO(end));
        setCampaigns(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Erro ao carregar campanhas da Meta:', error);
        setCampaigns([]);
      }
    };

    loadCampaigns();
  }, [year]);

  const parseDateOnly = (value: string) => {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  };

  const startOfWeek = (date: Date) => {
    const day = date.getDay(); // 0 domingo
    const diff = (day + 6) % 7; // 0 segunda, 6 domingo
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const monthLabel = (index: number) => {
    const labels = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return labels[index] ?? '';
  };

  const monthBounds = (y: number, m: number) => {
    const start = new Date(y, m, 1, 12, 0, 0);
    const end = new Date(y, m + 1, 0, 12, 0, 0);
    return { start, end };
  };

  const buildWeeklyRows = (items: DailyLeadEntry[], range?: { start: Date; end: Date }) => {
    const map = new Map<string, { start: Date; end: Date; leads: number; mql: number; sql: number }>();
    items.forEach(entry => {
      if (!entry.date) return;
      const date = parseDateOnly(entry.date);
      if (range && (date < range.start || date > range.end)) return;
      const weekStart = startOfWeek(date);
      const key = weekStart.toISOString().split('T')[0];
      const existing = map.get(key) || { start: weekStart, end: endOfWeek(date), leads: 0, mql: 0, sql: 0 };
      existing.leads += entry.leads || 0;
      existing.mql += entry.mql || 0;
      existing.sql += entry.sql || 0;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.start.getTime() - a.start.getTime());
  };

  const buildMonthlyRows = (items: DailyLeadEntry[], range?: { start: Date; end: Date }) => {
    const map = new Map<string, { label: string; start: Date; leads: number; mql: number; sql: number }>();
    items.forEach(entry => {
      if (!entry.date) return;
      const date = parseDateOnly(entry.date);
      if (range && (date < range.start || date > range.end)) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = monthLabel(date.getMonth());
      const start = new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0);
      const existing = map.get(key) || { label, start, leads: 0, mql: 0, sql: 0 };
      existing.leads += entry.leads || 0;
      existing.mql += entry.mql || 0;
      existing.sql += entry.sql || 0;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.start.getTime() - a.start.getTime());
  };

  const rangeFilter = useMemo(() => {
    if (!rangeStart && !rangeEnd) return null;
    const start = rangeStart ? parseDateOnly(rangeStart) : new Date(1900, 0, 1, 12, 0, 0);
    const end = rangeEnd ? parseDateOnly(rangeEnd) : new Date(2100, 11, 31, 12, 0, 0);
    return start <= end ? { start, end } : { start: end, end: start };
  }, [rangeStart, rangeEnd]);

  const selectedMonthRange = useMemo(() => monthBounds(year, month), [year, month]);

  const weeklyRows = useMemo(() => {
    const allWeeks = buildWeeklyRows(dailyLeads);
    return allWeeks.filter(week => {
      const intersectsMonth = week.start <= selectedMonthRange.end && week.end >= selectedMonthRange.start;
      return intersectsMonth;
    });
  }, [dailyLeads, selectedMonthRange.end, selectedMonthRange.start]);

  const monthlyRows = useMemo(() => {
    return buildMonthlyRows(dailyLeads).filter(row => row.start.getFullYear() === year);
  }, [dailyLeads, year]);

  const historyWeekly = useMemo(() => {
    if (!rangeFilter) return [];
    return buildWeeklyRows(dailyLeads, rangeFilter);
  }, [dailyLeads, rangeFilter]);

  const historyMonthly = useMemo(() => {
    if (!rangeFilter) return [];
    return buildMonthlyRows(dailyLeads, rangeFilter);
  }, [dailyLeads, rangeFilter]);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    dailyLeads.forEach(entry => {
      if (!entry.date) return;
      const date = parseDateOnly(entry.date);
      years.add(date.getFullYear());
    });
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years.values()).sort((a, b) => b - a);
  }, [dailyLeads]);

  const conversion = (mql: number, sql: number) => (mql > 0 ? (sql / mql) * 100 : 0);

  const campaignPeriods = useMemo(() => {
    const weekPeriods = weeklyRows.map(week => ({
      label: `Semana ${formatDate(week.start)} a ${formatDate(week.end)}`,
      start: week.start,
      end: week.end,
    }));

    const monthPeriods = monthlyRows.map(row => {
      const bounds = monthBounds(row.start.getFullYear(), row.start.getMonth());
      return {
        label: row.label,
        start: bounds.start,
        end: bounds.end,
      };
    });

    const quarters = [
      { label: `Q1/${year}`, start: new Date(year, 0, 1, 12, 0, 0), end: new Date(year, 3, 0, 12, 0, 0) },
      { label: `Q2/${year}`, start: new Date(year, 3, 1, 12, 0, 0), end: new Date(year, 6, 0, 12, 0, 0) },
      { label: `Q3/${year}`, start: new Date(year, 6, 1, 12, 0, 0), end: new Date(year, 9, 0, 12, 0, 0) },
      { label: `Q4/${year}`, start: new Date(year, 9, 1, 12, 0, 0), end: new Date(year, 12, 0, 12, 0, 0) },
    ];

    const yearPeriod = { label: `${year}`, start: new Date(year, 0, 1, 12, 0, 0), end: new Date(year, 12, 0, 12, 0, 0) };

    return [...weekPeriods, ...monthPeriods, ...quarters, yearPeriod];
  }, [weeklyRows, monthlyRows, year]);

  const handleToggleCampaign = async (campaign: MetaCampaign) => {
    const nextId = expandedCampaignId === campaign.id ? null : campaign.id;
    setExpandedCampaignId(nextId);
    if (!nextId) return;

    if (campaignDetails[nextId]) return;

    setCampaignDetails(prev => ({
      ...prev,
      [nextId]: { loading: true, rows: [] },
    }));

    try {
      const rows = await Promise.all(
        campaignPeriods.map(async (period) => {
          const data = await DataService.getMetaCampaigns(formatISO(period.start), formatISO(period.end));
          const match = (data || []).find(item => item.id === campaign.id);
          return {
            label: period.label,
            spend: match?.spend || 0,
            ctr: match?.ctr || 0,
            reach: match?.reach || 0,
            impressions: match?.impressions || 0,
            cpc: match?.cpc || 0,
            cpm: match?.cpm || 0,
          };
        })
      );

      setCampaignDetails(prev => ({
        ...prev,
        [nextId]: { loading: false, rows },
      }));
    } catch (error) {
      console.error('Erro ao carregar detalhamento da campanha:', error);
      setCampaignDetails(prev => ({
        ...prev,
        [nextId]: { loading: false, rows: [] },
      }));
    }
  };

  const classifyPeriod = (label: string) => {
    if (label.startsWith('Semana')) return 'Semanas';
    if (label.startsWith('Q')) return 'Trimestres';
    if (/^\d{4}$/.test(label)) return 'Ano';
    return 'Meses';
  };

  const buildMetaPeriods = () => {
    const weekPeriods = weeklyRows.map(week => ({
      label: `Semana ${formatDate(week.start)} a ${formatDate(week.end)}`,
      start: week.start,
      end: week.end,
    }));

    const monthPeriods = monthlyRows.map(row => {
      const bounds = monthBounds(row.start.getFullYear(), row.start.getMonth());
      return {
        label: row.label,
        start: bounds.start,
        end: bounds.end,
      };
    });

    const quarters = [
      { label: `Q1/${year}`, start: new Date(year, 0, 1, 12, 0, 0), end: new Date(year, 3, 0, 12, 0, 0) },
      { label: `Q2/${year}`, start: new Date(year, 3, 1, 12, 0, 0), end: new Date(year, 6, 0, 12, 0, 0) },
      { label: `Q3/${year}`, start: new Date(year, 6, 1, 12, 0, 0), end: new Date(year, 9, 0, 12, 0, 0) },
      { label: `Q4/${year}`, start: new Date(year, 9, 1, 12, 0, 0), end: new Date(year, 12, 0, 12, 0, 0) },
    ];

    const yearPeriod = { label: `${year}`, start: new Date(year, 0, 1, 12, 0, 0), end: new Date(year, 12, 0, 12, 0, 0) };

    return [...weekPeriods, ...monthPeriods, ...quarters, yearPeriod];
  };

  useEffect(() => {
    const loadMeta = async () => {
      setMetaLoading(true);
      try {
        const periods = buildMetaPeriods();
        const results = await Promise.allSettled(
          periods.map(async (period) => {
            const campaigns = await DataService.getMetaCampaigns(formatISO(period.start), formatISO(period.end));
            const spend = campaigns.reduce((sum, item) => sum + (item.spend || 0), 0);
            const clicks = campaigns.reduce((sum, item) => sum + (item.clicks || 0), 0);
            const cpc = clicks > 0 ? spend / clicks : 0;
            const revenueInPeriod = revenueHistory.filter(entry => {
              const date = parseDateOnly(entry.date);
              return entry.origin === 'Facebook/Meta' && date >= period.start && date <= period.end;
            });
            const contracts = revenueInPeriod.length;
            const mrr = revenueInPeriod.reduce((sum, item) => sum + (item.mrrValue || 0), 0);
            return { ...period, spend, clicks, cpc, contracts, mrr };
          })
        );
        const mapped = results.map((result, index) => {
          if (result.status === 'fulfilled') return result.value;
          console.error('Erro ao buscar KPIs Meta:', result.reason);
          const fallback = periods[index];
          return { ...fallback, spend: 0, clicks: 0, cpc: 0, contracts: 0, mrr: 0 };
        });
        setMetaRows(mapped);
      } catch (error) {
        console.error('Erro ao carregar KPIs da Meta:', error);
        setMetaRows([]);
      } finally {
        setMetaLoading(false);
      }
    };

    if (!loading && dailyLeads.length >= 0) {
      loadMeta();
    }
  }, [year, month, weeklyRows, monthlyRows, revenueHistory, loading]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in-up">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <CalendarDays className="text-autoforce-blue" />
          Weekly
        </h2>
        <p className="text-autoforce-lightGrey text-sm">Resumo semanal do time de marketing.</p>
      </div>

      <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6 shadow-lg space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-autoforce-lightGrey">
            <BarChart3 size={18} className="text-autoforce-accent" />
            <span className="text-sm font-bold">Indicadores gerais de leads</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-autoforce-black/50 border border-autoforce-grey/20 rounded-full px-3 py-1.5 text-xs text-autoforce-lightGrey">
              <Filter size={12} className="text-autoforce-blue" />
              <span>Periodo</span>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="bg-transparent text-white text-xs outline-none"
              />
              <span>ate</span>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="bg-transparent text-white text-xs outline-none"
              />
            </div>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-autoforce-black/50 border border-autoforce-grey/20 rounded-full px-3 py-1.5 text-xs text-white"
            >
              {yearOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-autoforce-black/50 border border-autoforce-grey/20 rounded-full px-3 py-1.5 text-xs text-white"
            >
              {Array.from({ length: 12 }).map((_, index) => (
                <option key={index} value={index}>{monthLabel(index)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs text-autoforce-lightGrey">
          Semanas sempre de segunda a domingo.
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm table-fixed">
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead className="text-[11px] uppercase tracking-wider text-autoforce-lightGrey border-b border-autoforce-grey/20">
              <tr>
                <th className="py-2 pr-4">Semanas</th>
                <th className="py-2 pr-4 text-center">Leads Gerados</th>
                <th className="py-2 pr-4 text-center">MQL</th>
                <th className="py-2 pr-4 text-center">SQL</th>
                <th className="py-2 text-right">% Conversao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-autoforce-grey/10">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-autoforce-lightGrey">Carregando...</td>
                </tr>
              ) : weeklyRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-autoforce-lightGrey">Nenhum dado no mes selecionado.</td>
                </tr>
              ) : (
                weeklyRows.map((week) => (
                  <tr key={week.start.toISOString()} className="text-sm text-white">
                    <td className="py-3 pr-4 truncate">{`Semana ${formatDate(week.start)} a ${formatDate(week.end)}`}</td>
                    <td className="py-3 pr-4 text-center">{week.leads}</td>
                    <td className="py-3 pr-4 text-center">{week.mql}</td>
                    <td className="py-3 pr-4 text-center">{week.sql}</td>
                    <td className="py-3 text-right">{conversion(week.mql, week.sql).toFixed(2)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-autoforce-grey/20 pt-4">
          <h4 className="text-sm font-bold text-white mb-3">Resumo mensal ({year})</h4>
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm table-fixed">
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead className="text-[11px] uppercase tracking-wider text-autoforce-lightGrey border-b border-autoforce-grey/20">
              <tr>
                <th className="py-2 pr-4">Mes</th>
                  <th className="py-2 pr-4 text-center">Leads Gerados</th>
                  <th className="py-2 pr-4 text-center">MQL</th>
                  <th className="py-2 pr-4 text-center">SQL</th>
                  <th className="py-2 text-right">% Conversao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-autoforce-grey/10">
                {monthlyRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-autoforce-lightGrey">Nenhum dado no ano selecionado.</td>
                  </tr>
                ) : (
                  monthlyRows.map((row) => (
                    <tr key={`${row.start.getFullYear()}-${row.start.getMonth()}`} className="text-sm text-white">
                    <td className="py-3 pr-4 truncate">{row.label}</td>
                    <td className="py-3 pr-4 text-center">{row.leads}</td>
                    <td className="py-3 pr-4 text-center">{row.mql}</td>
                    <td className="py-3 pr-4 text-center">{row.sql}</td>
                    <td className="py-3 text-right">{conversion(row.mql, row.sql).toFixed(2)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {rangeFilter && (
          <div className="border-t border-autoforce-grey/20 pt-4 space-y-4">
            <h4 className="text-sm font-bold text-white">Historico do periodo</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm table-fixed">
                <colgroup>
                  <col className="w-[40%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead className="text-[11px] uppercase tracking-wider text-autoforce-lightGrey border-b border-autoforce-grey/20">
                  <tr>
                    <th className="py-2 pr-4">Semanas</th>
                    <th className="py-2 pr-4 text-center">Leads Gerados</th>
                    <th className="py-2 pr-4 text-center">MQL</th>
                    <th className="py-2 pr-4 text-center">SQL</th>
                    <th className="py-2 text-right">% Conversao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-autoforce-grey/10">
                  {historyWeekly.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-autoforce-lightGrey">Nenhum dado no periodo.</td>
                    </tr>
                  ) : (
                    historyWeekly.map((week) => (
                      <tr key={`history-${week.start.toISOString()}`} className="text-sm text-white">
                        <td className="py-3 pr-4 truncate">{`Semana ${formatDate(week.start)} a ${formatDate(week.end)}`}</td>
                        <td className="py-3 pr-4 text-center">{week.leads}</td>
                        <td className="py-3 pr-4 text-center">{week.mql}</td>
                        <td className="py-3 pr-4 text-center">{week.sql}</td>
                        <td className="py-3 text-right">{conversion(week.mql, week.sql).toFixed(2)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm table-fixed">
                <colgroup>
                  <col className="w-[40%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead className="text-[11px] uppercase tracking-wider text-autoforce-lightGrey border-b border-autoforce-grey/20">
                  <tr>
                    <th className="py-2 pr-4">Mes</th>
                    <th className="py-2 pr-4 text-center">Leads Gerados</th>
                    <th className="py-2 pr-4 text-center">MQL</th>
                    <th className="py-2 pr-4 text-center">SQL</th>
                    <th className="py-2 text-right">% Conversao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-autoforce-grey/10">
                  {historyMonthly.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-autoforce-lightGrey">Nenhum dado no periodo.</td>
                    </tr>
                  ) : (
                    historyMonthly.map((row) => (
                      <tr key={`history-month-${row.start.getFullYear()}-${row.start.getMonth()}`} className="text-sm text-white">
                        <td className="py-3 pr-4 truncate">{row.label}</td>
                        <td className="py-3 pr-4 text-center">{row.leads}</td>
                        <td className="py-3 pr-4 text-center">{row.mql}</td>
                        <td className="py-3 pr-4 text-center">{row.sql}</td>
                        <td className="py-3 text-right">{conversion(row.mql, row.sql).toFixed(2)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6 shadow-lg space-y-6">
        <div className="flex items-center gap-2 text-autoforce-lightGrey">
          <BarChart3 size={18} className="text-autoforce-accent" />
          <span className="text-sm font-bold">KPIs Meta</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm table-fixed">
            <colgroup>
              <col className="w-[20%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="text-[11px] uppercase tracking-wider text-autoforce-lightGrey border-b border-autoforce-grey/20">
              <tr>
                <th className="py-2 pr-4">KPIs Meta</th>
                <th className="py-2 pr-4 text-center">Investimento</th>
                <th className="py-2 pr-4 text-center">MQL</th>
                <th className="py-2 pr-4 text-center">SQL</th>
                <th className="py-2 pr-4 text-center">% Conversao</th>
                <th className="py-2 pr-4 text-center">CTL (Custo por MQL)</th>
                <th className="py-2 pr-4 text-center">CPC meta</th>
                <th className="py-2 pr-4 text-center">Contratos</th>
                <th className="py-2 pr-4 text-center">MRR Gerado</th>
                <th className="py-2 text-center">Inscricoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-autoforce-grey/10">
              {metaLoading ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-autoforce-lightGrey">Carregando KPIs da Meta...</td>
                </tr>
              ) : metaRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-autoforce-lightGrey">Nenhum dado disponível.</td>
                </tr>
              ) : (
                metaRows.map((row) => (
                  <tr key={`${row.label}-${row.start.toISOString()}`} className="text-sm text-white">
                    <td className="py-3 pr-4 truncate">{row.label}</td>
                    <td className="py-3 pr-4 text-center">{formatCurrency(row.spend)}</td>
                    <td className="py-3 pr-4 text-center">—</td>
                    <td className="py-3 pr-4 text-center">—</td>
                    <td className="py-3 pr-4 text-center">—</td>
                    <td className="py-3 pr-4 text-center">—</td>
                    <td className="py-3 pr-4 text-center">{row.clicks > 0 ? formatCurrency(row.cpc) : '—'}</td>
                    <td className="py-3 pr-4 text-center">{row.contracts}</td>
                    <td className="py-3 pr-4 text-center">{formatCurrency(row.mrr)}</td>
                    <td className="py-3 text-center">—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6 shadow-lg space-y-6">
        <div className="flex items-center gap-2 text-autoforce-lightGrey">
          <BarChart3 size={18} className="text-autoforce-accent" />
          <span className="text-sm font-bold">Indicadores de Performance de Campanhas</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm table-fixed">
            <colgroup>
              <col className="w-[32%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="text-[11px] uppercase tracking-wider text-autoforce-lightGrey border-b border-autoforce-grey/20">
              <tr>
                <th className="py-2 pr-4">Nome da Campanha</th>
                <th className="py-2 pr-4 text-center">Investimento</th>
                <th className="py-2 pr-4 text-center">CPC</th>
                <th className="py-2 pr-4 text-center">CTR</th>
                <th className="py-2 pr-4 text-center">Alcance</th>
                <th className="py-2 pr-4 text-center">Impressões</th>
                <th className="py-2 text-center">CPM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-autoforce-grey/10">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-autoforce-lightGrey">Nenhuma campanha retornada.</td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr key={campaign.id} className="text-sm text-white">
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => handleToggleCampaign(campaign)}
                        className="text-left text-white hover:text-autoforce-blue transition"
                      >
                        {campaign.name}
                      </button>
                    </td>
                    <td className="py-3 pr-4 text-center">{formatCurrency(campaign.spend)}</td>
                    <td className="py-3 pr-4 text-center">{campaign.cpc ? formatCurrency(campaign.cpc) : '—'}</td>
                    <td className="py-3 pr-4 text-center">{campaign.ctr ? `${campaign.ctr.toFixed(2)}%` : '—'}</td>
                    <td className="py-3 pr-4 text-center">{campaign.reach || '—'}</td>
                    <td className="py-3 pr-4 text-center">{campaign.impressions || '—'}</td>
                    <td className="py-3 text-center">{campaign.cpm ? formatCurrency(campaign.cpm) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {expandedCampaignId && (
          <div className="border border-autoforce-grey/20 rounded-xl p-4 bg-autoforce-black/40">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-white">Detalhamento por campanha</div>
              <button
                type="button"
                onClick={() => setExpandedCampaignId(null)}
                className="text-xs text-autoforce-lightGrey hover:text-white"
              >
                Fechar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm table-fixed">
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[12%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="text-[11px] uppercase tracking-wider text-autoforce-lightGrey border-b border-autoforce-grey/20">
                  <tr>
                    <th className="py-2 pr-4">Periodo</th>
                    <th className="py-2 pr-4 text-center">Investimento</th>
                    <th className="py-2 pr-4 text-center">CPC</th>
                    <th className="py-2 pr-4 text-center">CTL</th>
                    <th className="py-2 pr-4 text-center">CTR</th>
                    <th className="py-2 pr-4 text-center">Alcance</th>
                    <th className="py-2 pr-4 text-center">Impressões</th>
                    <th className="py-2 text-center">CPM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-autoforce-grey/10">
                  {campaignDetails[expandedCampaignId]?.loading ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-autoforce-lightGrey">Carregando detalhamento...</td>
                    </tr>
                  ) : campaignDetails[expandedCampaignId]?.rows?.length ? (
                    campaignDetails[expandedCampaignId].rows.reduce<{ label: string; spend: number; ctr: number; reach: number; impressions: number; cpc: number; cpm: number; group: string }[]>(
                      (acc, row) => {
                        const group = classifyPeriod(row.label);
                        const last = acc[acc.length - 1];
                        if (!last || last.group !== group) {
                          acc.push({ label: group, spend: 0, ctr: 0, reach: 0, impressions: 0, cpc: 0, cpm: 0, group });
                        }
                        acc.push({ ...row, group });
                        return acc;
                      },
                      []
                    ).map((row) => (
                      row.label === row.group ? (
                        <tr key={`${expandedCampaignId}-${row.group}`} className="bg-autoforce-blue/10 text-autoforce-blue text-xs uppercase tracking-wider">
                          <td colSpan={8} className="py-2 px-3">{row.group}</td>
                        </tr>
                      ) : (
                        <tr key={`${expandedCampaignId}-${row.label}`} className="text-sm text-white">
                          <td className="py-3 pr-4 truncate">{row.label}</td>
                          <td className="py-3 pr-4 text-center">{formatCurrency(row.spend)}</td>
                          <td className="py-3 pr-4 text-center">{row.cpc ? formatCurrency(row.cpc) : '—'}</td>
                          <td className="py-3 pr-4 text-center">—</td>
                          <td className="py-3 pr-4 text-center">{row.ctr ? `${row.ctr.toFixed(2)}%` : '—'}</td>
                          <td className="py-3 pr-4 text-center">{row.reach || '—'}</td>
                          <td className="py-3 pr-4 text-center">{row.impressions || '—'}</td>
                          <td className="py-3 text-center">{row.cpm ? formatCurrency(row.cpm) : '—'}</td>
                        </tr>
                      )
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-autoforce-lightGrey">Sem dados para este período.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyView;
