
export interface Metric {
  id: string;
  label: string;
  value: number;
  target: number;
  unit: string;
  change: number; // percentage
  trend: 'up' | 'down' | 'neutral';
  description?: string;
}

export interface ChartData {
  name: string;
  leads: number;
  qualified: number;
  sales: number;
}

export interface User {
  email: string;
  name: string;
  avatar: string;
  role: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  status: 'online' | 'busy' | 'offline';
  lastActive: string;
  leadsGenerated: number;
  salesClosed: number;
  goalProgress: number;
}

export interface RevenueEntry {
  id: string;
  date: string;
  businessName: string;
  setupValue: number;
  mrrValue: number;
  origin: string;
  product: string[];
}

export interface LandingPage {
  id: string;
  name: string;
  path: string;
  views: number;
  users: number;
  conversions: number;
  conversionRate: number;
  avgEngagementTime: string;
  bounceRate: number;       // <--- NOVO
  totalClicks: number;      // <--- NOVO
  source?: string;
}

export interface DailyLeadEntry {
  id: string;
  date: string; // ISO YYYY-MM-DD
  mql: number;
  sql: number;
  sales: number;
  conversionRate: number; // Calculated (Sales / MQL) * 100 or specific logic
}

export interface CampaignEvent {
  id: string;
  title: string;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
  color: string;
  notes?: string;
}

export type CampaignPlatform = 'Meta' | 'Google';
export type CampaignStatus = 'Ativa' | 'Pausada' | 'Em Revisao';

export interface Campaign {
  id: string;
  name: string;
  platform: CampaignPlatform;
  status: CampaignStatus;
  budget: number;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
  kpi?: string;
  notes?: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  budget: number;
  startDate: string;
  endDate: string;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export type AssetCategory = 'LP' | 'Criativo' | 'Copy' | 'UTM' | 'Outro';

export interface AssetVersion {
  id: string;
  label: string;
  link: string;
  createdAt: string;
}

export interface AssetItem {
  id: string;
  name: string;
  category: AssetCategory;
  link: string;
  notes?: string;
  tags: string[];
  versions: AssetVersion[];
}

export interface EmailCampaign {
  id: string;
  name: string;
  date: string; // ISO YYYY-MM-DD
  sends: number;
  opens: number;
  clicks: number;
  conversions: number;
  bounce: number;
}

export interface WorkflowEmailStat {
  id: string;
  externalId?: string;
  workflowId?: string;
  workflowName: string;
  emailName: string;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  deliveredRate: number;
  openedRate: number;
  clickedRate: number;
  spamRate: number;
  date: string;
}

// --- OKR Types ---
export type Quarter = 'Q1 2026' | 'Q2 2026' | 'Q3 2026' | 'Q4 2026';

export interface KeyResult {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string; // e.g., '%', 'R$', '#'
}

export interface OKR {
  id: string;
  quarter: Quarter;
  objective: string;
  keyResults: KeyResult[];
  progress: number; // 0-100 calculated
}

export enum TabView {
  DASHBOARD = 'DASHBOARD',
  LEAD_TRACKER = 'LEAD_TRACKER',
  REVENUE = 'REVENUE',
  TEAM = 'TEAM',
  OKRS = 'OKRS',
  LPS = 'LPS',
  SETTINGS = 'SETTINGS'
}
