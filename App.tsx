import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import Login from './components/Login';
import LPView from './components/LPView';
import LeadTracker from './components/LeadTracker';
import WebhookLeadsView from './components/WebhookLeadsView';
import RevenueTracker from './components/RevenueTracker';
import CampaignsView from './components/CampaignsView';
import EmailsView from './components/EmailsView';
import ConnectionsView from './components/ConnectionsView';
import DocsView from './components/DocsView';
import LeadHubView from './components/LeadHubView';
import LeadProfilePanel from './components/LeadProfilePanel';
import UTMTrackerView from './components/UTMTrackerView';
import FunnelView from './components/FunnelView';
import { DataService } from './services/dataService';
import { User, Metric, LandingPage, DailyLeadEntry, RevenueEntry, KpiGoal, FunnelCounts, LeadStatus } from './types';
import {
  LayoutDashboard,
  Mail,
  LogOut,
  TrendingUp,
  TrendingDown,
  Target,
  Globe,
  Award,
  RefreshCw,
  DollarSign,
  CalendarDays,
  Package,
  Megaphone,
  Users,
  BarChart3,
  Menu,
  SlidersHorizontal,
  PlugZap,
  Link2,
  Layers,
  BookOpen,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { FunnelChart, FunnelStep } from './components/Charts';

// ─── Tooltip info icon ────────────────────────────────────────────────────────

const TooltipInfo: React.FC<{ text: string; position?: 'top' | 'bottom' }> = ({ text, position = 'top' }) => {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <Info size={11} style={{ color: 'var(--fg-subtle)', cursor: 'help', flexShrink: 0 }} />
      {show && (
        <span
          className="absolute z-[9999] w-60 rounded-xl p-3 text-xs leading-relaxed pointer-events-none"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--fg-muted)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            ...(position === 'top'
              ? { bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' }
              : { top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' }),
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
};

// ─── Pure date helpers (module-level to avoid TDZ in useMemo callbacks) ────────

const parseDateOnly = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

const normalizeRange = (startValue: string, endValue: string) => {
  const start = parseDateOnly(startValue);
  const end   = parseDateOnly(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return start <= end ? { start, end } : { start: end, end: start };
};

// ─── Pure format helpers (module-level to avoid TDZ in useMemo callbacks) ──────

const formatCurrency = (val: number) => {
    if (Number.isNaN(val)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatMetricValue = (metric: Metric, value: number) => {
    if (metric.unit === '%') {
        return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
    }
    if (metric.unit === 'R$') return formatCurrency(value);
    return new Intl.NumberFormat('pt-BR').format(value);
};

const formatMetricTarget = (metric: Metric, value: number) => {
    if (metric.unit === '%') {
        return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
    }
    if (metric.unit === 'R$') return formatCurrency(value);
    return new Intl.NumberFormat('pt-BR').format(value);
};

// ─── Dashboard constants ───────────────────────────────────────────────────────

const FUNNEL_STAGES: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'LEAD',         label: 'Lead',           color: 'var(--sl-400)' },
  { status: 'MQL',          label: 'MQL',            color: 'var(--af-500)' },
  { status: 'SQL',          label: 'SQL',            color: '#818cf8' },
  { status: 'SCHEDULED',    label: 'Agendado',       color: '#f59e0b' },
  { status: 'DEMO',         label: 'Demo',           color: '#f97316' },
  { status: 'PROPOSAL',     label: 'Proposta',       color: '#a855f7' },
  { status: 'CLIENT',       label: 'Cliente',        color: 'var(--green-500)' },
  { status: 'LOST',         label: 'Perdido',        color: 'var(--red-500)' },
  { status: 'DISQUALIFIED', label: 'Desqualificado', color: 'var(--fg-subtle)' },
];

// --- COMPONENTE DO CONTEÃšDO DO DASHBOARD (ExtraÃ­do para limpar o cÃ³digo) ---
const DashboardContent: React.FC<{
    metrics: Metric[],
    revenueHistory: RevenueEntry[],
    loadingData: boolean
}> = ({ metrics, revenueHistory, loadingData }) => {
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date(end.getFullYear(), end.getMonth(), 1);
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

    // ── Quick-insights state ─────────────────────────────────────────────────
    const [funnelCounts, setFunnelCounts] = useState<FunnelCounts | null>(null);
    const [leadsBySource, setLeadsBySource] = useState<{ source: string; count: number }[]>([]);
    const [metaSpend, setMetaSpend]   = useState(0);
    const [googleSpend, setGoogleSpend] = useState(0);
    const [visits, setVisits]         = useState(0);
    const [insightsLoading, setInsightsLoading] = useState(true);

    // ── Lead KPI stats from Lead table (replaces DailyLead) ──────────────────
    const [leadStats, setLeadStats] = useState({ leads: 0, mqls: 0, sqls: 0 });
    const [prevLeadStats, setPrevLeadStats] = useState({ leads: 0, mqls: 0, sqls: 0 });

    useEffect(() => {
      let cancelled = false;
      const load = async () => {
        setInsightsLoading(true);
        try {
          // Compute previous period (same duration, immediately before)
          const startD  = new Date(dateRange.start);
          const endD    = new Date(dateRange.end);
          const dayMs   = 24 * 60 * 60 * 1000;
          const rangeDays = Math.round((endD.getTime() - startD.getTime()) / dayMs) + 1;
          const prevEnd   = new Date(startD.getTime() - dayMs);
          const prevStart = new Date(prevEnd.getTime() - (rangeDays - 1) * dayMs);
          const prevStartStr = prevStart.toISOString().split('T')[0];
          const prevEndStr   = prevEnd.toISOString().split('T')[0];

          const [funnel, source, meta, google, lps, curr, prev] = await Promise.all([
            DataService.getFunnelCounts(),
            DataService.getLeadsBySource(),
            DataService.getMetaCampaigns(dateRange.start, dateRange.end),
            DataService.getGoogleAdsCampaigns(dateRange.start, dateRange.end),
            DataService.getLandingPagesGA(dateRange.start, dateRange.end),
            DataService.getLeadStats(dateRange.start, dateRange.end),
            DataService.getLeadStats(prevStartStr, prevEndStr),
          ]);
          if (cancelled) return;
          setFunnelCounts(funnel);
          setLeadsBySource(source);
          setMetaSpend(meta.reduce((s, c) => s + (c.spend || 0), 0));
          setGoogleSpend(google.reduce((s, c) => s + (c.spend || 0), 0));
          setVisits(lps.reduce((s, lp) => s + (lp.users || 0), 0));
          setLeadStats(curr);
          setPrevLeadStats(prev);
        } catch (err) {
          console.error('Insights load error:', err);
        } finally {
          if (!cancelled) setInsightsLoading(false);
        }
      };
      load();
      return () => { cancelled = true; };
    }, [dateRange.start, dateRange.end]);

    const totalInvest = useMemo(() => metaSpend + googleSpend, [metaSpend, googleSpend]);

    // Conversion rates use leadStats (period-filtered) + revenue filtered by same range
    const conversionRates = useMemo(() => {
      const { leads, mqls, sqls } = leadStats;
      const revenue = Array.isArray(revenueHistory) ? revenueHistory : [];
      const range = normalizeRange(dateRange.start, dateRange.end);
      const vendas = range
        ? revenue.filter(e => { const d = parseDateOnly(e.date); return d >= range.start && d <= range.end; }).length
        : revenue.length;
      return {
        leadToMql:  leads > 0 ? (mqls  / leads) * 100 : 0,
        mqlToSql:   mqls  > 0 ? (sqls  / mqls)  * 100 : 0,
        sqlToSale:  sqls  > 0 ? (vendas / sqls)  * 100 : 0,
        leadToSale: leads > 0 ? (vendas / leads) * 100 : 0,
      };
    }, [leadStats, revenueHistory, dateRange.start, dateRange.end]);

    const totalFunnelLeads = useMemo(
      () => (funnelCounts ? Object.values(funnelCounts).reduce((a, b) => a + b, 0) : 0),
      [funnelCounts]
    );

    // CPL = investimento no período ÷ leads captados no período
    const cpl = useMemo(() => {
      if (totalInvest === 0 || leadStats.leads === 0) return 0;
      return totalInvest / leadStats.leads;
    }, [totalInvest, leadStats.leads]);

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

    // aggregateForRange uses function declaration (hoisted) so it cannot cause TDZ
    // even if a minifier reorders const initialisations inside this component.
    function aggregateForRange(startValue: string, endValue: string) {
        const range = normalizeRange(startValue, endValue);
        if (!range) return { mrr: 0, sales: 0 };
        const { start, end } = range;
        const revenue = safeRevenueHistory.filter(entry => {
            const entryDate = parseDateOnly(entry.date);
            return entryDate >= start && entryDate <= end;
        });
        return {
            mrr:   revenue.reduce((sum, item) => sum + (item.mrrValue || 0), 0),
            sales: revenue.length,
        };
    }

    const filteredRevenue = useMemo(() => {
        const range = normalizeRange(dateRange.start, dateRange.end);
        if (!range) return safeRevenueHistory;
        return safeRevenueHistory.filter(entry => {
            const entryDate = parseDateOnly(entry.date);
            return entryDate >= range.start && entryDate <= range.end;
        });
    }, [dateRange.end, dateRange.start, safeRevenueHistory]);

    const computedMetrics = useMemo(() => {
        // Revenue metrics from RevenueEntry (filtered by date in the existing memos)
        const currentMrr   = filteredRevenue.reduce((s, e) => s + (e.mrrValue || 0), 0);
        const currentSales = filteredRevenue.length;

        // Lead/MQL/SQL metrics from Lead table (via leadStats API — real data)
        const rawLeadsChange = prevLeadStats.leads > 0 ? ((leadStats.leads - prevLeadStats.leads) / prevLeadStats.leads) * 100 : 0;
        const mqlsChange     = prevLeadStats.mqls  > 0 ? ((leadStats.mqls  - prevLeadStats.mqls)  / prevLeadStats.mqls)  * 100 : 0;
        const currentQual    = leadStats.leads > 0 ? (leadStats.mqls / leadStats.leads) * 100 : 0;
        const prevQual       = prevLeadStats.leads > 0 ? (prevLeadStats.mqls / prevLeadStats.leads) * 100 : 0;
        const qualChange     = currentQual - prevQual;

        // Revenue comparison — use filteredRevenue vs safeRevenueHistory for prev period
        const range = normalizeRange(dateRange.start, dateRange.end);
        let mrrChange = 0, salesChange = 0;
        if (range) {
          const dayMs = 24 * 60 * 60 * 1000;
          const rangeDays = Math.round((range.end.getTime() - range.start.getTime()) / dayMs) + 1;
          const prevEnd   = new Date(range.start.getTime() - dayMs);
          const prevStart = new Date(prevEnd.getTime() - (rangeDays - 1) * dayMs);
          const prev = aggregateForRange(prevStart.toISOString().split('T')[0], prevEnd.toISOString().split('T')[0]);
          mrrChange   = prev.mrr   > 0 ? ((currentMrr   - prev.mrr)   / prev.mrr)   * 100 : 0;
          salesChange = prev.sales > 0 ? ((currentSales - prev.sales) / prev.sales) * 100 : 0;
        }

        return [
            {
                id: '0',
                label: 'Total de Leads',
                value: leadStats.leads,
                target: 5000,
                unit: '',
                change: Number(rawLeadsChange.toFixed(1)),
                trend: (rawLeadsChange >= 0 ? 'up' : 'down') as 'up' | 'down' | 'neutral',
                description: 'Leads capturados no período',
                tooltip: 'Novos contatos criados no sistema no período selecionado, vindos de todas as fontes: formulários, webhooks, RD Station, Pipedrive, etc.',
            },
            {
                id: '1',
                label: 'Total de MQLs',
                value: leadStats.mqls,
                target: 4000,
                unit: '',
                change: Number(mqlsChange.toFixed(1)),
                trend: (mqlsChange >= 0 ? 'up' : 'down') as 'up' | 'down' | 'neutral',
                description: 'Leads qualificados no período',
                tooltip: 'Quantidade de vezes que um lead avançou para o status MQL no período. Um lead pode ser qualificado mais de uma vez se retornar ao funil.',
            },
            {
                id: '2',
                label: 'Taxa Lead → MQL',
                value: Number(currentQual.toFixed(1)),
                target: 45,
                unit: '%',
                change: Number(qualChange.toFixed(1)),
                trend: (qualChange >= 0 ? 'up' : 'down') as 'up' | 'down' | 'neutral',
                description: 'Leads convertidos em MQL no período',
                tooltip: 'Percentual de leads que se tornaram MQL no período. Calculado como: MQLs no período ÷ Leads no período. Não é cohort — um lead criado antes pode virar MQL dentro do período.',
            },
            {
                id: '3',
                label: 'MRR Novo',
                value: Number(currentMrr.toFixed(2)),
                target: 15000,
                unit: 'R$',
                change: Number(mrrChange.toFixed(1)),
                trend: (mrrChange >= 0 ? 'up' : 'down') as 'up' | 'down' | 'neutral',
                description: 'Receita recorrente adicionada',
                tooltip: 'Soma do MRR (Receita Mensal Recorrente) dos negócios ganhos no Pipedrive no período. Inclui apenas negócios inbound. Atualizado automaticamente.',
            },
            {
                id: '4',
                label: 'Vendas Realizadas',
                value: currentSales,
                target: 120,
                unit: '',
                change: Number(salesChange.toFixed(1)),
                trend: (salesChange >= 0 ? 'up' : 'down') as 'up' | 'down' | 'neutral',
                description: 'Negócios fechados no período',
                tooltip: 'Quantidade de negócios marcados como ganhos no Pipedrive (canal inbound) dentro do período selecionado. Atualizado automaticamente via sync.',
            },
        ];
    }, [leadStats, prevLeadStats, filteredRevenue, dateRange.start, dateRange.end, safeRevenueHistory]);

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

    const funnelSteps = useMemo((): FunnelStep[] => {
        return [
            { label: 'Visitas', value: visits,                color: '#64748b' },
            { label: 'Leads',   value: leadStats.leads,       color: '#60a5fa' },
            { label: 'MQL',     value: leadStats.mqls,        color: '#3b82f6' },
            { label: 'SQL',     value: leadStats.sqls,        color: '#818cf8' },
            { label: 'Vendas',  value: filteredRevenue.length, color: '#22c55e' },
        ];
    }, [leadStats, filteredRevenue, visits]);
    
    return (
        <div style={{ padding: '24px 28px 64px', maxWidth: 1480, margin: '0 auto' }} className="space-y-6 animate-fade-in-up">
            <div className="flex justify-end items-start gap-4 flex-wrap">
                <div className="flex items-center gap-3 ds-card" style={{ padding: '8px 14px' }}>
                    <div className="flex items-center gap-2">
                        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--fg-subtle)', fontWeight: 500 }}>De</label>
                        <div className="relative">
                            <input
                                id="dashboard-start-date"
                                type="date"
                                ref={startDateRef}
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="date-input"
                                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '5px 32px 5px 10px', fontSize: 12, color: 'var(--fg-primary)', outline: 'none' }}
                            />
                            <button
                                type="button"
                                onClick={() => (startDateRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.()}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', background: 'none', border: 'none', padding: 0 }}
                                aria-label="Abrir calendario inicial"
                            >
                                <CalendarDays size={12} />
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--fg-subtle)', fontWeight: 500 }}>Até</label>
                        <div className="relative">
                            <input
                                id="dashboard-end-date"
                                type="date"
                                ref={endDateRef}
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="date-input"
                                style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '5px 32px 5px 10px', fontSize: 12, color: 'var(--fg-primary)', outline: 'none' }}
                            />
                            <button
                                type="button"
                                onClick={() => (endDateRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.()}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', background: 'none', border: 'none', padding: 0 }}
                                aria-label="Abrir calendario final"
                            >
                                <CalendarDays size={12} />
                            </button>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowGoals(true)}
                        style={{ marginLeft: 4, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: '50%', color: 'var(--accent)', transition: 'background .15s' }}
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
                    <aside
                        className={`relative mt-24 w-full max-w-md shadow-2xl overflow-y-auto ${showHistory && goalHistory.length > 0 ? 'max-h-[520px]' : 'max-h-[210px]'} ${closingGoals ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '24px 0 0 24px', padding: 20 }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>Metas dos Cards</h3>
                            <button
                                type="button"
                                onClick={handleCloseGoals}
                                style={{ fontSize: 12, color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                Fechar
                            </button>
                        </div>
                        <form onSubmit={handleGoalSubmit} className="space-y-3">
                            <div className="grid grid-cols-1 gap-2">
                                <select
                                    value={goalMetricId}
                                    onChange={(e) => setGoalMetricId(e.target.value)}
                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '7px 10px', fontSize: 12, color: 'var(--fg-primary)', outline: 'none' }}
                                >
                                    {computedMetrics.map(metric => (
                                        <option key={metric.id} value={metric.id}>{metric.label}</option>
                                    ))}
                                </select>
                                <input
                                    value={goalTarget}
                                    onChange={(e) => setGoalTarget(e.target.value)}
                                    type="number"
                                    style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '7px 10px', fontSize: 12, color: 'var(--fg-primary)', outline: 'none' }}
                                    placeholder="Defina a meta"
                                    required
                                />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowHistory(prev => !prev)}
                                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                    Histórico
                                </button>
                                {editingGoalId && (
                                    <button
                                        type="button"
                                        onClick={() => { setEditingGoalId(null); setGoalTarget(''); }}
                                        style={{ fontSize: 12, color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        Cancelar
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--r-md)', padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
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
                                        <div key={goal.id} className="flex items-center justify-between" style={{ fontSize: 12, background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 12px' }}>
                                            <div>
                                                <p style={{ color: 'var(--fg-primary)', fontWeight: 600, margin: 0 }}>{metricLabel}</p>
                                                <p style={{ color: 'var(--fg-muted)', margin: 0 }}>Meta: {goal.target}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditGoal(goal)}
                                                    style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCompleteGoal(goal)}
                                                    style={{ fontSize: 12, color: 'var(--green-600)', background: 'none', border: 'none', cursor: 'pointer' }}
                                                >
                                                    Concluir
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteGoal(goal.id)}
                                                    style={{ fontSize: 12, color: 'var(--red-600)', background: 'none', border: 'none', cursor: 'pointer' }}
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
                                        <div key={goal.id} style={{ fontSize: 12, color: 'var(--fg-muted)', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 12px' }}>
                                            <p style={{ color: 'var(--fg-primary)', fontWeight: 600, margin: 0 }}>{metricLabel}</p>
                                            <p style={{ margin: 0 }}>Meta: {goal.target}</p>
                                            <p style={{ margin: 0 }}>Concluída em: {goal.completedAt ? new Date(goal.completedAt).toLocaleDateString('pt-BR') : ''}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {showHistory && goalHistory.length === 0 && (
                            <p className="mt-3" style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Nenhuma meta concluída.</p>
                        )}
                    </aside>
                </div>
            )}
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {computedMetrics.map((metric) => {
                const goalTarget = goalTargets.get(metric.id);
                const target = goalTarget ?? metric.target;
                const isAccent = metric.id === '3'; // MRR Novo gets accent
                const pct = Math.min(((metric.value || 0) / (target || 1)) * 100, 100);
                return (
                <div key={metric.id} className={`ds-kpi${isAccent ? ' ds-kpi-accent' : ''}`}>
                  <div className="ds-kpi-row">
                    <div className="ds-kpi-label" style={{ gap: 5 }}>
                      <Award size={12} />
                      {metric.label}
                      {(metric as { tooltip?: string }).tooltip && (
                        <TooltipInfo text={(metric as { tooltip?: string }).tooltip!} />
                      )}
                    </div>
                    <span className={`ds-kpi-delta ${metric.trend === 'up' ? 'up' : metric.trend === 'down' ? 'down' : 'up'}`}>
                      {metric.trend === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {metric.change > 0 ? '+' : ''}{metric.change}%
                    </span>
                  </div>
                  <div className="ds-kpi-value">
                    {formatMetricValue(metric, metric.value || 0)}
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 4, borderRadius: 2, background: isAccent ? 'rgba(255,255,255,0.18)' : 'var(--bg-muted)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      borderRadius: 2,
                      background: isAccent ? 'rgba(255,255,255,0.7)' : 'var(--accent)',
                      transition: 'width .6s ease',
                    }} />
                  </div>
                  <div className="ds-kpi-foot">
                    {metric.description} · Meta: {formatMetricTarget(metric, target || 0)}
                  </div>
                </div>
                );
            })}
            </div>

            {/* Quick Insights strip */}
            {(() => {
              const fmt = (v: number) => formatCurrency(v);
              const pct = (v: number) => `${v.toFixed(1)}%`;
              const dash = '—';
              const tiles = [
                { label: 'Total Investido', value: insightsLoading ? dash : fmt(totalInvest), icon: DollarSign, color: 'var(--af-600)',    tooltip: 'Soma do gasto em Meta Ads (Facebook/Instagram) + Google Ads no período selecionado. Atualizado via sincronização automática.' },
                { label: 'CPL',             value: insightsLoading ? dash : (cpl > 0 ? fmt(cpl) : dash), icon: Target, color: 'var(--green-600)', tooltip: 'Custo por Lead: quanto foi investido em mídia paga para cada novo lead captado no período. Calculado como: Total Investido ÷ Total de Leads.' },
                { label: 'Lead → MQL',      value: insightsLoading ? dash : pct(conversionRates.leadToMql),  icon: TrendingUp, color: 'var(--af-500)',    tooltip: 'Taxa de conversão de Lead para MQL no período. Calculado como: MQLs no período ÷ Leads no período. Indica a qualidade dos leads gerados.' },
                { label: 'MQL → SQL',       value: insightsLoading ? dash : pct(conversionRates.mqlToSql),   icon: TrendingUp, color: '#818cf8',          tooltip: 'Taxa de conversão de MQL para SQL (Sales Qualified Lead). Indica quantos leads qualificados pelo marketing evoluíram para o estágio comercial.' },
                { label: 'SQL → Venda',     value: insightsLoading ? dash : pct(conversionRates.sqlToSale),  icon: TrendingUp, color: 'var(--yellow-600)', tooltip: 'Taxa de conversão de SQL para negócio ganho. Indica a eficiência do time de vendas em fechar os negócios que chegaram até eles.' },
                { label: 'Lead → Venda',    value: insightsLoading ? dash : pct(conversionRates.leadToSale), icon: Target,     color: 'var(--green-500)', tooltip: 'Taxa de conversão total: do primeiro contato até o fechamento. Calculado como: Vendas no período ÷ Leads no período.' },
              ];
              return (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {tiles.map(t => (
                    <div key={t.label} className="ds-card" style={{ flex: '1 1 148px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: `${t.color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <t.icon size={14} style={{ color: t.color }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <p style={{ fontSize: 10, color: 'var(--fg-subtle)', margin: 0, textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{t.label}</p>
                          <TooltipInfo text={t.tooltip} position="bottom" />
                        </div>
                        <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-primary)', margin: 0, fontVariantNumeric: 'tabular-nums' }}>{t.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Funnel Chart */}
            <div className="ds-card">
              <div className="ds-card-head">
                <span className="ttl"><BarChart3 size={14} className="ico" /> Funil de Vendas — Visitas → Leads → MQL → SQL → Vendas</span>
              </div>
              <div style={{ padding: '16px 20px 20px' }}>
                <FunnelChart steps={funnelSteps} isLoading={loadingData || insightsLoading} />
              </div>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Leads por Canal */}
                <div className="ds-card">
                  <div className="ds-card-head">
                    <span className="ttl"><Globe size={14} className="ico" /> Leads por Canal</span>
                  </div>
                  <div className="ds-card-pad space-y-3">
                    {insightsLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} style={{ height: 28, background: 'var(--bg-muted)', borderRadius: 4 }} className="animate-pulse" />
                      ))
                    ) : leadsBySource.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Nenhum dado disponível.</p>
                    ) : leadsBySource.slice(0, 6).map(item => {
                      const pct = totalFunnelLeads > 0 ? Math.round((item.count / totalFunnelLeads) * 100) : 0;
                      return (
                        <div key={item.source} className="space-y-1">
                          <div className="flex items-center justify-between" style={{ fontSize: 12 }}>
                            <span style={{ color: 'var(--fg-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.source}</span>
                            <span style={{ color: 'var(--fg-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                              {item.count.toLocaleString('pt-BR')} <span style={{ color: 'var(--fg-subtle)', fontWeight: 400 }}>({pct}%)</span>
                            </span>
                          </div>
                          <div style={{ height: 4, borderRadius: 3, background: 'var(--bg-muted)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width .5s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Lead por Etapa */}
                <div className="ds-card">
                  <div className="ds-card-head">
                    <span className="ttl"><Layers size={14} className="ico" /> Lead por Etapa</span>
                  </div>
                  <div className="ds-card-pad space-y-2">
                    {insightsLoading ? (
                      Array.from({ length: 7 }).map((_, i) => (
                        <div key={i} style={{ height: 22, background: 'var(--bg-muted)', borderRadius: 4 }} className="animate-pulse" />
                      ))
                    ) : FUNNEL_STAGES.map(stage => {
                      const count = funnelCounts?.[stage.status] ?? 0;
                      const pct = totalFunnelLeads > 0 ? Math.round((count / totalFunnelLeads) * 100) : 0;
                      return (
                        <div key={stage.status} className="flex items-center justify-between gap-2">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{stage.label}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-primary)', fontVariantNumeric: 'tabular-nums' }}>
                            {count.toLocaleString('pt-BR')} <span style={{ fontWeight: 400, color: 'var(--fg-subtle)' }}>({pct}%)</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Produtos */}
                <div className="ds-card">
                  <div className="ds-card-head">
                    <span className="ttl"><Package size={14} className="ico" /> Top Produtos</span>
                  </div>
                  <div className="ds-card-pad space-y-3">
                    {topProducts.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Nenhum ganho no período.</p>
                    ) : topProducts.map(item => (
                      <div key={item.name} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--fg-primary)' }}>{item.name}</p>
                          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>{item.count} vendas</p>
                        </div>
                        <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.mrr)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Origem */}
                <div className="ds-card">
                  <div className="ds-card-head">
                    <span className="ttl"><Globe size={14} className="ico" /> Origem dos Ganhos</span>
                  </div>
                  <div className="ds-card-pad space-y-3">
                    {originBreakdown.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Nenhum ganho no período.</p>
                    ) : originBreakdown.map(item => (
                      <div key={item.name} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--fg-primary)' }}>{item.name}</p>
                          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>{item.count} vendas</p>
                        </div>
                        <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.mrr)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* MRR por mês */}
                <div className="ds-card">
                  <div className="ds-card-head">
                    <span className="ttl"><TrendingUp size={14} className="ico" /> MRR por Mês</span>
                  </div>
                  <div className="ds-card-pad space-y-3">
                    {monthlyMRRDisplay.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Nenhum ganho no período.</p>
                    ) : monthlyMRRDisplay.map(item => (
                      <div key={item.label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span style={{ color: 'var(--fg-muted)' }}>{item.label}</span>
                          <span style={{ color: 'var(--fg-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{formatCurrency(item.total)}</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-muted)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.round((item.total / maxMonthlyMRR) * 100)}%`,
                            background: 'var(--green-500)', borderRadius: 3,
                            transition: 'width .5s ease',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            </div>
        </div>
    );
};


const LeadProfilePage: React.FC = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();

  if (!leadId) return <Navigate to="/leads" replace />;

  return (
    <LeadProfilePanel
      leadId={decodeURIComponent(leadId)}
      variant="page"
      onClose={() => navigate('/leads')}
    />
  );
};


// --- COMPONENTE PRINCIPAL (COM ROTEAMENTO) ---
const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() =>
    localStorage.getItem('autoforce_sidebar_collapsed') === 'true'
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('autoforce_theme') as 'light' | 'dark') || 'light'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('autoforce_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('autoforce_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);
  
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
        const search = new URLSearchParams(window.location.search);
        const authToken = search.get('auth_token');
        const authUser = search.get('auth_user');
        const authError = search.get('auth_error');

        if (authToken && authUser) {
          const parsedUser = JSON.parse(authUser) as User;
          localStorage.setItem('autoforce_token', authToken);
          localStorage.setItem('autoforce_user', JSON.stringify(parsedUser));
          setUser(parsedUser);
          window.history.replaceState({}, document.title, window.location.pathname);
          setInitializing(false);
          return;
        }

        if (authError) {
          console.error('Erro no login Google:', authError);
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const savedToken = localStorage.getItem('autoforce_token');
        if (!savedToken) {
          localStorage.removeItem('autoforce_user');
          setInitializing(false);
          return;
        }

        if (import.meta.env.DEV && savedToken === 'dev-local-bypass') {
          const savedUser = localStorage.getItem('autoforce_user');
          if (savedUser) {
            setUser(JSON.parse(savedUser) as User);
            setInitializing(false);
            return;
          }
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

  // ─── Sidebar nav structure ─────────────────────────────────────────────────

  const NAV_GROUPS = [
    {
      label: 'LEADS',
      items: [
        { label: 'Banco de Leads',  path: '/leads',       icon: Users },
        { label: 'UTM Tracker',     path: '/utm',         icon: Link2 },
      ],
    },
    {
      label: 'PERFORMANCE',
      items: [
        { label: 'Funil Unificado', path: '/funnel',      icon: Layers },
        { label: 'Campanhas',       path: '/campaigns',   icon: Megaphone },
        { label: 'Analytics (GA4)', path: '/analytics',   icon: BarChart3 },
        { label: 'E-mails',         path: '/emails',      icon: Mail },
      ],
    },
    {
      label: 'RECEITA & METAS',
      items: [
        { label: 'Ganhos',          path: '/revenue',     icon: DollarSign },
      ],
    },
    {
      label: 'CONFIG',
      items: [
        { label: 'Conexões',        path: '/connections', icon: PlugZap },
        { label: 'Documentação',    path: '/docs',        icon: BookOpen },
      ],
    },
  ];

  const isActive = (path: string) =>
    path === '/'
      ? location.pathname === '/' || location.pathname === '/dashboard'
      : location.pathname.startsWith(path);
  const sidebarWidth = isSidebarCollapsed ? 72 : 248;

  // ─── Loading / Auth guards ──────────────────────────────────────────────────

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-app)' }}>
        <div className="flex items-center gap-3" style={{ color: 'var(--fg-muted)' }}>
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm font-medium">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    if (location.pathname === '/docs') {
      return <DocsView publicMode onBack={() => navigate('/')} />;
    }
    return <Login onLogin={handleLogin} />;
  }

  // ─── Sidebar nav item ───────────────────────────────────────────────────────

  const NavItem = ({ path, icon: Icon, label, collapsed = false }: { path: string; icon: React.ElementType; label: string; collapsed?: boolean }) => (
    <button
      type="button"
      onClick={() => { navigate(path); setIsMenuOpen(false); }}
      className={`ds-nav-item${isActive(path) ? ' active' : ''}`}
      title={collapsed ? label : undefined}
      style={collapsed ? { justifyContent: 'center', padding: '9px 0' } : undefined}
    >
      <Icon size={15} style={{ color: isActive(path) ? 'var(--af-300)' : 'rgba(255,255,255,0.55)', flexShrink: 0 }} />
      {!collapsed && <span>{label}</span>}
    </button>
  );

  // ─── Sidebar content (shared between desktop and mobile) ───────────────────

  const SidebarContent = ({ collapsed = false, mobile = false }: { collapsed?: boolean; mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-3 shrink-0" style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: collapsed ? 6 : 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {!collapsed && (
          <img
            src="https://static.autodromo.com.br/uploads/1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.svg"
            alt="AutoForce"
            style={{ height: 22, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          />
        )}
        {!mobile && (
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(value => !value)}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="hidden lg:flex items-center justify-center rounded-lg transition"
            style={{
              width: 30,
              height: 30,
              color: 'rgba(255,255,255,0.58)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              marginLeft: collapsed ? 0 : 8,
            }}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        <NavItem path="/" icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} />
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            {!collapsed ? (
              <p className="px-2 mb-1 text-[10.5px] font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.32)', paddingLeft: 10 }}>
                {group.label}
              </p>
            ) : (
              <div style={{ height: 1, margin: '8px 10px', background: 'rgba(255,255,255,0.08)' }} />
            )}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavItem key={item.path} path={item.path} icon={item.icon} label={item.label} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="shrink-0 px-2 pb-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          className="ds-nav-item w-full"
          title={collapsed ? (theme === 'dark' ? 'Tema claro' : 'Tema escuro') : undefined}
          style={collapsed ? { justifyContent: 'center', padding: '9px 0', fontSize: 12.5 } : { fontSize: 12.5 }}
        >
          {theme === 'dark'
            ? <><Sun size={13} style={{ color: 'rgba(255,255,255,0.55)' }} />{!collapsed && <span>Tema claro</span>}</>
            : <><Moon size={13} style={{ color: 'rgba(255,255,255,0.55)' }} />{!collapsed && <span>Tema escuro</span>}</>
          }
        </button>

        {/* User row */}
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg" style={{ cursor: 'default', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <img src={user.avatar} alt="Avatar" className="w-7 h-7 rounded-full shrink-0" style={{ border: '1.5px solid rgba(104,146,242,0.5)' }} />
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'white' }}>{user.name}</p>
                <p className="truncate" style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{user.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair"
                className="p-1.5 rounded-md transition shrink-0"
                style={{ color: 'rgba(255,255,255,0.35)', background: 'transparent', border: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
              >
                <LogOut size={13} />
              </button>
            </>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={handleLogout}
            title="Sair"
            className="ds-nav-item w-full"
            style={{ justifyContent: 'center', padding: '9px 0' }}
          >
            <LogOut size={13} style={{ color: 'rgba(255,255,255,0.55)' }} />
          </button>
        )}
      </div>
    </div>
  );

  // ─── App shell ──────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-app)', color: 'var(--fg-primary)' }}>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-40"
        style={{
          width: sidebarWidth,
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          transition: 'width .2s ease',
        }}
      >
        {/* Subtle gradient flourish inside sidebar */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(500px 200px at -10% -10%, rgba(55,84,226,0.18), transparent 60%), radial-gradient(400px 240px at 110% 100%, rgba(104,146,242,0.10), transparent 60%)',
        }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <SidebarContent collapsed={isSidebarCollapsed} />
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}>
          <aside
            className="w-[248px] h-full"
            style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}
            onClick={e => e.stopPropagation()}
          >
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen" style={{ marginLeft: 0 }} >
        <div className="hidden lg:block" style={{ marginLeft: sidebarWidth, transition: 'margin-left .2s ease' }} />

        {/* Mobile topbar */}
        <header
          className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4"
          style={{ height: 56, background: 'var(--bg-sidebar)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}
        >
          <button
            type="button"
            onClick={() => setIsMenuOpen(true)}
            className="p-2 rounded-lg transition"
            style={{ color: 'rgba(255,255,255,0.6)', background: 'transparent', border: 'none' }}
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </button>
          <img
            src="https://static.autodromo.com.br/uploads/1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.svg"
            alt="AutoForce"
            style={{ height: 20, width: 'auto', filter: 'brightness(0) invert(1)' }}
          />
          <img src={user.avatar} alt="Avatar" className="w-7 h-7 rounded-full" style={{ border: '1.5px solid rgba(104,146,242,0.5)' }} />
        </header>

        {/* Page content */}
        <main className="flex-1 app-content" style={{ marginLeft: 0 }}>
          <div
            className="lg:ml-[var(--sidebar-width)] transition-[margin-left] duration-200"
            style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
          >
          <Routes>
            <Route path="/" element={<DashboardContent metrics={metrics} revenueHistory={revenueHistory} loadingData={loadingData} />} />

            <Route path="/dashboard" element={<Navigate to="/" replace />} />

            {/* Leads */}
            <Route path="/leads/:leadId" element={<LeadProfilePage />} />
            <Route path="/leads" element={<LeadHubView />} />
            <Route path="/utm" element={<UTMTrackerView />} />

            {/* Performance */}
            <Route path="/funnel" element={<FunnelView />} />
            <Route path="/campaigns" element={<CampaignsView />} />
            <Route path="/analytics" element={<LPView />} />
            <Route path="/emails" element={<EmailsView />} />

            {/* Receita & Metas */}
            <Route path="/revenue" element={<RevenueTracker />} />
            <Route path="/okrs" element={<Navigate to="/" replace />} />

            {/* Conteúdo */}
            <Route path="/assets" element={<Navigate to="/campaigns" replace />} />
            <Route path="/team" element={<Navigate to="/campaigns" replace />} />

            {/* Config */}
            <Route path="/connections" element={<ConnectionsView />} />
            <Route path="/docs" element={<DocsView onBack={() => navigate(-1)} />} />

            {/* Legado — mantém rotas antigas funcionando */}
            <Route path="/lead-tracker" element={<LeadTracker />} />
            <Route path="/webhook-leads" element={<WebhookLeadsView />} />
            <Route path="/rd-leads" element={<Navigate to="/webhook-leads" replace />} />
            <Route path="/settings" element={<Navigate to="/emails" replace />} />
            <Route path="/weekly" element={<Navigate to="/" replace />} />
            <Route path="/site" element={<Navigate to="/analytics" replace />} />
            <Route path="/blog" element={<Navigate to="/" replace />} />
          </Routes>
          </div>
        </main>
      </div>
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
