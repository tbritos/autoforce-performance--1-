import { Metric, ChartData, LandingPage, DailyLeadEntry, RevenueEntry, OKR, TeamMember, CampaignEvent, Campaign, AssetItem, EmailCampaign, MetaCampaign, AssetVersion, WorkflowEmailStat, SyncLog, LeadConversionSummary } from '../types';
import { apiClient } from './apiClient';

// ============================================================================
// FIX: Forçamos o uso da API se a URL estiver definida OU se estivermos em localhost
// ============================================================================
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const USE_API = true; // <--- VAMOS FORÇAR PARA TESTAR AGORA

const isApiAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    console.warn('⚠️ API Backend não detectada. Verifique se o servidor está rodando na porta 5000.');
    return false;
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ... (Mantenha a função safeParse e as constantes STORAGE_... iguais) ...
const safeParse = <T>(key: string, fallback: T): T => {
    try {
        const item = localStorage.getItem(key);
        if (!item) return fallback;
        const parsed = JSON.parse(item);
        if (!parsed) return fallback;
        return parsed;
    } catch (e) {
        console.error(`Database Error (LocalStorage) for key ${key}:`, e);
        return fallback;
    }
};

const STORAGE_LEADS_KEY = 'autoforce_lead_history';
const STORAGE_REVENUE_KEY = 'autoforce_revenue_history';
const STORAGE_OKRS_KEY = 'autoforce_okrs_history';
const STORAGE_CALENDAR_KEY = 'autoforce_calendar_events';
const STORAGE_CAMPAIGNS_KEY = 'autoforce_campaigns';
const STORAGE_ASSETS_KEY = 'autoforce_assets';
const STORAGE_EMAILS_KEY = 'autoforce_email_campaigns';
const STORAGE_LEAD_CONVERSIONS_KEY = 'autoforce_lead_conversions';


