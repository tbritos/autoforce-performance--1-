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
import { DataService } from './services/dataService';
import { User, Metric, TabView, LandingPage, DailyLeadEntry, RevenueEntry } from './types';
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
  Calendar,
  Package,
  Megaphone,
  FolderOpen,
  Users,
  Menu,
  ChevronDown
} from 'lucide-react';
import { FunnelChart } from './components/Charts';

// --- COMPONENTE DO CONTEÃšDO DO DASHBOARD (ExtraÃ­do para limpar o cÃ³digo) ---
const DashboardContent: React.FC<{
    metrics: Metric[], 
    dailyLeads: DailyLeadEntry[],
    revenueHistory: RevenueEntry[],
    loadingData: boolean 
}> = ({ metrics, dailyLeads, revenueHistory, loadingData }) => {
    const [period, setPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('6m');
    
    // Fallback de segurança para evitar erro se metrics vier vazio
    const safeMetrics = Array.isArray(metrics) ? metrics : [];
    const safeDailyLeads = Array.isArray(dailyLeads) ? dailyLeads : [];
    const safeRevenueHistory = Array.isArray(revenueHistory) ? revenueHistory : [];

    const formatCurrency = (val: number) => {
        if (Number.isNaN(val)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const filteredDailyLeads = useMemo(() => {
        if (period === 'all') return safeDailyLeads;
        const months = period === '3m' ? 3 : period === '6m' ? 6 : 12;
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);
        return safeDailyLeads.filter(entry => new Date(entry.date) >= cutoff);
    }, [period, safeDailyLeads]);

    const filteredRevenue = useMemo(() => {
        if (period === 'all') return safeRevenueHistory;
        const months = period === '3m' ? 3 : period === '6m' ? 6 : 12;
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);
        return safeRevenueHistory.filter(entry => new Date(entry.date) >= cutoff);
    }, [period, safeRevenueHistory]);

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
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {safeMetrics.map((metric) => (
                <div key={metric.id} className="bg-autoforce-darkest p-6 rounded-lg border border-autoforce-grey/20 relative overflow-hidden group hover:border-autoforce-blue/50 transition-all shadow-lg hover:shadow-autoforce-blue/10">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Award size={40} />
                </div>
                <h3 className="text-autoforce-lightGrey text-xs font-bold uppercase tracking-wider mb-2">{metric.label}</h3>
                <div className="flex items-end gap-2">
                    <span className="text-3xl font-display font-bold text-white">{metric.unit}{(metric.value || 0).toLocaleString()}</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                    <div className={`text-sm font-bold flex items-center gap-1 ${metric.trend === 'up' ? 'text-green-400' : metric.trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
                        {metric.trend === 'up' ? <TrendingUp size={14} /> : metric.trend === 'down' ? <TrendingDown size={14} /> : null}
                        {metric.change > 0 ? '+' : ''}{metric.change}%
                    </div>
                    <span className="text-[10px] text-autoforce-grey bg-white/5 px-2 py-0.5 rounded">Meta: {metric.unit}{(metric.target || 0).toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 mt-3 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full ${metric.trend === 'up' ? 'bg-autoforce-blue' : 'bg-autoforce-accent'}`} 
                        style={{ width: `${Math.min(((metric.value || 0) / (metric.target || 1)) * 100, 100)}%` }}
                    ></div>
                </div>
                </div>
            ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 bg-autoforce-darkest p-6 rounded-lg border border-autoforce-grey/20">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                        <h3 className="text-lg font-bold text-white font-display">Funil de Vendas (MQL &gt; SQL &gt; Vendas)</h3>
                        <div className="flex items-center gap-2 text-xs text-autoforce-grey">
                            <span>PerÃ­odo:</span>
                            <div className="bg-autoforce-black/50 rounded px-2 py-1 flex items-center gap-2 border border-autoforce-grey/20">
                                <Calendar size={12} className="text-autoforce-blue"/>
                                <select
                                    value={period}
                                    onChange={(e) => setPeriod(e.target.value as typeof period)}
                                    className="bg-autoforce-black text-xs font-bold text-white outline-none cursor-pointer"
                                >
                                    <option className="bg-autoforce-darkest text-white" value="3m">Ãšltimos 3 meses</option>
                                    <option className="bg-autoforce-darkest text-white" value="6m">Ãšltimos 6 meses</option>
                                    <option className="bg-autoforce-darkest text-white" value="12m">Ãšltimos 12 meses</option>
                                    <option className="bg-autoforce-darkest text-white" value="all">Todo perÃ­odo</option>
                                </select>
                            </div>
                        </div>
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
                        <p className="text-sm text-autoforce-lightGrey">Nenhum ganho no perÃ­odo.</p>
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
                        <p className="text-sm text-autoforce-lightGrey">Nenhum ganho no perÃ­odo.</p>
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
                        MRR por MÃªs
                    </h3>
                    {monthlyMRRDisplay.length === 0 ? (
                        <p className="text-sm text-autoforce-lightGrey">Nenhum ganho no perÃ­odo.</p>
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
    try {
        const savedUser = localStorage.getItem('autoforce_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          if (parsedUser && parsedUser.email) {
            setUser(parsedUser);
          } else {
            localStorage.removeItem('autoforce_user');
          }
        }
    } catch (e) {
        console.error("Erro ao restaurar sessÃ£o:", e);
        localStorage.removeItem('autoforce_user');
    } finally {
        setInitializing(false);
    }
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

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('autoforce_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('autoforce_user');
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


