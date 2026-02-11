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

export interface DailyLeadEntry {
  id: string;
  date: string;
  leads: number;
  mql: number;
  sql: number;
  sales: number;
  conversionRate: number;
}

export interface LeadConversionSummary {
  id: string;
  name: string;
  identifier: string;
  source: string;
  leads: number;
  mql: number;
  sql: number;
  conversionRate: number;
  lastSeen: string;
}

export interface WebhookLead {
  id: string;
  externalId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  conversionIdentifier?: string | null;
  conversionName?: string | null;
  lastConversionDate?: string | null;
  source?: string | null;
}

export interface CampaignEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  color: string;
  notes?: string;
  source?: 'google' | 'local';
}

export type CampaignPlatform = 'Meta' | 'Google';
export type CampaignStatus = 'Ativa' | 'Pausada' | 'Em Revisao';

export interface Campaign {
  id: string;
  name: string;
  platform: CampaignPlatform;
  status: CampaignStatus;
  budget: number;
  startDate: string;
  endDate: string;
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
  date: string;
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

export interface KpiGoal {
  id: string;
  metricId: string;
  target: number;
  createdAt: string;
  completedAt?: string;
}

export interface SyncLog {
  id: string;
  source: string;
  status: string;
  message?: string;
  startedAt: string;
  finishedAt?: string;
}

export type Quarter = 'Q1 2026' | 'Q2 2026' | 'Q3 2026' | 'Q4 2026';

export interface KeyResult {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
}

export interface OKR {
  id: string;
  quarter: Quarter;
  objective: string;
  keyResults: KeyResult[];
  progress: number;
}