export const DataService = {
  
  // ... (Mantenha getDashboardMetrics, getPerformanceHistory, getLandingPagesGA, getTeamMembers iguais) ...
  // (Pode copiar do seu código anterior, eles estavam ok)
  
  getDashboardMetrics: async (): Promise<Metric[]> => {
    if (USE_API) {
      try {
        const metrics = await apiClient.get<Metric[]>('/dashboard/metrics');
        if (metrics && metrics.length > 0) return metrics;
      } catch (error) { console.error('Erro API Metrics:', error); }
    }
    return [
       { id: '1', label: 'Vendas Totais', value: 0, unit: 'R$ ', trend: 'neutral', change: 0, target: 0 },
       { id: '2', label: 'Leads Qualificados', value: 0, unit: '', trend: 'neutral', change: 0, target: 0 },
       { id: '3', label: 'Taxa de Conversão', value: 0, unit: '%', trend: 'neutral', change: 0, target: 0 },
       { id: '4', label: 'Ticket Médio', value: 0, unit: 'R$ ', trend: 'neutral', change: 0, target: 0 }
    ];
  },

  getPerformanceHistory: async (): Promise<ChartData[]> => {
    if (USE_API) {
      try { return await apiClient.get<ChartData[]>('/dashboard/history') || []; } 
      catch (error) { console.error(error); }
    }
    return [];
  },

  getLandingPagesGA: async (
    startDate?: string,
    endDate?: string,
    hostName?: string
  ): Promise<LandingPage[]> => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (hostName) params.set('hostName', hostName);
      const query = params.toString();
      const url = query ? `/analytics/landing-pages?${query}` : '/analytics/landing-pages';
      const rawData = await apiClient.get<any[]>(url);
      
      if (rawData && rawData.length > 0) {
        return rawData.map(item => ({
          id: item.id,
          name: item.name || item.path, 
          path: item.path,
          visitors: item.views || 0, 
          users: item.users || 0,
          leads: item.conversions || 0, 
          conversions: item.conversions || 0,
          conversionRate: item.conversionRate || 0,
          avgEngagementTime: item.avgEngagementTime || '-',
          bounceRate: item.bounceRate || 0,
          totalClicks: item.totalClicks || 0
        }));
      }
    } catch (error) { console.error(error); }
    return [];
  },

  getTeamMembers: async (): Promise<TeamMember[]> => {
    if (USE_API) {
      try { return await apiClient.get<TeamMember[]>('/team') || []; }
      catch (error) { console.error(error); }
    }
    return [];
  },

  // --- AQUI ESTAVA O PROBLEMA: Lead Tracker ---

  getDailyLeadsHistory: async (): Promise<DailyLeadEntry[]> => {
    if (USE_API) {
      try {
        console.log('📡 Buscando histórico do backend...');
        const data = await apiClient.get<DailyLeadEntry[]>('/leads/daily');
        return (data || []).map(entry => ({
          ...entry,
          leads: entry.leads ?? 0,
          mql: entry.mql ?? 0,
          sql: entry.sql ?? 0,
        }));
      } catch (error) {
        console.error('❌ Erro ao buscar leads do Backend:', error);
        // Não vamos fazer fallback silencioso agora, queremos ver o erro!
        throw error; 
      }
    }
    // Fallback antigo removido para teste
    return [];
  },

  getLeadConversions: async (): Promise<LeadConversionSummary[]> => {
    if (USE_API) {
      try {
        const data = await apiClient.get<LeadConversionSummary[]>('/leads/conversions');
        return (data || []).map(item => ({
          id: item.id,
          name: item.name,
          identifier: item.identifier || item.name,
          source: item.source || 'rdstation',
          leads: item.leads ?? 0,
          mql: item.mql ?? 0,
          sql: item.sql ?? 0,
          conversionRate: item.conversionRate ?? 0,
          lastSeen: item.lastSeen || new Date().toISOString().split('T')[0],
        }));
      } catch (error) {
        console.error('Erro ao buscar conversoes de leads:', error);
      }
    }

    return safeParse<LeadConversionSummary[]>(STORAGE_LEAD_CONVERSIONS_KEY, []);
  },

  saveDailyLeadEntry: async (entry: Omit<DailyLeadEntry, 'id'>): Promise<DailyLeadEntry> => {
    if (USE_API) {
      try {
        console.log('📤 Enviando Lead para API:', entry);
        const result = await apiClient.post<DailyLeadEntry>('/leads/daily', entry);
        console.log('✅ Lead salvo com sucesso:', result);
        return result;
      } catch (error) {
        console.error('❌ FALHA AO SALVAR NO BACKEND:', error);
        throw error; // Lança o erro para aparecer no console do navegador
      }
    }
    
    // Código morto do LocalStorage (ignorando para forçar o backend)
    throw new Error("API Desligada");
  },

  updateDailyLeadEntry: async (
    id: string,
    entry: Omit<DailyLeadEntry, 'id'>
  ): Promise<DailyLeadEntry> => {
    if (USE_API) {
      try {
        const result = await apiClient.put<DailyLeadEntry>(`/leads/daily/${id}`, entry);
        return result;
      } catch (error) {
        console.error('❌ FALHA AO ATUALIZAR LEAD NO BACKEND:', error);
        throw error;
      }
    }

    throw new Error("API Desligada");
  },

  deleteDailyLeadEntry: async (id: string): Promise<void> => {
    if (USE_API) {
      try {
        await apiClient.delete(`/leads/daily/${id}`);
        return;
      } catch (error) {
        console.error('❌ FALHA AO REMOVER LEAD NO BACKEND:', error);
        throw error;
      }
    }

    throw new Error("API Desligada");
  },

  // ... (Mantenha o resto das funções Revenue e OKR, mas lembre-se que elas também precisam usar a API) ...
  // Se quiser, pode aplicar a mesma lógica de remover o try/catch silencioso nelas.
  getRevenueHistory: async (
    filters?: { origin?: string; products?: string[] }
  ): Promise<RevenueEntry[]> => {
    if (USE_API) {
      try {
        console.log('📡 Buscando ganhos do backend...');
        const params = new URLSearchParams();
        if (filters?.origin) params.set('origin', filters.origin);
        if (filters?.products && filters.products.length > 0) {
          params.set('product', filters.products.join(','));
        }
        const query = params.toString();
        const data = await apiClient.get<RevenueEntry[]>(
          query ? `/revenue/transactions?${query}` : '/revenue/transactions'
        );
        return (data || []).map(entry => ({
          ...entry,
          product: Array.isArray(entry.product) ? entry.product : [entry.product],
        }));
      } catch (error) {
        console.error('❌ Erro ao buscar ganhos do Backend:', error);
        throw error;
      }
    }

    return safeParse<RevenueEntry[]>(STORAGE_REVENUE_KEY, []).map(entry => ({
      ...entry,
      product: Array.isArray(entry.product) ? entry.product : [entry.product],
    }));
  },

  saveRevenueEntry: async (
    entry: Omit<RevenueEntry, 'id'>
  ): Promise<RevenueEntry> => {
    const normalizedProducts = Array.from(
      new Set(
        (Array.isArray(entry.product) ? entry.product : [entry.product])
          .map(item => item.trim())
          .filter(Boolean)
      )
    );
    const payload = {
      ...entry,
      product: normalizedProducts,
    };
    if (USE_API) {
      try {
        console.log('📤 Enviando ganho para API:', payload);
        const result = await apiClient.post<RevenueEntry>('/revenue/transactions', payload);
        console.log('✅ Ganho salvo com sucesso:', result);
        return result;
      } catch (error) {
        console.error('❌ FALHA AO SALVAR GANHO NO BACKEND:', error);
        throw error;
      }
    }

    const history = safeParse<RevenueEntry[]>(STORAGE_REVENUE_KEY, []);
    const created: RevenueEntry = {
      id: `${Date.now()}`,
      date: entry.date || new Date().toISOString().split('T')[0],
      ...payload,
    };
    const updated = [created, ...history];
    localStorage.setItem(STORAGE_REVENUE_KEY, JSON.stringify(updated));
    return created;
  },

  updateRevenueEntry: async (
    id: string,
    entry: Omit<RevenueEntry, 'id'>
  ): Promise<RevenueEntry> => {
    const normalizedProducts = Array.from(
      new Set(
        (Array.isArray(entry.product) ? entry.product : [entry.product])
          .map(item => item.trim())
          .filter(Boolean)
      )
    );
    const payload = {
      ...entry,
      product: normalizedProducts,
    };
    if (USE_API) {
      try {
        return await apiClient.put<RevenueEntry>(`/revenue/transactions/${id}`, payload);
      } catch (error) {
        console.error('❌ FALHA AO ATUALIZAR GANHO NO BACKEND:', error);
        throw error;
      }
    }

    throw new Error("API Desligada");
  },

  deleteRevenueEntry: async (id: string): Promise<void> => {
    if (USE_API) {
      try {
        await apiClient.delete(`/revenue/transactions/${id}`);
        return;
      } catch (error) {
        console.error('❌ FALHA AO REMOVER GANHO NO BACKEND:', error);
        throw error;
      }
    }

    throw new Error("API Desligada");
  },
  getOKRs: async (): Promise<OKR[]> => {
    if (USE_API) {
      try {
        console.log('📡 Buscando OKRs do backend...');
        return await apiClient.get<OKR[]>('/okrs');
      } catch (error) {
        console.error('❌ Erro ao buscar OKRs do Backend:', error);
        throw error;
      }
    }

    return safeParse<OKR[]>(STORAGE_OKRS_KEY, []);
  },

  saveOKR: async (okr: OKR): Promise<OKR> => {
    if (USE_API) {
      try {
        console.log('📤 Enviando OKR para API:', okr);
        const result = await apiClient.post<OKR>('/okrs', okr);
        console.log('✅ OKR salvo com sucesso:', result);
        return result;
      } catch (error) {
        console.error('❌ FALHA AO SALVAR OKR NO BACKEND:', error);
        throw error;
      }
    }

    const history = safeParse<OKR[]>(STORAGE_OKRS_KEY, []);
    const updated = [okr, ...history.filter(item => item.id !== okr.id)];
    localStorage.setItem(STORAGE_OKRS_KEY, JSON.stringify(updated));
    return okr;
  },

  updateOKR: async (id: string, okr: OKR): Promise<OKR> => {
    if (USE_API) {
      try {
        return await apiClient.put<OKR>(`/okrs/${id}`, okr);
      } catch (error) {
        console.error('❌ FALHA AO ATUALIZAR OKR NO BACKEND:', error);
        throw error;
      }
    }

    throw new Error('API Desligada');
  },

  deleteOKR: async (id: string): Promise<void> => {
    if (USE_API) {
      try {
        await apiClient.delete(`/okrs/${id}`);
        return;
      } catch (error) {
        console.error('❌ FALHA AO REMOVER OKR NO BACKEND:', error);
        throw error;
      }
    }

    throw new Error('API Desligada');
  },

  getCampaignEvents: async (): Promise<CampaignEvent[]> => {
    if (USE_API) {
      try {
        return await apiClient.get<CampaignEvent[]>('/calendar/events');
      } catch (error) {
        console.error('❌ Erro ao buscar eventos do Backend:', error);
        throw error;
      }
    }

    return safeParse<CampaignEvent[]>(STORAGE_CALENDAR_KEY, []);
  },

  createCampaignEvent: async (
    event: Omit<CampaignEvent, 'id'>
  ): Promise<CampaignEvent> => {
    if (USE_API) {
      try {
        return await apiClient.post<CampaignEvent>('/calendar/events', event);
      } catch (error) {
        console.error('❌ Erro ao criar evento no Backend:', error);
        throw error;
      }
    }

    const history = safeParse<CampaignEvent[]>(STORAGE_CALENDAR_KEY, []);
    const created: CampaignEvent = {
      id: `${Date.now()}`,
      ...event,
    };
    const updated = [...history, created];
    localStorage.setItem(STORAGE_CALENDAR_KEY, JSON.stringify(updated));
    return created;
  },

  updateCampaignEvent: async (
    id: string,
    event: Omit<CampaignEvent, 'id'>
  ): Promise<CampaignEvent> => {
    if (USE_API) {
      try {
        return await apiClient.put<CampaignEvent>(`/calendar/events/${id}`, event);
      } catch (error) {
        console.error('❌ Erro ao atualizar evento no Backend:', error);
        throw error;
      }
    }

    const history = safeParse<CampaignEvent[]>(STORAGE_CALENDAR_KEY, []);
    const updated = history.map(item => (item.id === id ? { id, ...event } : item));
    localStorage.setItem(STORAGE_CALENDAR_KEY, JSON.stringify(updated));
    return { id, ...event };
  },

  deleteCampaignEvent: async (id: string): Promise<void> => {
    if (USE_API) {
      try {
        await apiClient.delete(`/calendar/events/${id}`);
        return;
      } catch (error) {
        console.error('❌ Erro ao remover evento no Backend:', error);
        throw error;
      }
    }

    const history = safeParse<CampaignEvent[]>(STORAGE_CALENDAR_KEY, []);
    const updated = history.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_CALENDAR_KEY, JSON.stringify(updated));
  },

  getCampaigns: async (): Promise<Campaign[]> => {
    if (USE_API) {
      try {
        return await apiClient.get<Campaign[]>('/campaigns');
      } catch (error) {
        console.error('❌ Erro ao buscar campanhas do Backend:', error);
        throw error;
      }
    }

    return safeParse<Campaign[]>(STORAGE_CAMPAIGNS_KEY, []);
  },

  getMetaCampaigns: async (startDate?: string, endDate?: string): Promise<MetaCampaign[]> => {
    if (USE_API) {
      try {
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        const query = params.toString();
        return await apiClient.get<MetaCampaign[]>(
          query ? `/campaigns/meta?${query}` : '/campaigns/meta'
        );
      } catch (error) {
        console.error('Erro ao buscar campanhas da Meta:', error);
        throw error;
      }
    }

    return [];
  },

  createCampaign: async (campaign: Omit<Campaign, 'id'>): Promise<Campaign> => {
    if (USE_API) {
      try {
        return await apiClient.post<Campaign>('/campaigns', campaign);
      } catch (error) {
        console.error('❌ Erro ao criar campanha no Backend:', error);
        throw error;
      }
    }

    const history = safeParse<Campaign[]>(STORAGE_CAMPAIGNS_KEY, []);
    const created: Campaign = { id: `${Date.now()}`, ...campaign };
    const updated = [created, ...history];
    localStorage.setItem(STORAGE_CAMPAIGNS_KEY, JSON.stringify(updated));
    return created;
  },

  updateCampaign: async (id: string, campaign: Omit<Campaign, 'id'>): Promise<Campaign> => {
    if (USE_API) {
      try {
        return await apiClient.put<Campaign>(`/campaigns/${id}`, campaign);
      } catch (error) {
        console.error('❌ Erro ao atualizar campanha no Backend:', error);
        throw error;
      }
    }

    const history = safeParse<Campaign[]>(STORAGE_CAMPAIGNS_KEY, []);
    const updated = history.map(item => (item.id === id ? { id, ...campaign } : item));
    localStorage.setItem(STORAGE_CAMPAIGNS_KEY, JSON.stringify(updated));
    return { id, ...campaign };
  },

  deleteCampaign: async (id: string): Promise<void> => {
    if (USE_API) {
      try {
        await apiClient.delete(`/campaigns/${id}`);
        return;
      } catch (error) {
        console.error('❌ Erro ao remover campanha no Backend:', error);
        throw error;
      }
    }

    const history = safeParse<Campaign[]>(STORAGE_CAMPAIGNS_KEY, []);
    const updated = history.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_CAMPAIGNS_KEY, JSON.stringify(updated));
  },

  getAssets: async (): Promise<AssetItem[]> => {
    if (USE_API) {
      try {
        const data = await apiClient.get<AssetItem[]>('/assets');
        return (data || []).map(item => ({
          ...item,
          tags: Array.isArray(item.tags) ? item.tags : [],
          versions: Array.isArray(item.versions) ? item.versions : [],
        }));
      } catch (error) {
        console.error('❌ Erro ao buscar ativos do Backend:', error);
        throw error;
      }
    }

    return safeParse<AssetItem[]>(STORAGE_ASSETS_KEY, []).map(item => ({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags : [],
      versions: Array.isArray(item.versions) ? item.versions : [],
    }));
  },

  createAsset: async (asset: Omit<AssetItem, 'id'>): Promise<AssetItem> => {
    if (USE_API) {
      try {
        return await apiClient.post<AssetItem>('/assets', asset);
      } catch (error) {
        console.error('❌ Erro ao criar ativo no Backend:', error);
        throw error;
      }
    }

    const history = safeParse<AssetItem[]>(STORAGE_ASSETS_KEY, []);
    const created: AssetItem = { id: `${Date.now()}`, ...asset };
    const updated = [created, ...history];
    localStorage.setItem(STORAGE_ASSETS_KEY, JSON.stringify(updated));
    return created;
  },

  addAssetVersion: async (
    id: string,
    version: { label: string; link: string }
  ): Promise<AssetVersion> => {
    if (USE_API) {
      try {
        return await apiClient.post<AssetVersion>(`/assets/${id}/versions`, version);
      } catch (error) {
        console.error('❌ Erro ao adicionar versao no Backend:', error);
        throw error;
      }
    }

    throw new Error('API Desligada');
  },

  updateAssetVersion: async (
    assetId: string,
    versionId: string,
    version: { label: string; link: string }
  ): Promise<AssetVersion> => {
    if (USE_API) {
      try {
        return await apiClient.put<AssetVersion>(`/assets/${assetId}/versions/${versionId}`, version);
      } catch (error) {
        console.error('❌ Erro ao atualizar versao no Backend:', error);
        throw error;
      }
    }

    throw new Error('API Desligada');
  },

  deleteAssetVersion: async (assetId: string, versionId: string): Promise<void> => {
    if (USE_API) {
      try {
        await apiClient.delete(`/assets/${assetId}/versions/${versionId}`);
        return;
      } catch (error) {
        console.error('❌ Erro ao remover versao no Backend:', error);
        throw error;
      }
    }

    throw new Error('API Desligada');
  },

  updateAsset: async (id: string, asset: Omit<AssetItem, 'id'>): Promise<AssetItem> => {
    if (USE_API) {
      try {
        return await apiClient.put<AssetItem>(`/assets/${id}`, asset);
      } catch (error) {
        console.error('❌ Erro ao atualizar ativo no Backend:', error);
        throw error;
      }
    }

    const history = safeParse<AssetItem[]>(STORAGE_ASSETS_KEY, []);
    const updated = history.map(item => (item.id === id ? { id, ...asset } : item));
    localStorage.setItem(STORAGE_ASSETS_KEY, JSON.stringify(updated));
    return { id, ...asset };
  },

  deleteAsset: async (id: string): Promise<void> => {
    if (USE_API) {
      try {
        await apiClient.delete(`/assets/${id}`);
        return;
      } catch (error) {
        console.error('❌ Erro ao remover ativo no Backend:', error);
        throw error;
      }
    }

    const history = safeParse<AssetItem[]>(STORAGE_ASSETS_KEY, []);
    const updated = history.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_ASSETS_KEY, JSON.stringify(updated));
  },

  getEmailCampaigns: async (): Promise<EmailCampaign[]> => {
    if (USE_API) {
      try {
        return await apiClient.get<EmailCampaign[]>('/emails/campaigns?source=manual');
      } catch (error) {
        console.error('❌ Erro ao buscar campanhas de email do Backend:', error);
        throw error;
      }
    }

    return safeParse<EmailCampaign[]>(STORAGE_EMAILS_KEY, []);
  },

  getRdEmailCampaigns: async (): Promise<EmailCampaign[]> => {
    if (USE_API) {
      try {
        return await apiClient.get<EmailCampaign[]>('/emails/campaigns/rdstation');
      } catch (error) {
        console.error('? Erro ao buscar emails do RD Station:', error);
        throw error;
      }
    }

    return [];
  },

  syncRdEmailCampaigns: async (
    startDate?: string,
    endDate?: string
  ): Promise<EmailCampaign[]> => {
    if (USE_API) {
      try {
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        const query = params.toString();
        return await apiClient.get<EmailCampaign[]>(
          query ? `/emails/campaigns/rdstation/sync?${query}` : '/emails/campaigns/rdstation/sync'
        );
      } catch (error) {
        console.error('Erro ao sincronizar emails do RD Station:', error);
        throw error;
      }
    }

    return [];
  },

  getRdWorkflowEmailStats: async (): Promise<WorkflowEmailStat[]> => {
    if (USE_API) {
      try {
        return await apiClient.get<WorkflowEmailStat[]>('/emails/automation/rdstation');
      } catch (error) {
        console.error('Erro ao buscar automacoes do RD Station:', error);
        throw error;
      }
    }

    return [];
  },

  syncRdWorkflowEmailStats: async (
    startDate?: string,
    endDate?: string
  ): Promise<WorkflowEmailStat[]> => {
    if (USE_API) {
      try {
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        const query = params.toString();
        return await apiClient.get<WorkflowEmailStat[]>(
          query ? `/emails/automation/rdstation/sync?${query}` : '/emails/automation/rdstation/sync'
        );
      } catch (error) {
        console.error('? Erro ao sincronizar automacoes do RD Station:', error);
        throw error;
      }
    }

    return [];
  },

  getSyncLogs: async (limit = 50): Promise<SyncLog[]> => {
    if (USE_API) {
      try {
        const params = new URLSearchParams();
        params.set('limit', String(limit));
        return await apiClient.get<SyncLog[]>(`/emails/sync/logs?${params.toString()}`);
      } catch (error) {
        console.error('Erro ao buscar logs de sincronizacao:', error);
        throw error;
      }
    }

    return [];
  },

  createEmailCampaign: async (campaign: Omit<EmailCampaign, 'id'>): Promise<EmailCampaign> => {
    if (USE_API) {
      try {
        return await apiClient.post<EmailCampaign>('/emails/campaigns', campaign);
      } catch (error) {
        console.error('❌ Erro ao criar campanha de email no Backend:', error);
        throw error;
      }
    }

    const history = safeParse<EmailCampaign[]>(STORAGE_EMAILS_KEY, []);
    const created: EmailCampaign = { id: `${Date.now()}`, ...campaign };
    const updated = [created, ...history];
    localStorage.setItem(STORAGE_EMAILS_KEY, JSON.stringify(updated));
    return created;
  },

  updateEmailCampaign: async (id: string, campaign: Omit<EmailCampaign, 'id'>): Promise<EmailCampaign> => {
    if (USE_API) {
      try {
        return await apiClient.put<EmailCampaign>(`/emails/campaigns/${id}`, campaign);
      } catch (error) {
        console.error('❌ Erro ao atualizar campanha de email no Backend:', error);
        throw error;
      }
    }

    const history = safeParse<EmailCampaign[]>(STORAGE_EMAILS_KEY, []);
    const updated = history.map(item => (item.id === id ? { id, ...campaign } : item));
    localStorage.setItem(STORAGE_EMAILS_KEY, JSON.stringify(updated));
    return { id, ...campaign };
  },

  deleteEmailCampaign: async (id: string): Promise<void> => {
    if (USE_API) {
      try {
        await apiClient.delete(`/emails/campaigns/${id}`);
        return;
      } catch (error) {
        console.error('❌ Erro ao remover campanha de email no Backend:', error);
        throw error;
      }
    }

    const history = safeParse<EmailCampaign[]>(STORAGE_EMAILS_KEY, []);
    const updated = history.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_EMAILS_KEY, JSON.stringify(updated));
  },
};


