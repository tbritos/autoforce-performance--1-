import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import LPView from './components/LPView';
import LeadTracker from './components/LeadTracker';
import RevenueTracker from './components/RevenueTracker';
import OKRTracker from './components/OKRTracker';
import TeamView from './components/TeamView';
import CampaignsView from './components/CampaignsView';
import AssetsView from './components/AssetsView';
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
  Share2,
  Globe,
  Award,
  RefreshCw,
  ClipboardList,
  DollarSign,
  Calendar,
  Package,
  Megaphone,
  PanelLeft,
  FolderOpen,
  Server,
  Database,
  Cloud,
  Users
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Data State
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [dailyLeads, setDailyLeads] = useState<DailyLeadEntry[]>([]);
  const [revenueHistory, setRevenueHistory] = useState<RevenueEntry[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Router Hooks
  const navigate = useNavigate();
  const location = useLocation();

  // FunÃ§Ã£o auxiliar para saber em qual aba estamos baseado na URL
  const getPageTitle = (pathname: string) => {
    if (pathname.includes('leads')) return "Acompanhamento DiÃ¡rio";
    if (pathname.includes('revenue')) return "Ganhos & Resultados";
    if (pathname.includes('team')) return "Calendario Marketing";
    if (pathname.includes('okrs')) return "OKRs do Marketing";
    if (pathname.includes('analytics')) return "Landing Page";
    if (pathname.includes('site')) return "Site AutoForce";
    if (pathname.includes('blog')) return "Blog";
    if (pathname.includes('campaigns')) return "Campanhas Ativas";
    if (pathname.includes('assets')) return "Biblioteca de Ativos";
    if (pathname.includes('settings')) return "Emails";
    return "VisÃ£o Geral de Performance"; // Default
  };

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
    const updateSidebar = () => {
      setIsSidebarOpen(window.innerWidth >= 1024);
    };
    updateSidebar();
    window.addEventListener('resize', updateSidebar);
    return () => window.removeEventListener('resize', updateSidebar);
  }, []);

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

  if (initializing) return <div className="min-h-screen bg-[#00020A] flex items-center justify-center text-white"><RefreshCw className="animate-spin mr-2"/> Carregando AutoForce...</div>;

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-[#00020A] font-sans text-white overflow-hidden">
      {/* Sidebar */}
      <aside className={`bg-autoforce-darkest border-r border-autoforce-grey/20 flex flex-col z-50 transition-all duration-300 fixed top-0 left-0 h-screen transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="flex flex-col min-h-0 flex-1">
          <div className="p-6 border-b border-autoforce-grey/20 flex items-center justify-center">
             {isSidebarOpen ? (
               <img 
                 src="https://static.autodromo.com.br/uploads/1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.svg" 
                 alt="AutoForce" 
                 className="h-8 w-auto object-contain"
               />
             ) : (
               <div className="w-8 h-8 rounded-full bg-autoforce-blue/20 flex items-center justify-center text-autoforce-blue font-bold text-sm">
                 AF
               </div>
             )}
          </div>

          <nav className="p-4 space-y-2 overflow-y-auto custom-scrollbar">
            <button 
              onClick={() => navigate('/')}
              className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-lg transition-all ${location.pathname === '/' || location.pathname === '/dashboard' ? 'bg-autoforce-blue text-white shadow-lg shadow-autoforce-blue/30' : 'text-autoforce-lightGrey hover:bg-white/5'}`}
            >
              <LayoutDashboard size={20} />
              {isSidebarOpen && <span className="font-medium">Performance</span>}
            </button>
            
            <button 
              onClick={() => navigate('/leads')}
              className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-lg transition-all ${location.pathname === '/leads' ? 'bg-autoforce-blue text-white shadow-lg' : 'text-autoforce-lightGrey hover:bg-white/5'}`}
            >
              <ClipboardList size={20} />
              {isSidebarOpen && <span className="font-medium">Acompanhamento</span>}
            </button>
            
            <button 
              onClick={() => navigate('/revenue')}
              className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-lg transition-all ${location.pathname === '/revenue' ? 'bg-autoforce-blue text-white shadow-lg' : 'text-autoforce-lightGrey hover:bg-white/5'}`}
            >
              <DollarSign size={20} />
              {isSidebarOpen && <span className="font-medium">Ganhos</span>}
            </button>

             <button 
              onClick={() => navigate('/team')}
              className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-lg transition-all ${location.pathname === '/team' ? 'bg-autoforce-blue text-white shadow-lg' : 'text-autoforce-lightGrey hover:bg-white/5'}`}
            >
              <Users size={20} />
              {isSidebarOpen && <span className="font-medium">Calendario Marketing</span>}
            </button>

            <button 
              onClick={() => navigate('/okrs')}
              className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-lg transition-all ${location.pathname === '/okrs' ? 'bg-autoforce-blue text-white shadow-lg' : 'text-autoforce-lightGrey hover:bg-white/5'}`}
            >
              <Target size={20} />
              {isSidebarOpen && <span className="font-medium">OKRs do Marketing</span>}
            </button>

            <button 
              onClick={() => navigate('/analytics')}
              className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-lg transition-all ${location.pathname === '/analytics' ? 'bg-autoforce-blue text-white shadow-lg' : 'text-autoforce-lightGrey hover:bg-white/5'}`}
            >
              <FileText size={20} />
              {isSidebarOpen && <span className="font-medium">Landing Page</span>}
            </button>

            <button 
              onClick={() => navigate('/site')}
              className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-lg transition-all ${location.pathname === '/site' ? 'bg-autoforce-blue text-white shadow-lg' : 'text-autoforce-lightGrey hover:bg-white/5'}`}
            >
              <FileText size={20} />
              {isSidebarOpen && <span className="font-medium">Site AutoForce</span>}
            </button>

            <button 
              onClick={() => navigate('/blog')}
              className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-lg transition-all ${location.pathname === '/blog' ? 'bg-autoforce-blue text-white shadow-lg' : 'text-autoforce-lightGrey hover:bg-white/5'}`}
            >
              <FileText size={20} />
              {isSidebarOpen && <span className="font-medium">Blog</span>}
            </button>

            <button 
              onClick={() => navigate('/campaigns')}
              className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-lg transition-all ${location.pathname === '/campaigns' ? 'bg-autoforce-blue text-white shadow-lg' : 'text-autoforce-lightGrey hover:bg-white/5'}`}
            >
              <Megaphone size={20} />
              {isSidebarOpen && <span className="font-medium">Campanhas Ativas</span>}
            </button>

            <button 
              onClick={() => navigate('/assets')}
              className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-lg transition-all ${location.pathname === '/assets' ? 'bg-autoforce-blue text-white shadow-lg' : 'text-autoforce-lightGrey hover:bg-white/5'}`}
            >
              <FolderOpen size={20} />
              {isSidebarOpen && <span className="font-medium">Biblioteca de Ativos</span>}
            </button>

            <button 
              onClick={() => navigate('/settings')}
              className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-3 rounded-lg transition-all ${location.pathname === '/settings' ? 'bg-autoforce-blue text-white shadow-lg' : 'text-autoforce-lightGrey hover:bg-white/5'}`}
            >
              <Mail size={20} />
              {isSidebarOpen && <span className="font-medium">Emails</span>}
            </button>
          </nav>
        </div>

        <div className="p-6 border-t border-autoforce-grey/20">
          <button
            onClick={() => setIsSidebarOpen(prev => !prev)}
            className={`w-full mb-4 hidden lg:flex items-center ${isSidebarOpen ? 'gap-2 justify-start' : 'justify-center'} text-autoforce-lightGrey hover:text-white text-xs font-semibold border border-autoforce-grey/30 rounded-full px-2.5 py-1.5 transition`}
            title={isSidebarOpen ? 'Recolher menu' : 'Expandir menu'}
          >
            <PanelLeft size={14} className={isSidebarOpen ? '' : 'rotate-180'} />
            {isSidebarOpen && <span>Recolher menu</span>}
          </button>
          <div className="flex items-center gap-3 mb-4">
            <img src={user.avatar} alt="User" className="w-10 h-10 rounded-full border-2 border-autoforce-blue" />
            {isSidebarOpen && (
              <div>
                <p className="text-sm font-bold text-white leading-none">{user.name}</p>
                <p className="text-xs text-autoforce-lightGrey mt-1">{user.role}</p>
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 text-sm font-semibold transition-colors py-2 border border-transparent hover:border-red-400/30 rounded"
          >
            <LogOut size={16} />
            {isSidebarOpen && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 bg-[#00020A] relative custom-scrollbar min-h-screen ml-0 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        <div className="h-screen overflow-y-auto">
        {/* Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-autoforce-blue/5 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Top Header */}
        <header className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex justify-between items-center sticky top-0 bg-[#00020A]/80 backdrop-blur-md z-40 border-b border-autoforce-grey/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden text-autoforce-lightGrey hover:text-white p-2 rounded-lg border border-autoforce-grey/20"
              aria-label="Abrir menu"
            >
              <PanelLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-display font-bold text-white">
                  {getPageTitle(location.pathname)}
              </h1>
              <p className="text-autoforce-lightGrey text-sm flex items-center gap-2">
                 {loadingData ? <RefreshCw className="animate-spin w-3 h-3"/> : <span className="w-2 h-2 rounded-full bg-green-500"></span>}
                 Sistema Atualizado
              </p>
            </div>
          </div>
          
          <div className="flex gap-4 items-center">
            {/* Date Filter (Show only on Dashboard) */}
            {(location.pathname === '/' || location.pathname === '/dashboard') && (
                 <div className="hidden md:flex items-center gap-2 bg-autoforce-darkest p-1.5 rounded-lg border border-autoforce-grey/30">
                    <Calendar size={14} className="text-autoforce-lightGrey ml-2"/>
                    <select className="bg-autoforce-black text-white text-xs font-bold outline-none cursor-pointer">
                        <option className="bg-autoforce-darkest text-white">Este Ano</option>
                        <option className="bg-autoforce-darkest text-white">Ãšltimos 6 meses</option>
                        <option className="bg-autoforce-darkest text-white">Este MÃªs</option>
                    </select>
                </div>
            )}

            <button className="bg-autoforce-darkest border border-autoforce-grey/30 hover:border-autoforce-blue text-white px-4 py-2 rounded flex items-center gap-2 transition-all text-sm">
               <Share2 size={16} />
               Exportar RelatÃ³rio
            </button>
            <div className="bg-autoforce-accent/10 border border-autoforce-accent/30 text-autoforce-accent px-4 py-2 rounded font-bold flex items-center gap-2 text-sm">
                <Target size={18} />
                Meta Global: 82%
            </div>
          </div>
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
                <Route path="/site" element={
                  <div className="p-4 sm:p-6 lg:p-8 space-y-4">
                    <h2 className="text-2xl font-bold text-white">Site AutoForce</h2>
                    <p className="text-autoforce-lightGrey text-sm">EspaÃ§o reservado para os indicadores do site.</p>
                  </div>
                } />
                <Route path="/blog" element={
                  <div className="p-4 sm:p-6 lg:p-8 space-y-4">
                    <h2 className="text-2xl font-bold text-white">Blog</h2>
                    <p className="text-autoforce-lightGrey text-sm">EspaÃ§o reservado para indicadores e conteÃºdo do blog.</p>
                  </div>
                } />
                <Route path="/campaigns" element={<CampaignsView />} />
                <Route path="/assets" element={<AssetsView />} />

                {/* Rota ConfiguraÃ§Ãµes */}
                <Route path="/settings" element={
                     <div className="p-4 sm:p-6 lg:p-8 space-y-6">
                      <div className="flex items-center gap-4 mb-8">
                           <div className="bg-autoforce-darkest p-4 rounded-full border border-autoforce-blue/20">
                              <Mail size={32} className="animate-pulse text-autoforce-blue" />
                          </div>
                          <div>
                              <h2 className="text-2xl font-bold text-white">Integracoes & Disparo de Emails</h2>
                              <p className="text-autoforce-lightGrey text-sm">Preparado para integrar com RD Station.</p>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="lg:col-span-2 bg-autoforce-darkest border border-autoforce-grey/20 p-6 rounded-xl">
                              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                  <Server className="text-autoforce-accent" />
                                  RD Station Email
                              </h3>
                              <p className="text-sm text-autoforce-lightGrey mb-6">
                                  Configure a integracao para visualizar envios, aberturas, cliques e conversoes por campanha.
                              </p>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Access Token</label>
                                      <input
                                          type="password"
                                          placeholder="Insira o token do RD Station"
                                          className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Workspace</label>
                                      <input
                                          type="text"
                                          placeholder="Ex: marketing-autoforce"
                                          className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
                                      />
                                  </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                                  {[
                                      { label: 'Envios', value: '--' },
                                      { label: 'Aberturas', value: '--' },
                                      { label: 'Cliques', value: '--' },
                                      { label: 'CTR', value: '--' },
                                      { label: 'Conversoes', value: '--' },
                                      { label: 'Bounce', value: '--' },
                                  ].map((metric) => (
                                      <div key={metric.label} className="bg-autoforce-black/40 border border-autoforce-grey/30 rounded-lg p-4">
                                          <p className="text-xs text-autoforce-lightGrey uppercase tracking-wider">{metric.label}</p>
                                          <p className="text-xl text-white font-bold mt-2">{metric.value}</p>
                                      </div>
                                  ))}
                              </div>

                              <div className="flex justify-end gap-3 mt-6">
                                  <button className="px-4 py-2 text-autoforce-lightGrey hover:text-white text-sm">Testar Conexao</button>
                                  <button className="bg-autoforce-blue hover:bg-autoforce-secondary text-white px-5 py-2 rounded text-sm font-bold">
                                      Salvar Integracao
                                  </button>
                              </div>
                          </div>

                          <div className="bg-autoforce-darkest border border-autoforce-grey/20 p-6 rounded-xl space-y-6">
                              <div>
                                  <h3 className="text-white font-bold mb-3">Checklist de Integracao</h3>
                                  <ul className="text-sm text-autoforce-lightGrey space-y-2">
                                      <li>1. Gerar token no RD Station</li>
                                      <li>2. Definir permissões de email marketing</li>
                                      <li>3. Validar webhooks de eventos</li>
                                      <li>4. Confirmar dominio de envio</li>
                                  </ul>
                              </div>
                              <div className="bg-autoforce-black/50 border border-autoforce-grey/20 rounded-lg p-4 text-xs text-autoforce-lightGrey">
                                  Os dados serão atualizados automaticamente apos conectar a integracao.
                              </div>
                          </div>
                      </div>
                  </div>
                } />
            </Routes>
        </div>
        </div>
      </main>
      {isSidebarOpen && (
        <button
          type="button"
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          aria-label="Fechar menu"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
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


