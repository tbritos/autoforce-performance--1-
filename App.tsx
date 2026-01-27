import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import LPView from './components/LPView';
import SiteView from './components/SiteView';
import LeadTracker from './components/LeadTracker';
import RevenueTracker from './components/RevenueTracker';
import OKRTracker from './components/OKRTracker';
import TeamView from './components/TeamView';
import CampaignsView from './components/CampaignsView';
import AssetsView from './components/AssetsView';
import BlogView from './components/BlogView';
import EmailsView from './components/EmailsView';
import WeeklyView from './components/WeeklyView';
import { DataService } from './services/dataService';
import { User, Metric, TabView, LandingPage, DailyLeadEntry, RevenueEntry, KpiGoal } from './types';
import {
  LayoutDashboard,
  FileText,
  Mail,
  LogOut,
  TrendingUp,
  TrendingDown,
  Target,
  Globe,
  Award,
  RefreshCw,
  ClipboardList,
  DollarSign,
  CalendarDays,
  Package,
  Megaphone,
  FolderOpen,
  Users,
  BarChart3,
  Menu,
  ChevronDown,
  SlidersHorizontal
} from 'lucide-react';
import { FunnelChart } from './components/Charts';

// --- COMPONENTE DO CONTEÃšDO DO DASHBOARD (ExtraÃ­do para limpar o cÃ³digo) ---
const DashboardContent: React.FC<{
    metrics: Metric[], 
    dailyLeads: DailyLeadEntry[],
    revenueHistory: RevenueEntry[],
    loadingData: boolean 
}> = ({ metrics, dailyLeads, revenueHistory, loadingData }) => {
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date();
        start.setMonth(end.getMonth() - 6);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
        };
    });
    const startDateRef = React.useRef<HTMLInputElement>(null);
    const endDateRef = React.useRef<HTMLInputElement>(null);
    const [goals, setGoals] = useState<KpiGoal[]>([]);
    const [goalHistory, setGoalHistory] = useState<KpiGoal[]>([]);
    const [goalMetricId, setGoalMetricId] = useState('1');
    const [goalTarget, setGoalTarget] = useState('');
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [showGoals, setShowGoals] = useState(false);
    const [closingGoals, setClosingGoals] = useState(false);
    const [closingRequested, setClosingRequested] = useState(false);

    const handleCloseGoals = () => {
        if (closingRequested) return;
        setClosingRequested(true);
        setClosingGoals(true);
        setTimeout(() => {
            setShowGoals(false);
            setClosingGoals(false);
            setClosingRequested(false);
        }, 250);
    };

    // Fallback de segurança para evitar erro se metrics vier vazio
    const safeMetrics = Array.isArray(metrics) ? metrics : [];
    const safeDailyLeads = Array.isArray(dailyLeads) ? dailyLeads : [];
    const safeRevenueHistory = Array.isArray(revenueHistory) ? revenueHistory : [];

    useEffect(() => {
        try {
            const storedGoals = localStorage.getItem('autoforce_kpi_goals');
            const storedHistory = localStorage.getItem('autoforce_kpi_goals_history');
            if (storedGoals) setGoals(JSON.parse(storedGoals));
            if (storedHistory) setGoalHistory(JSON.parse(storedHistory));
        } catch (error) {
            console.error('Erro ao carregar metas:', error);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('autoforce_kpi_goals', JSON.stringify(goals));
        localStorage.setItem('autoforce_kpi_goals_history', JSON.stringify(goalHistory));
    }, [goals, goalHistory]);

    const parseDateOnly = (value: string) => {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0);
    };

    const formatCurrency = (val: number) => {
        if (Number.isNaN(val)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const formatMetricValue = (metric: Metric, value: number) => {
        if (metric.unit === '%') {
            return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
        }
        if (metric.unit === 'R$') {
            return formatCurrency(value);
        }
        return new Intl.NumberFormat('pt-BR').format(value);
    };

    const formatMetricTarget = (metric: Metric, value: number) => {
        if (metric.unit === '%') {
            return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
        }
        if (metric.unit === 'R$') {
            return formatCurrency(value);
        }
        return new Intl.NumberFormat('pt-BR').format(value);
    };

    const normalizeRange = (startValue: string, endValue: string) => {
        const start = parseDateOnly(startValue);
        const end = parseDateOnly(endValue);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return null;
        }
        return start <= end ? { start, end } : { start: end, end: start };
    };

    const aggregateForRange = (startValue: string, endValue: string) => {
        const range = normalizeRange(startValue, endValue);
        if (!range) {
            return { mql: 0, sql: 0, mrr: 0, sales: 0 };
        }
        const { start, end } = range;
        const leads = safeDailyLeads.filter(entry => {
            const entryDate = parseDateOnly(entry.date);
            return entryDate >= start && entryDate <= end;
        });
        const revenue = safeRevenueHistory.filter(entry => {
            const entryDate = parseDateOnly(entry.date);
            return entryDate >= start && entryDate <= end;
        });
        return {
            mql: leads.reduce((sum, lead) => sum + lead.mql, 0),
            sql: leads.reduce((sum, lead) => sum + lead.sql, 0),
            mrr: revenue.reduce((sum, item) => sum + (item.mrrValue || 0), 0),
            sales: revenue.length,
        };
    };

    const filteredDailyLeads = useMemo(() => {
        const range = normalizeRange(dateRange.start, dateRange.end);
        if (!range) return safeDailyLeads;
        return safeDailyLeads.filter(entry => {
            const entryDate = parseDateOnly(entry.date);
            return entryDate >= range.start && entryDate <= range.end;
        });
    }, [dateRange.end, dateRange.start, safeDailyLeads]);

    const filteredRevenue = useMemo(() => {
        const range = normalizeRange(dateRange.start, dateRange.end);
        if (!range) return safeRevenueHistory;
        return safeRevenueHistory.filter(entry => {
            const entryDate = parseDateOnly(entry.date);
            return entryDate >= range.start && entryDate <= range.end;
        });
    }, [dateRange.end, dateRange.start, safeRevenueHistory]);

    const computedMetrics = useMemo(() => {
        const range = normalizeRange(dateRange.start, dateRange.end);
        if (!range) return safeMetrics;
        const current = aggregateForRange(dateRange.start, dateRange.end);
        const dayMs = 24 * 60 * 60 * 1000;
        const rangeDays = Math.round((range.end.getTime() - range.start.getTime()) / dayMs) + 1;
        const prevEnd = new Date(range.start.getTime() - dayMs);
        const prevStart = new Date(prevEnd.getTime() - (rangeDays - 1) * dayMs);
        const prevStartStr = prevStart.toISOString().split('T')[0];
        const prevEndStr = prevEnd.toISOString().split('T')[0];
        const previous = aggregateForRange(prevStartStr, prevEndStr);

        const leadsChange = previous.mql > 0 ? ((current.mql - previous.mql) / previous.mql) * 100 : 0;
        const currentQual = current.mql > 0 ? (current.sql / current.mql) * 100 : 0;
        const previousQual = previous.mql > 0 ? (previous.sql / previous.mql) * 100 : 0;
        const qualChange = currentQual - previousQual;
        const mrrChange = previous.mrr > 0 ? ((current.mrr - previous.mrr) / previous.mrr) * 100 : 0;
        const salesChange = previous.sales > 0 ? ((current.sales - previous.sales) / previous.sales) * 100 : 0;

        return [
            {
                id: '1',
                label: 'Total de Leads',
                value: current.mql,
                target: 4000,
                unit: '',
                change: Number(leadsChange.toFixed(1)),
                trend: leadsChange >= 0 ? 'up' : 'down',
                description: 'Leads gerados em todas as fontes',
            },
            {
                id: '2',
                label: 'Taxa de Qualificação',
                value: Number(currentQual.toFixed(1)),
                target: 45,
                unit: '%',
                change: Number(qualChange.toFixed(1)),
                trend: qualChange >= 0 ? 'up' : 'down',
                description: 'Leads que viraram oportunidades',
            },
            {
                id: '3',
                label: 'MRR Novo',
                value: Number(current.mrr.toFixed(2)),
                target: 15000,
                unit: 'R$',
                change: Number(mrrChange.toFixed(1)),
                trend: mrrChange >= 0 ? 'up' : 'down',
                description: 'Receita recorrente adicionada',
            },
            {
                id: '4',
                label: 'Vendas Realizadas',
                value: current.sales,
                target: 120,
                unit: '',
                change: Number(salesChange.toFixed(1)),
                trend: salesChange >= 0 ? 'up' : 'down',
                description: 'Negocios fechados no perí­odo',
            },
        ];
    }, [dateRange.end, dateRange.start, safeMetrics, safeDailyLeads, safeRevenueHistory]);

    const goalTargets = useMemo(() => {
        const map = new Map<string, number>();
        goals.forEach(goal => map.set(goal.metricId, goal.target));
        return map;
    }, [goals]);

    const handleGoalSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const targetValue = Number(goalTarget);
        if (!goalMetricId || Number.isNaN(targetValue)) return;
        if (editingGoalId) {
            setGoals(prev =>
                prev.map(goal => goal.id === editingGoalId ? { ...goal, metricId: goalMetricId, target: targetValue } : goal)
            );
            setEditingGoalId(null);
        } else {
            const newGoal: KpiGoal = {
                id: `${Date.now()}`,
                metricId: goalMetricId,
                target: targetValue,
                createdAt: new Date().toISOString(),
            };
            setGoals(prev => [newGoal, ...prev]);
        }
        setGoalTarget('');
    };

    const handleEditGoal = (goal: KpiGoal) => {
        setEditingGoalId(goal.id);
        setGoalMetricId(goal.metricId);
        setGoalTarget(String(goal.target));
    };

    const handleDeleteGoal = (id: string) => {
        setGoals(prev => prev.filter(goal => goal.id !== id));
    };

    const handleCompleteGoal = (goal: KpiGoal) => {
        setGoals(prev => prev.filter(item => item.id !== goal.id));
        setGoalHistory(prev => [
            { ...goal, completedAt: new Date().toISOString() },
            ...prev,
        ]);
    };

    const topProducts = useMemo(() => {
        const map = new Map<string, { count: number; mrr: number }>();
        filteredRevenue.forEach(entry => {
            const products = Array.isArray(entry.product) ? entry.product : [entry.product];
            products.forEach(product => {
                if (!product) return;
                const current = map.get(product) || { count: 0, mrr: 0 };
                current.count += 1;
                current.mrr += entry.mrrValue || 0;
                map.set(product, current);
            });
        });
        return Array.from(map.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.count - a.count || b.mrr - a.mrr)
            .slice(0, 5);
    }, [filteredRevenue]);

    const originBreakdown = useMemo(() => {
        const map = new Map<string, { count: number; mrr: number }>();
        filteredRevenue.forEach(entry => {
            const origin = entry.origin || 'Indefinido';
            const current = map.get(origin) || { count: 0, mrr: 0 };
            current.count += 1;
            current.mrr += entry.mrrValue || 0;
            map.set(origin, current);
        });
        return Array.from(map.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.count - a.count || b.mrr - a.mrr)
            .slice(0, 5);
    }, [filteredRevenue]);

    const monthlyMRR = useMemo(() => {
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const map = new Map<string, { label: string; total: number }>();
        filteredRevenue.forEach(entry => {
            const date = new Date(entry.date);
            if (Number.isNaN(date.getTime())) return;
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const label = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
            const current = map.get(key) || { label, total: 0 };
            current.total += entry.mrrValue || 0;
            map.set(key, current);
        });
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([, value]) => value);
    }, [filteredRevenue]);

    const monthlyMRRDisplay = useMemo(() => monthlyMRR.slice(-6), [monthlyMRR]);
    const maxMonthlyMRR = useMemo(
        () => Math.max(1, ...monthlyMRRDisplay.map(item => item.total)),
        [monthlyMRRDisplay]
    );

    const funnelSource = useMemo(() => {
        const totals = filteredDailyLeads.reduce(
            (acc, entry) => ({
                mql: acc.mql + entry.mql,
                sql: acc.sql + entry.sql,
            }),
            { mql: 0, sql: 0 }
        );
        return [
            {
                name: 'Total',
                leads: totals.mql,
                qualified: totals.sql,
                sales: filteredRevenue.length,
            },
        ];
    }, [filteredDailyLeads, filteredRevenue]);
    
    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in-up">
            <div className="flex justify-end items-start gap-4 flex-wrap">
                <div className="flex items-center gap-3 text-xs text-autoforce-grey bg-autoforce-darkest/40 border border-autoforce-grey/20 rounded-xl px-4 py-2">
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] uppercase tracking-wider text-autoforce-lightGrey">De</label>
                        <div className="relative">
                            <input
                                id="dashboard-start-date"
                                type="date"
                                ref={startDateRef}
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="date-input bg-autoforce-black/60 border border-autoforce-grey/30 rounded-lg px-3 py-1.5 text-xs text-white focus:border-autoforce-blue focus:outline-none pr-9"
                            />
                            <button
                                type="button"
                                onClick={() => (startDateRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.()}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-autoforce-blue"
                                aria-label="Abrir calendario inicial"
                            >
                                <CalendarDays size={12} />
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] uppercase tracking-wider text-autoforce-lightGrey">Ate</label>
                        <div className="relative">
                            <input
                                id="dashboard-end-date"
                                type="date"
                                ref={endDateRef}
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="date-input bg-autoforce-black/60 border border-autoforce-grey/30 rounded-lg px-3 py-1.5 text-xs text-white focus:border-autoforce-blue focus:outline-none pr-9"
                            />
                            <button
                                type="button"
                                onClick={() => (endDateRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.()}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-autoforce-blue"
                                aria-label="Abrir calendario final"
                            >
                                <CalendarDays size={12} />
                            </button>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowGoals(true)}
                        className="ml-2 w-9 h-9 flex items-center justify-center bg-autoforce-blue/20 border border-autoforce-blue/40 rounded-full text-autoforce-blue hover:text-white hover:bg-autoforce-blue/40 transition"
                        aria-label="Configurar metas"
                    >
                        <SlidersHorizontal size={14} />
                    </button>
                </div>
            </div>

            {showGoals && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <button
                        type="button"
                        className={`absolute inset-0 bg-black/60 ${closingGoals ? 'animate-fade-out' : 'opacity-0 animate-fade-in'}`}
                        onClick={handleCloseGoals}
                        aria-label="Fechar metas"
                    />
                    <aside className={`relative mt-24 w-full max-w-md bg-autoforce-darkest border border-autoforce-grey/20 rounded-l-3xl shadow-2xl p-5 overflow-y-auto ${showHistory && goalHistory.length > 0 ? 'max-h-[520px]' : 'max-h-[210px]'} ${closingGoals ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-white">Metas dos Cards</h3>
                            <button
                                type="button"
                                onClick={handleCloseGoals}
                                className="text-xs text-autoforce-lightGrey hover:text-white"
                            >
                                Fechar
                            </button>
                        </div>
                        <form onSubmit={handleGoalSubmit} className="space-y-3">
                            <div className="grid grid-cols-1 gap-2">
                                <select
                                    value={goalMetricId}
                                    onChange={(e) => setGoalMetricId(e.target.value)}
                                    className="bg-autoforce-black/60 border border-autoforce-grey/30 rounded-lg px-3 py-2 text-xs text-white focus:border-autoforce-blue focus:outline-none"
                                >
                                    {computedMetrics.map(metric => (
                                        <option key={metric.id} value={metric.id}>{metric.label}</option>
                                    ))}
                                </select>
                                <input
                                    value={goalTarget}
                                    onChange={(e) => setGoalTarget(e.target.value)}
                                    type="number"
                                    className="bg-autoforce-black/60 border border-autoforce-grey/30 rounded-lg px-3 py-2 text-xs text-white focus:border-autoforce-blue focus:outline-none"
                                    placeholder="Defina a meta"
                                    required
                                />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowHistory(prev => !prev)}
                                    className="text-xs font-semibold text-autoforce-lightGrey hover:text-white"
                                >
                                    Historico
                                </button>
                                {editingGoalId && (
                                    <button
                                        type="button"
                                        onClick={() => { setEditingGoalId(null); setGoalTarget(''); }}
                                        className="text-xs text-autoforce-lightGrey hover:text-white"
                                    >
                                        Cancelar
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="bg-autoforce-blue hover:bg-autoforce-secondary text-white px-3 py-1.5 rounded text-xs font-bold"
                                >
                                    {editingGoalId ? 'Salvar' : 'Criar meta'}
                                </button>
                            </div>
                        </form>
                        {goals.length > 0 && (
                            <div className="mt-6 space-y-2">
                                {goals.map(goal => {
                                    const metricLabel = computedMetrics.find(metric => metric.id === goal.metricId)?.label || 'Meta';
                                    return (
                                        <div key={goal.id} className="flex items-center justify-between text-xs bg-autoforce-black/40 border border-autoforce-grey/20 rounded-lg px-3 py-2">
                                            <div>
                                                <p className="text-white font-semibold">{metricLabel}</p>
                                                <p className="text-autoforce-lightGrey">Meta: {goal.target}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditGoal(goal)}
                                                    className="text-autoforce-blue hover:text-autoforce-secondary"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCompleteGoal(goal)}
                                                    className="text-green-400 hover:text-green-300"
                                                >
                                                    Concluir
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteGoal(goal.id)}
                                                    className="text-red-400 hover:text-red-300"
                                                >
                                                    Excluir
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {showHistory && goalHistory.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {goalHistory.slice(0, 5).map(goal => {
                                    const metricLabel = computedMetrics.find(metric => metric.id === goal.metricId)?.label || 'Meta';
                                    return (
                                        <div key={goal.id} className="text-xs text-autoforce-grey bg-autoforce-black/30 border border-autoforce-grey/20 rounded-lg px-3 py-2">
                                            <p className="text-white font-semibold">{metricLabel}</p>
                                            <p>Meta: {goal.target}</p>
                                            <p>ConcluÃ­da em: {goal.completedAt ? new Date(goal.completedAt).toLocaleDateString('pt-BR') : ''}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {showHistory && goalHistory.length === 0 && (
                            <p className="mt-3 text-xs text-autoforce-lightGrey">Nenhuma meta concluÃ­da.</p>
                        )}
                    </aside>
                </div>
            )}
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {computedMetrics.map((metric) => {
                const goalTarget = goalTargets.get(metric.id);
                const target = goalTarget ?? metric.target;
                return (
                <div key={metric.id} className="bg-autoforce-darkest p-6 rounded-lg border border-autoforce-grey/20 relative overflow-hidden group hover:border-autoforce-blue/50 transition-all shadow-lg hover:shadow-autoforce-blue/10">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Award size={40} />
                </div>
                <h3 className="text-autoforce-lightGrey text-xs font-bold uppercase tracking-wider mb-2">{metric.label}</h3>
                <div className="flex items-end gap-2">
                    <span className="text-3xl font-display font-bold text-white">
                        {formatMetricValue(metric, metric.value || 0)}
                    </span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                    <div className={`text-sm font-bold flex items-center gap-1 ${metric.trend === 'up' ? 'text-green-400' : metric.trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
                        {metric.trend === 'up' ? <TrendingUp size={14} /> : metric.trend === 'down' ? <TrendingDown size={14} /> : null}
                        {metric.change > 0 ? '+' : ''}{metric.change}%
                    </div>
                    <span className="text-[10px] text-autoforce-grey bg-white/5 px-2 py-0.5 rounded">
                        Meta: {formatMetricTarget(metric, target || 0)}
                    </span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 mt-3 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full ${metric.trend === 'up' ? 'bg-autoforce-blue' : 'bg-autoforce-accent'}`} 
                        style={{ width: `${Math.min(((metric.value || 0) / (target || 1)) * 100, 100)}%` }}
                    ></div>
                </div>
                </div>
                );
            })}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 bg-autoforce-darkest p-6 rounded-lg border border-autoforce-grey/20">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                        <h3 className="text-lg font-bold text-white font-display">Funil de Vendas (MQL &gt; SQL &gt; Vendas)</h3>
                    </div>
                    <FunnelChart data={funnelSource} isLoading={loadingData} />
                </div>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Top Produtos Vendidos */}
                <div className="bg-autoforce-darkest p-6 rounded-lg border border-autoforce-grey/20">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <Package size={18} className="text-autoforce-blue"/> 
                        Top Produtos Vendidos
                    </h3>
                    {topProducts.length === 0 ? (
                        <p className="text-sm text-autoforce-lightGrey">Nenhum ganho no perí­odo.</p>
                    ) : (
                        <div className="space-y-3">
                            {topProducts.map(item => (
                                <div key={item.name} className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-white font-semibold">{item.name}</p>
                                        <p className="text-xs text-autoforce-lightGrey">{item.count} vendas</p>
                                    </div>
                                    <span className="text-xs font-bold text-autoforce-blue">{formatCurrency(item.mrr)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Origem dos Ganhos */}
                <div className="bg-autoforce-darkest p-6 rounded-lg border border-autoforce-grey/20">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <Globe size={18} className="text-autoforce-accent"/> 
                        Origem dos Ganhos
                    </h3>
                    {originBreakdown.length === 0 ? (
                        <p className="text-sm text-autoforce-lightGrey">Nenhum ganho no perí­odo.</p>
                    ) : (
                        <div className="space-y-3">
                            {originBreakdown.map(item => (
                                <div key={item.name} className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-white font-semibold">{item.name}</p>
                                        <p className="text-xs text-autoforce-lightGrey">{item.count} vendas</p>
                                    </div>
                                    <span className="text-xs font-bold text-autoforce-accent">{formatCurrency(item.mrr)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* MRR por MÃªs */}
                <div className="bg-autoforce-darkest p-6 rounded-lg border border-autoforce-grey/20">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-green-400"/> 
                        MRR por Mês
                    </h3>
                    {monthlyMRRDisplay.length === 0 ? (
                        <p className="text-sm text-autoforce-lightGrey">Nenhum ganho no período.</p>
                    ) : (
                        <div className="space-y-3">
                            {monthlyMRRDisplay.map(item => (
                                <div key={item.label} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs text-autoforce-lightGrey">
                                        <span>{item.label}</span>
                                        <span className="font-mono text-white">{formatCurrency(item.total)}</span>
                                    </div>
                                    <div className="w-full bg-autoforce-black/60 h-2 rounded-full overflow-hidden border border-autoforce-grey/20">
                                        <div
                                            className="h-full bg-green-500"
                                            style={{ width: `${Math.round((item.total / maxMonthlyMRR) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- COMPONENTE PRINCIPAL (COM ROTEAMENTO) ---
const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  
  // Data State
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [dailyLeads, setDailyLeads] = useState<DailyLeadEntry[]>([]);
  const [revenueHistory, setRevenueHistory] = useState<RevenueEntry[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Router Hooks
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize App (Check Login)
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = localStorage.getItem('autoforce_token');
        if (!savedToken) {
          localStorage.removeItem('autoforce_user');
          setInitializing(false);
          return;
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        });

        if (!response.ok) {
          localStorage.removeItem('autoforce_user');
          localStorage.removeItem('autoforce_token');
          setInitializing(false);
          return;
        }

        const data = await response.json();
        if (data?.user?.email) {
          setUser(data.user);
          localStorage.setItem('autoforce_user', JSON.stringify(data.user));
        } else {
          localStorage.removeItem('autoforce_user');
          localStorage.removeItem('autoforce_token');
        }
      } catch (e) {
        console.error('Erro ao restaurar sessÃ£o:', e);
        localStorage.removeItem('autoforce_user');
        localStorage.removeItem('autoforce_token');
      } finally {
        setInitializing(false);
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    setOpenDropdown(null);
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Fetch Data based on Route (URL)
  useEffect(() => {
    if (user) {
      fetchData(location.pathname);
    }
  }, [user, location.pathname]);

  const fetchData = async (pathname: string) => {
    setLoadingData(true);
    try {
      // Sempre busca mÃ©tricas do header se nÃ£o tiver
      if (metrics.length === 0) {
        const dashboardMetrics = await DataService.getDashboardMetrics();
        setMetrics(Array.isArray(dashboardMetrics) ? dashboardMetrics : []);
      }

      // LÃ³gica de Fetch baseada na URL
      if (pathname === '/' || pathname === '/dashboard') {
        if (dailyLeads.length === 0) {
            const history = await DataService.getDailyLeadsHistory();
            setDailyLeads(history || []);
        }
        if (revenueHistory.length === 0) {
            const revenue = await DataService.getRevenueHistory();
            setRevenueHistory(revenue || []);
        }
        if (landingPages.length === 0) {
            const lps = await DataService.getLandingPagesGA(); 
            setLandingPages(lps || []);
        }
      } else if (pathname.includes('analytics') && landingPages.length === 0) {
        const lps = await DataService.getLandingPagesGA();
        setLandingPages(lps || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleLogin = (userData: User, token: string) => {
    setUser(userData);
    localStorage.setItem('autoforce_user', JSON.stringify(userData));
    localStorage.setItem('autoforce_token', token);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('autoforce_user');
    localStorage.removeItem('autoforce_token');
    setMetrics([]);
    setDailyLeads([]);
    setRevenueHistory([]);
    navigate('/'); // Volta para home ao sair
  };

  const navItems = [
    { label: 'Performance', icon: LayoutDashboard, path: '/' },
    { label: 'Calendario Marketing', icon: Users, path: '/team' }
  ];

  const navGroups = [
    {
      id: 'insights',
      label: 'Gestao de Resultados',
      icon: ClipboardList,
      items: [
        { label: 'Acompanhamento Diario', path: '/leads', icon: ClipboardList },
        { label: 'Weekly', path: '/weekly', icon: BarChart3 },
        { label: 'Ganhos', path: '/revenue', icon: DollarSign },
        { label: 'OKRs do Marketing', path: '/okrs', icon: Target }
      ]
    },
    {
      id: 'channels',
      label: 'Canais Digitais',
      icon: Globe,
      items: [
        { label: 'Landing Page', path: '/analytics', icon: FileText },
        { label: 'Site AutoForce', path: '/site', icon: FileText },
        { label: 'Blog', path: '/blog', icon: FileText }
      ]
    },
    {
      id: 'operations',
      label: 'Operacoes de Campanha',
      icon: Megaphone,
      items: [
        { label: 'Campanhas Ativas', path: '/campaigns', icon: Megaphone },
        { label: 'Biblioteca de Ativos', path: '/assets', icon: FolderOpen },
        { label: 'Emails', path: '/settings', icon: Mail }
      ]
    }
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname === path;
  };

  if (initializing) return <div className="min-h-screen bg-[#00020A] flex items-center justify-center text-white"><RefreshCw className="animate-spin mr-2"/> Carregando AutoForce...</div>;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#00020A] font-sans text-white">
      {/* Main Content */}
      <main className="relative min-h-screen">
        <div className="min-h-screen">
        {/* Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-autoforce-blue/5 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Top Navigation */}
        <header className="sticky top-0 z-40 bg-[#00020A]/90 backdrop-blur-md border-b border-autoforce-grey/10">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src="https://static.autodromo.com.br/uploads/1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.svg"
                  alt="AutoForce"
                  className="h-8 w-auto object-contain"
                />
                <nav className="hidden lg:flex items-center gap-2 text-sm text-autoforce-lightGrey">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        onClick={() => navigate(item.path)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full border transition ${
                          isActive(item.path)
                            ? 'bg-autoforce-blue/20 text-white border-autoforce-blue/40'
                            : 'border-transparent hover:border-autoforce-grey/30 hover:text-white'
                        }`}
                      >
                        <Icon size={16} />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                  {navGroups.map((group) => {
                    const Icon = group.icon;
                    const isOpen = openDropdown === group.id;
                    return (
                      <div key={group.id} className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenDropdown(isOpen ? null : group.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-full border transition ${
                            isOpen ? 'bg-autoforce-blue/20 text-white border-autoforce-blue/40' : 'border-transparent hover:border-autoforce-grey/30 hover:text-white'
                          }`}
                        >
                          <Icon size={16} />
                          <span className="font-medium">{group.label}</span>
                          <ChevronDown size={14} className={`transition ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isOpen && (
                          <div className="absolute left-0 mt-2 w-56 bg-autoforce-darkest border border-autoforce-grey/30 rounded-xl shadow-xl p-2">
                            {group.items.map((child) => {
                              const ChildIcon = child.icon;
                              return (
                                <button
                                  key={child.label}
                                  onClick={() => navigate(child.path)}
                                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                                    isActive(child.path)
                                      ? 'bg-autoforce-blue/20 text-white'
                                      : 'text-autoforce-lightGrey hover:bg-white/5 hover:text-white'
                                  }`}
                                >
                                  <ChildIcon size={14} />
                                  {child.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </nav>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="lg:hidden p-2 rounded-lg border border-autoforce-grey/30 text-autoforce-lightGrey hover:text-white"
                  onClick={() => setIsMenuOpen(prev => !prev)}
                  aria-label="Abrir menu"
                >
                  <Menu size={18} />
                </button>
                <div className="hidden md:flex items-center gap-3">
                  <img src={user.avatar} alt="User" className="w-9 h-9 rounded-full border border-autoforce-blue/50" />
                  <div className="text-xs">
                    <p className="text-white font-semibold leading-tight">{user.name}</p>
                    <p className="text-autoforce-lightGrey">{user.role}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 border border-transparent hover:border-red-400/30 rounded-full px-3 py-2 transition"
                  >
                    <LogOut size={14} />
                    Sair
                  </button>
                </div>
              </div>
            </div>
          </div>

          {isMenuOpen && (
            <div className="lg:hidden border-t border-autoforce-grey/20 bg-autoforce-darkest/90">
              <div className="px-4 py-4 space-y-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      onClick={() => navigate(item.path)}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${
                        isActive(item.path) ? 'bg-autoforce-blue/20 text-white' : 'text-autoforce-lightGrey'
                      }`}
                    >
                      <Icon size={16} />
                      {item.label}
                    </button>
                  );
                })}
                {navGroups.map((group) => {
                  const GroupIcon = group.icon;
                  return (
                    <div key={group.id} className="border border-autoforce-grey/20 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setOpenDropdown(openDropdown === group.id ? null : group.id)}
                        className="w-full flex items-center justify-between px-4 py-2 text-sm text-autoforce-lightGrey"
                      >
                        <span className="flex items-center gap-2">
                          <GroupIcon size={16} />
                          {group.label}
                        </span>
                        <ChevronDown size={14} className={`transition ${openDropdown === group.id ? 'rotate-180' : ''}`} />
                      </button>
                      {openDropdown === group.id && (
                        <div className="px-2 pb-2 space-y-1">
                          {group.items.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <button
                                key={child.label}
                                onClick={() => navigate(child.path)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                                  isActive(child.path) ? 'bg-autoforce-blue/20 text-white' : 'text-autoforce-lightGrey'
                                }`}
                              >
                                <ChildIcon size={14} />
                                {child.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="flex items-center gap-3 pt-2 border-t border-autoforce-grey/20">
                  <img src={user.avatar} alt="User" className="w-9 h-9 rounded-full border border-autoforce-blue/50" />
                  <div className="text-xs flex-1">
                    <p className="text-white font-semibold leading-tight">{user.name}</p>
                    <p className="text-autoforce-lightGrey">{user.role}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Sair
                  </button>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Content Area - AS ROTAS REAIS */}
        <div className="relative z-10">
            <Routes>
                {/* Rota Dashboard (Home) */}
                <Route path="/" element={<DashboardContent metrics={metrics} dailyLeads={dailyLeads} revenueHistory={revenueHistory} loadingData={loadingData} />} />
                <Route path="/dashboard" element={<Navigate to="/" replace />} />

                {/* Outras Rotas */}
                <Route path="/leads" element={<LeadTracker />} />
                <Route path="/weekly" element={<WeeklyView />} />
                <Route path="/revenue" element={<RevenueTracker />} />
                <Route path="/team" element={<TeamView />} />
                <Route path="/okrs" element={<OKRTracker />} />
                <Route path="/analytics" element={<LPView pages={landingPages} loading={loadingData} />} />
                <Route path="/site" element={<SiteView />} />
                <Route path="/blog" element={<BlogView />} />
                <Route path="/campaigns" element={<CampaignsView />} />
                <Route path="/assets" element={<AssetsView />} />

                {/* Rota ConfiguraÃ§Ãµes */}
                <Route path="/settings" element={<EmailsView />} />
            </Routes>
        </div>
        </div>
      </main>
    </div>
  );
};

// --- WRAPPER PARA O ROUTER (Importante!) ---
const App: React.FC = () => {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
};

export default App;
