import { Metric, ChartData, LandingPage, DailyLeadEntry, RevenueEntry, OKR, TeamMember, CampaignEvent, Campaign, AssetItem, EmailCampaign, MetaCampaign, GoogleAdsCampaign, AssetVersion, WorkflowEmailStat, SyncLog, LeadConversionSummary, LeadConversion, WebhookLead, PlatformConnection, ConnectionRequirement, Lead, LeadListResult, LeadProfile, LeadCustomFieldDef, FunnelCounts, LeadStatus, LeadWebhookSource, LeadWebhookLog, LeadWebhookInspection, LeadClassificationRule, LeadRuleCondition, LeadRuleAction, AutomationJourney, AutomationJourneyNode, AutomationJourneyEdge, AutomationJourneyStatus, UTMLink, UTMLinkListResult, UTMTemplate, UTMCampaignPicker, UTMDestination, FunnelDef, FunnelStats, WhatsAppTemplate, PipedriveStage } from '../types';
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
    hostName?: string,
    source?: 'all' | 'lp' | 'site' | 'blog',
    options?: { throwOnError?: boolean }
  ): Promise<LandingPage[]> => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (hostName) params.set('hostName', hostName);
      if (source && source !== 'all') params.set('source', source);
      const query = params.toString();
      const url = query ? `/analytics/landing-pages?${query}` : '/analytics/landing-pages';
      const rawData = await apiClient.get<any[]>(url);
      
      if (rawData && rawData.length > 0) {
        return rawData.map(item => ({
          id: item.id,
          name: item.name || item.path,
          path: item.path,
          views: item.views || 0,
          users: item.users || 0,
          conversions: item.conversions || 0,
          conversionRate: item.conversionRate || 0,
          avgEngagementTime: item.avgEngagementTime || '-',
          bounceRate: item.bounceRate || 0,
          totalClicks: item.totalClicks || 0,
          source: item.source,
          dataOrigin: item.dataOrigin,
          lastSyncAt: item.lastSyncAt,
        }));
      }
    } catch (error) {
      console.error(error);
      if (options?.throwOnError) throw error;
    }
    return [];
  },

  getClarityMetrics: async (startDate?: string, endDate?: string): Promise<{
    totalSessions: number; totalSessionTime: number; pagesPerSession: number;
    rageClicks: number; deadClicks: number; errorClicks: number;
    quickBackClicks: number; javaScriptErrors: number; scrolledPercentage: number;
  } | null> => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate)   params.set('endDate',   endDate);
      const qs = params.toString() ? `?${params.toString()}` : '';
      return await apiClient.get(`/analytics/clarity/metrics${qs}`);
    } catch { return null; }
  },

  getGA4Totals: async (
    startDate?: string,
    endDate?: string,
    source?: 'all' | 'lp' | 'site' | 'blog'
  ): Promise<{ views: number; users: number; pages: number; errors: string[] }> => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (source && source !== 'all') params.set('source', source);
    const query = params.toString();
    return apiClient.get(`/analytics/ga4/totals${query ? `?${query}` : ''}`);
  },

  saveClarityConfig: async (projectId: string, apiKey: string): Promise<void> => {
    await apiClient.put('/connections/CLARITY/config', {
      accessToken: apiKey || undefined,
      metadata: { projectId },
    });
  },

  testClarityConnection: async (): Promise<boolean> => {
    try {
      const res = await apiClient.get<{ connected: boolean }>('/analytics/clarity/test');
      return res?.connected ?? false;
    } catch { return false; }
  },

  getTeamMembers: async (): Promise<TeamMember[]> => {
    if (USE_API) {
      try { return await apiClient.get<TeamMember[]>('/team') || []; }
      catch (error) { console.error(error); }
    }
    return [];
  },

  // --- AQUI ESTAVA O PROBLEMA: Lead Tracker ---

  getLeadStats: async (start: string, end: string): Promise<{ leads: number; mqls: number; sqls: number }> => {
    if (USE_API) {
      const data = await apiClient.get<{ leads: number; mqls: number; sqls: number }>(
        `/lead-hub/stats?start=${start}&end=${end}`
      );
      return data ?? { leads: 0, mqls: 0, sqls: 0 };
    }
    return { leads: 0, mqls: 0, sqls: 0 };
  },

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

  getLeadConversions: async (
    filters?: { startDate?: string; endDate?: string; assetTypes?: string[] }
  ): Promise<LeadConversionSummary[]> => {
    if (USE_API) {
      try {
        const params = new URLSearchParams();
        if (filters?.startDate) params.set('startDate', filters.startDate);
        if (filters?.endDate) params.set('endDate', filters.endDate);
        if (filters?.assetTypes && filters.assetTypes.length > 0) {
          params.set('assetTypes', filters.assetTypes.join(','));
        }
        const query = params.toString();
        const url = query ? `/leads/conversions?${query}` : '/leads/conversions';
        const data = await apiClient.get<LeadConversionSummary[]>(url);
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

  getWebhookLeads: async (
    filters?: { startDate?: string; endDate?: string }
  ): Promise<WebhookLead[]> => {
    if (USE_API) {
      try {
        const params = new URLSearchParams();
        if (filters?.startDate) params.set('startDate', filters.startDate);
        if (filters?.endDate) params.set('endDate', filters.endDate);
        const query = params.toString();
        const basePath = '/webhooks/leads';
        const url = query ? `${basePath}?${query}` : basePath;
        return await apiClient.get<WebhookLead[]>(url);
      } catch (error) {
        console.error('Erro ao buscar leads via webhook:', error);
        throw error;
      }
    }
    return [];
  },

  getRdLeads: async (
    segmentationId?: string,
    filters?: { startDate?: string; endDate?: string }
  ): Promise<WebhookLead[]> => {
    if (segmentationId) {
      try {
        const params = new URLSearchParams();
        if (filters?.startDate) params.set('startDate', filters.startDate);
        if (filters?.endDate) params.set('endDate', filters.endDate);
        const query = params.toString();
        const url = query
          ? `/rdstation/segmentations/${segmentationId}/contacts?${query}`
          : `/rdstation/segmentations/${segmentationId}/contacts`;
        return await apiClient.get<WebhookLead[]>(url);
      } catch (error) {
        console.error('Erro ao buscar leads por segmentacao:', error);
        throw error;
      }
    }
    return DataService.getWebhookLeads(filters);
  },

  syncRdLeads: async (
    segmentationId: string,
    options?: { includeConversion?: boolean; maxPages?: number; pageSize?: number }
  ): Promise<{ totalProcessed: number }> => {
    if (USE_API) {
      try {
        const params = new URLSearchParams();
        if (options?.includeConversion) params.set('includeConversion', 'true');
        if (options?.maxPages) params.set('maxPages', String(options.maxPages));
        if (options?.pageSize) params.set('pageSize', String(options.pageSize));
        const query = params.toString();
        const url = query
          ? `/rdstation/segmentations/${segmentationId}/contacts/sync?${query}`
          : `/rdstation/segmentations/${segmentationId}/contacts/sync`;
        return await apiClient.get<{ totalProcessed: number }>(url);
      } catch (error) {
        console.error('Erro ao sincronizar leads do RD Station:', error);
        throw error;
      }
    }
    return { totalProcessed: 0 };
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
      ...payload,
      id: `${Date.now()}`,
      date: entry.date || new Date().toISOString().split('T')[0],
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

  getGoogleAdsCampaigns: async (startDate?: string, endDate?: string): Promise<GoogleAdsCampaign[]> => {
    if (USE_API) {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const query = params.toString();
      return await apiClient.get<GoogleAdsCampaign[]>(
        query ? `/campaigns/google?${query}` : '/campaigns/google'
      );
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

  getRdStationFields: async (): Promise<Array<{ uuid: string; api_identifier: string; label: string; data_type: string }>> => {
    return apiClient.get('/emails/rdstation/fields');
  },

  getWhatsAppPhoneNumbers: async (): Promise<import('../types').WhatsAppPhoneNumber[]> => {
    return apiClient.get('/whatsapp/phone-numbers');
  },

  getWhatsAppTemplates: async (phoneNumberId?: string): Promise<WhatsAppTemplate[]> => {
    const qs = phoneNumberId ? `?phoneNumberId=${encodeURIComponent(phoneNumberId)}` : '';
    return apiClient.get(`/whatsapp/templates${qs}`);
  },

  getWhatsAppConversation: async (leadId: string): Promise<import('../types').WhatsAppConversationMessage[]> => {
    return apiClient.get(`/whatsapp/leads/${encodeURIComponent(leadId)}/conversation`);
  },

  getPipedriveStages: async (): Promise<PipedriveStage[]> => {
    return apiClient.get('/pipedrive/stages');
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

  // --- Platform Connections ---

  listConnections: async (): Promise<PlatformConnection[]> => {
    return apiClient.get<PlatformConnection[]>('/connections');
  },

  listConnectionRequirements: async (): Promise<ConnectionRequirement[]> => {
    return apiClient.get<ConnectionRequirement[]>('/connections/requirements');
  },

  getConnectionAuthUrl: async (platform: string): Promise<{ url: string }> => {
    return apiClient.get<{ url: string }>(`/connections/${platform}/auth-url`);
  },

  disconnectPlatform: async (platform: string): Promise<void> => {
    await apiClient.post(`/connections/${platform}/disconnect`, {});
  },

  triggerPlatformSync: async (platform: string): Promise<{ synced: number; errors: number }> => {
    return apiClient.post<{ synced: number; errors: number }>(`/connections/${platform}/sync`, {});
  },

  testPlatformConnection: async (platform: string): Promise<{ ok: boolean; message: string }> => {
    return apiClient.post<{ ok: boolean; message: string }>(`/connections/${platform}/test`, {});
  },

  getPipedriveEvents: async (leadId: string): Promise<{ events: import('../types').PipedriveDealEvent[]; dealUrl: string | null }> => {
    return apiClient.get(`/lead-hub/id/${leadId}/pipedrive-events`);
  },

  updateConnectionConfig: async (platform: string, payload: {
    accountId?: string;
    accountName?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PlatformConnection> => {
    return apiClient.put<PlatformConnection>(`/connections/${platform}/config`, payload);
  },

  migrateEnvConnections: async (): Promise<{ message: string; results: Record<string, string> }> => {
    return apiClient.post<{ message: string; results: Record<string, string> }>('/connections/migrate-env', {});
  },

  // --- Lead Hub ---

  listLeads: async (filters: {
    status?: LeadStatus;
    search?: string;
    isHot?: boolean;
    tag?: string;
    startDate?: string;
    endDate?: string;
    customField?: string;
    customValue?: string;
    conversionSource?: string;
    orderBy?: 'lastSeenAt' | 'firstSeenAt' | 'conversionsCount' | 'name';
    orderDir?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
  } = {}): Promise<LeadListResult> => {
    const params = new URLSearchParams();
    if (filters.status)    params.set('status', filters.status);
    if (filters.search)    params.set('search', filters.search);
    if (filters.isHot !== undefined) params.set('isHot', String(filters.isHot));
    if (filters.tag)       params.set('tag', filters.tag);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate)   params.set('endDate', filters.endDate);
    if (filters.customField) params.set('customField', filters.customField);
    if (filters.customValue) params.set('customValue', filters.customValue);
    if (filters.conversionSource) params.set('conversionSource', filters.conversionSource);
    if (filters.orderBy)   params.set('orderBy', filters.orderBy);
    if (filters.orderDir)  params.set('orderDir', filters.orderDir);
    if (filters.page)      params.set('page', String(filters.page));
    if (filters.pageSize)  params.set('pageSize', String(filters.pageSize));
    const qs = params.toString();
    return apiClient.get<LeadListResult>(`/lead-hub${qs ? `?${qs}` : ''}`);
  },

  getLeadProfile: async (email: string): Promise<LeadProfile> => {
    return apiClient.get<LeadProfile>(`/lead-hub/${encodeURIComponent(email)}`);
  },

  getLeadProfileById: async (id: string): Promise<LeadProfile> => {
    return apiClient.get<LeadProfile>(`/lead-hub/id/${encodeURIComponent(id)}`);
  },

  getLeadAllConversions: async (id: string): Promise<LeadConversion[]> => {
    return apiClient.get<LeadConversion[]>(`/lead-hub/id/${encodeURIComponent(id)}/conversions`);
  },

  updateLeadProfileById: async (id: string, profile: {
    name?: string | null;
    phone?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    city?: string | null;
    state?: string | null;
    assignedTo?: string | null;
    isHot?: boolean;
    score?: number | null;
  }): Promise<Partial<LeadProfile>> => {
    return apiClient.patch<Partial<LeadProfile>>(`/lead-hub/id/${encodeURIComponent(id)}`, profile);
  },

  updateLeadStatus: async (email: string, status: LeadStatus, reason?: string): Promise<Lead> => {
    return apiClient.patch<Lead>(`/lead-hub/${encodeURIComponent(email)}/status`, { status, reason });
  },

  updateLeadStatusById: async (id: string, status: LeadStatus, reason?: string): Promise<Lead> => {
    return apiClient.patch<Lead>(`/lead-hub/id/${encodeURIComponent(id)}/status`, { status, reason });
  },

  getFunnelCounts: async (): Promise<FunnelCounts> => {
    return apiClient.get<FunnelCounts>('/lead-hub/funnel');
  },

  getAllLeadTags: async (): Promise<string[]> => {
    return apiClient.get<string[]>('/lead-hub/tags');
  },

  getConversionSources: async (): Promise<string[]> => {
    return apiClient.get<string[]>('/lead-hub/conversion-sources');
  },

  getLeadsBySource: async (): Promise<{ source: string; count: number }[]> => {
    return apiClient.get<{ source: string; count: number }[]>('/lead-hub/by-source');
  },

  listCustomFieldDefs: async (): Promise<LeadCustomFieldDef[]> => {
    return apiClient.get<LeadCustomFieldDef[]>('/lead-hub/custom-fields');
  },

  createCustomFieldDef: async (field: {
    name: string;
    label: string;
    fieldType: LeadCustomFieldDef['fieldType'];
    options?: string[];
    placeholder?: string;
    required?: boolean;
    visible?: boolean;
    sortOrder?: number;
    sourceHint?: string;
  }): Promise<LeadCustomFieldDef> => {
    return apiClient.post<LeadCustomFieldDef>('/lead-hub/custom-fields', field);
  },

  updateCustomFieldDef: async (id: string, field: {
    label?: string;
    fieldType?: LeadCustomFieldDef['fieldType'];
    options?: string[];
    placeholder?: string;
    required?: boolean;
    visible?: boolean;
    sortOrder?: number;
    sourceHint?: string;
  }): Promise<LeadCustomFieldDef> => {
    return apiClient.patch<LeadCustomFieldDef>(`/lead-hub/custom-fields/${encodeURIComponent(id)}`, field);
  },

  deleteCustomFieldDef: async (id: string): Promise<void> => {
    await apiClient.delete(`/lead-hub/custom-fields/${encodeURIComponent(id)}`);
  },

  updateLeadCustomField: async (email: string, field: string, value: unknown): Promise<void> => {
    await apiClient.patch(`/lead-hub/${encodeURIComponent(email)}/custom-fields/${encodeURIComponent(field)}`, { value });
  },

  updateLeadCustomFieldById: async (id: string, field: string, value: unknown): Promise<void> => {
    await apiClient.patch(`/lead-hub/id/${encodeURIComponent(id)}/custom-fields/${encodeURIComponent(field)}`, { value });
  },

  updateLeadCustomFieldsById: async (id: string, fields: Record<string, unknown>): Promise<void> => {
    await apiClient.patch(`/lead-hub/id/${encodeURIComponent(id)}/custom-fields`, { fields });
  },

  addLeadTag: async (email: string, tag: string): Promise<{ tags: string[] }> => {
    return apiClient.post<{ tags: string[] }>(`/lead-hub/${encodeURIComponent(email)}/tags`, { tag });
  },

  addLeadTagById: async (id: string, tag: string): Promise<{ tags: string[] }> => {
    return apiClient.post<{ tags: string[] }>(`/lead-hub/id/${encodeURIComponent(id)}/tags`, { tag });
  },

  removeLeadTag: async (email: string, tag: string): Promise<{ tags: string[] }> => {
    return apiClient.delete<{ tags: string[] }>(`/lead-hub/${encodeURIComponent(email)}/tags/${encodeURIComponent(tag)}`);
  },

  removeLeadTagById: async (id: string, tag: string): Promise<{ tags: string[] }> => {
    return apiClient.delete<{ tags: string[] }>(`/lead-hub/id/${encodeURIComponent(id)}/tags/${encodeURIComponent(tag)}`);
  },

  updateLeadNotes: async (email: string, notes: string): Promise<void> => {
    await apiClient.patch(`/lead-hub/${encodeURIComponent(email)}/notes`, { notes });
  },

  updateLeadNotesById: async (id: string, notes: string): Promise<void> => {
    await apiClient.patch(`/lead-hub/id/${encodeURIComponent(id)}/notes`, { notes });
  },

  deleteLeadById: async (id: string): Promise<void> => {
    await apiClient.delete(`/lead-hub/id/${encodeURIComponent(id)}`);
  },

  importLeads: async (rows: Record<string, string>[]): Promise<{ total: number; created: number; updated: number; errors: number; errorDetails: { row: number; email: string; error: string }[] }> => {
    return apiClient.post('/lead-hub/import', { rows });
  },

  exportLeadsCsv: (filters: {
    status?: string; search?: string; startDate?: string; endDate?: string; customField?: string; customValue?: string;
  } = {}): void => {
    const params = new URLSearchParams();
    if (filters.status)    params.set('status', filters.status);
    if (filters.search)    params.set('search', filters.search);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate)   params.set('endDate', filters.endDate);
    if (filters.customField) params.set('customField', filters.customField);
    if (filters.customValue) params.set('customValue', filters.customValue);
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const qs = params.toString();
    window.open(`${apiUrl}/lead-hub/export${qs ? `?${qs}` : ''}`, '_blank');
  },

  migrateWebhookLeads: async (): Promise<{ message: string; migrated: number; skipped: number; errors: number }> => {
    return apiClient.post('/lead-hub/migrate-webhook', {});
  },

  listLeadWebhooks: async (): Promise<LeadWebhookSource[]> => {
    return apiClient.get<LeadWebhookSource[]>('/lead-webhooks');
  },

  createLeadWebhook: async (payload: {
    name: string;
    type: string;
    description?: string;
    automaticTags?: string[];
    fieldMappings?: Record<string, string>;
    defaultPersona?: string;
    defaultPain?: string;
    defaultSource?: string;
    defaultCampaign?: string;
  }): Promise<LeadWebhookSource> => {
    return apiClient.post<LeadWebhookSource>('/lead-webhooks', payload);
  },

  updateLeadWebhook: async (
    id: string,
    payload: Partial<{
      name: string;
      type: string;
      description: string;
      isActive: boolean;
      automaticTags: string[];
      fieldMappings: Record<string, string>;
      defaultPersona: string;
      defaultPain: string;
      defaultSource: string;
      defaultCampaign: string;
    }>
  ): Promise<LeadWebhookSource> => {
    return apiClient.patch<LeadWebhookSource>(`/lead-webhooks/${encodeURIComponent(id)}`, payload);
  },

  regenerateLeadWebhookUrl: async (id: string): Promise<LeadWebhookSource> => {
    return apiClient.post<LeadWebhookSource>(`/lead-webhooks/${encodeURIComponent(id)}/regenerate-url`, {});
  },

  listLeadWebhookLogs: async (id: string, limit = 50): Promise<LeadWebhookLog[]> => {
    return apiClient.get<LeadWebhookLog[]>(`/lead-webhooks/${encodeURIComponent(id)}/logs?limit=${limit}`);
  },

  deleteLeadWebhook: async (id: string): Promise<void> => {
    return apiClient.delete(`/lead-webhooks/${encodeURIComponent(id)}`);
  },

  inspectLeadWebhook: async (id: string): Promise<LeadWebhookInspection> => {
    return apiClient.get<LeadWebhookInspection>(`/lead-webhooks/${encodeURIComponent(id)}/inspect`);
  },

  inspectLeadWebhookByPublicId: async (publicId: string): Promise<LeadWebhookInspection> => {
    return apiClient.get<LeadWebhookInspection>(`/lead-webhooks/by-public/${encodeURIComponent(publicId)}/inspect`);
  },

  testLeadWebhook: async (id: string, payload: Record<string, unknown> = {}): Promise<{
    ok: boolean;
    leadId: string;
    email: string;
    conversionId: string;
    logId: string;
  }> => {
    return apiClient.post(`/lead-webhooks/${encodeURIComponent(id)}/test`, payload);
  },

  listLeadRules: async (): Promise<LeadClassificationRule[]> => {
    return apiClient.get<LeadClassificationRule[]>('/lead-rules');
  },

  createLeadRule: async (payload: {
    name: string;
    description?: string;
    isActive?: boolean;
    priority?: number;
    trigger?: string;
    conditions: LeadRuleCondition[];
    actions: LeadRuleAction[];
  }): Promise<LeadClassificationRule> => {
    return apiClient.post<LeadClassificationRule>('/lead-rules', payload);
  },

  updateLeadRule: async (id: string, payload: Partial<{
    name: string;
    description: string;
    isActive: boolean;
    priority: number;
    trigger: string;
    conditions: LeadRuleCondition[];
    actions: LeadRuleAction[];
  }>): Promise<LeadClassificationRule> => {
    return apiClient.patch<LeadClassificationRule>(`/lead-rules/${encodeURIComponent(id)}`, payload);
  },

  deleteLeadRule: async (id: string): Promise<void> => {
    await apiClient.delete(`/lead-rules/${encodeURIComponent(id)}`);
  },

  runLeadRuleForExistingLeads: async (id: string, payload: { leadEmail?: string; limit?: number } = {}): Promise<{
    evaluated: number;
    matched: number;
    errors: number;
  }> => {
    return apiClient.post(`/lead-rules/${encodeURIComponent(id)}/run-existing`, payload);
  },

  listAutomationJourneys: async (): Promise<AutomationJourney[]> => {
    return apiClient.get<AutomationJourney[]>('/automation-journeys');
  },

  createAutomationJourney: async (payload: {
    name: string;
    description?: string | null;
    status?: AutomationJourneyStatus;
    nodes?: AutomationJourneyNode[];
    edges?: AutomationJourneyEdge[];
    triggerType?: string | null;
    isActive?: boolean;
  }): Promise<AutomationJourney> => {
    return apiClient.post<AutomationJourney>('/automation-journeys', payload);
  },

  updateAutomationJourney: async (id: string, payload: Partial<{
    name: string;
    description: string | null;
    status: AutomationJourneyStatus;
    nodes: AutomationJourneyNode[];
    edges: AutomationJourneyEdge[];
    triggerType: string | null;
    isActive: boolean;
  }>): Promise<AutomationJourney> => {
    return apiClient.patch<AutomationJourney>(`/automation-journeys/${encodeURIComponent(id)}`, payload);
  },

  deleteAutomationJourney: async (id: string): Promise<void> => {
    await apiClient.delete(`/automation-journeys/${encodeURIComponent(id)}`);
  },

  getAutomationExecutions: async (journeyId: string, limit = 50): Promise<import('../types').AutomationExecution[]> => {
    return apiClient.get(`/automation-journeys/${encodeURIComponent(journeyId)}/executions?limit=${limit}`);
  },

  getAutomationExecutionStats: async (journeyId: string): Promise<import('../types').AutomationExecutionStats> => {
    return apiClient.get(`/automation-journeys/${encodeURIComponent(journeyId)}/execution-stats`);
  },

  testAutomationJourney: async (journeyId: string, email: string): Promise<{ executionId: string }> => {
    return apiClient.post(`/automation-journeys/${encodeURIComponent(journeyId)}/test`, { email });
  },

  // --- Funnels ---

  listFunnels: async (): Promise<FunnelDef[]> => {
    return apiClient.get<FunnelDef[]>('/funnels');
  },

  createFunnel: async (data: {
    name: string;
    description?: string;
    color?: string;
    leadTags?: string[];
    impressionPages?: string[];
    campaignIds?: string[];
  }): Promise<FunnelDef> => {
    return apiClient.post<FunnelDef>('/funnels', data);
  },

  updateFunnel: async (id: string, data: Partial<{
    name: string;
    description: string;
    color: string;
    leadTags: string[];
    impressionPages: string[];
    campaignIds: string[];
  }>): Promise<FunnelDef> => {
    return apiClient.patch<FunnelDef>(`/funnels/${id}`, data);
  },

  listCampaignsForPicker: async (): Promise<{ id: string; name: string; platform: string }[]> => {
    return apiClient.get('/utm-links/campaigns');
  },

  deleteFunnel: async (id: string): Promise<void> => {
    await apiClient.delete(`/funnels/${id}`);
  },

  getFunnelStats: async (funnelId: string | null, startDate?: string, endDate?: string): Promise<FunnelStats> => {
    const params = new URLSearchParams();
    if (funnelId)  params.set('funnelId',  funnelId);
    if (startDate) params.set('startDate', startDate);
    if (endDate)   params.set('endDate',   endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<FunnelStats>(`/funnels/stats${qs}`);
  },

  // --- UTM Tracker ---

  listUTMLinks: async (filters: {
    search?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string;
    isTemplate?: boolean; startDate?: string; endDate?: string;
    page?: number; pageSize?: number;
  } = {}): Promise<UTMLinkListResult> => {
    const params = new URLSearchParams();
    if (filters.search)      params.set('search',      filters.search);
    if (filters.utmSource)   params.set('utmSource',   filters.utmSource);
    if (filters.utmMedium)   params.set('utmMedium',   filters.utmMedium);
    if (filters.utmCampaign) params.set('utmCampaign', filters.utmCampaign);
    if (filters.isTemplate !== undefined) params.set('isTemplate', String(filters.isTemplate));
    if (filters.startDate)   params.set('startDate',   filters.startDate);
    if (filters.endDate)     params.set('endDate',     filters.endDate);
    if (filters.page)        params.set('page',        String(filters.page));
    if (filters.pageSize)    params.set('pageSize',    String(filters.pageSize));
    const qs = params.toString();
    return apiClient.get<UTMLinkListResult>(`/utm-links${qs ? `?${qs}` : ''}`);
  },

  createUTMLink: async (data: {
    destinationUrl: string; utmSource: string; utmMedium: string; utmCampaign: string;
    title?: string; utmContent?: string; utmTerm?: string;
    campaignId?: string; isTemplate?: boolean; templateName?: string;
  }): Promise<UTMLink> => {
    return apiClient.post<UTMLink>('/utm-links', data);
  },

  listUTMTemplates: async (): Promise<UTMTemplate[]> => {
    return apiClient.get<UTMTemplate[]>('/utm-links/templates');
  },

  listUTMCampaigns: async (): Promise<UTMCampaignPicker[]> => {
    return apiClient.get<UTMCampaignPicker[]>('/utm-links/campaigns');
  },

  toggleUTMFavorite: async (id: string): Promise<{ isFavorite: boolean }> => {
    return apiClient.patch<{ isFavorite: boolean }>(`/utm-links/${id}/favorite`, {});
  },

  deleteUTMLink: async (id: string): Promise<void> => {
    await apiClient.delete(`/utm-links/${id}`);
  },

  // --- UTM Destinations ---
  listUTMDestinations: async (): Promise<UTMDestination[]> => {
    return apiClient.get<UTMDestination[]>('/utm-destinations');
  },

  createUTMDestination: async (data: { label: string; url: string }): Promise<UTMDestination> => {
    return apiClient.post<UTMDestination>('/utm-destinations', data);
  },

  deleteUTMDestination: async (id: string): Promise<void> => {
    await apiClient.delete(`/utm-destinations/${id}`);
  },
};


