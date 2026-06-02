
export type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'EXPIRED';

// ─── Lead Hub ─────────────────────────────────────────────────────────────────

export type LeadStatus = 'LEAD' | 'MQL' | 'SQL' | 'SCHEDULED' | 'DEMO' | 'PROPOSAL' | 'OPPORTUNITY' | 'CLIENT' | 'LOST' | 'DISQUALIFIED';

export interface Lead {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  company: string | null;
  status: LeadStatus;
  score: number | null;
  isHot: boolean;
  tags: string[];
  assignedTo: string | null;
  firstSource: string | null;
  firstMedium: string | null;
  firstCampaign: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  _count: { conversions: number };
}

export interface LeadListResult {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LeadConversion {
  id: string;
  source: string;
  campaignName: string | null;
  formName: string | null;
  landingPage: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  convertedAt: string;
}

export interface LeadStatusHistoryEntry {
  id: string;
  fromStatus: LeadStatus;
  toStatus: LeadStatus;
  changedBy: string | null;
  reason: string | null;
  changedAt: string;
}

export interface PipedriveDealEvent {
  id: string;
  dealId: string;
  leadEmail: string;
  eventType: 'created' | 'stage_changed' | 'value_changed' | 'won' | 'lost' | 'reopened';
  fromStageId: number | null;
  fromStageName: string | null;
  toStageId: number | null;
  toStageName: string | null;
  fromValue: number | null;
  toValue: number | null;
  dealTitle: string | null;
  dealStatus: string;
  occurredAt: string;
  source: string;
  createdAt: string;
}

export interface LeadRevenueEntry {
  id: string;
  date: string;
  businessName: string;
  setupValue: number;
  mrrValue: number;
  origin: string;
  product: string[];
  closedBy?: string | null;
  whyBought?: string[];
  currentSupplier?: string[];
  dealUrl?: string | null;
  contractLink?: string | null;
  leadEmail?: string | null;
  leadName?: string | null;
}

export interface LeadProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  city: string | null;
  state: string | null;
  status: LeadStatus;
  score: number | null;
  isHot: boolean;
  tags: string[];
  assignedTo: string | null;
  firstSource: string | null;
  firstMedium: string | null;
  firstCampaign: string | null;
  firstLandingPage: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  qualifiedAt: string | null;
  convertedAt: string | null;
  pipedrivePersonId: string | null;
  pipedriveDealId: string | null;
  pipedriveDomain: string | null;
  customFields: Record<string, unknown> | null;
  notes: string | null;
  conversions: LeadConversion[];
  conversionsTotal: number;
  statusHistory: LeadStatusHistoryEntry[];
  statusHistoryTotal: number;
  revenueEntries: LeadRevenueEntry[];
}

export interface LeadCustomFieldDef {
  id: string;
  name: string;
  label: string;
  fieldType: 'text' | 'number' | 'boolean' | 'date' | 'select' | 'url';
  options: string[];
  placeholder: string | null;
  required: boolean;
  visible: boolean;
  sortOrder: number;
  sourceHint: string | null;
}

export type FunnelCounts = Record<LeadStatus, number>;

export interface LeadWebhookSource {
  id: string;
  publicId: string;
  name: string;
  type: string;
  description: string | null;
  isActive: boolean;
  securityMode: string;
  automaticTags: string[];
  fieldMappings: Record<string, string>;
  defaultPersona: string | null;
  defaultPain: string | null;
  defaultSource: string | null;
  defaultCampaign: string | null;
  webhookUrl: string;
  totalLogs: number;
  successCount: number;
  errorCount: number;
  healthStatus: 'inactive' | 'waiting_test' | 'error' | 'needs_mapping' | 'missing_email_mapping' | 'ready';
  mappingCount: number;
  hasRequiredEmailMapping: boolean;
  lastLog: {
    status: string;
    receivedAt: string;
    error: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadWebhookLog {
  id: string;
  source: string;
  sourceId: string | null;
  payload: unknown;
  normalized: unknown;
  result: unknown;
  status: string;
  leadEmail: string | null;
  error: string | null;
  receivedAt: string;
  processedAt: string | null;
}

export interface LeadWebhookInspection {
  sourceId: string;
  detectedFields: string[];
  currentMappings: Record<string, string>;
  suggestedMappings: Record<string, string>;
  normalizedPreview: unknown;
  lastPayload: unknown;
  lastLogStatus: string | null;
  lastLogError: string | null;
}

export interface LeadRuleCondition {
  field: string;
  operator: 'contains' | 'contains_any' | 'equals' | 'filled' | 'tag_exists' | 'score_gt' | 'starts_with' | 'ends_with';
  connector?: 'and' | 'or';
  value?: string;
  values?: string[];
}

export interface LeadRuleAction {
  type: 'add_tag' | 'remove_tag' | 'add_score' | 'set_custom_field' | 'set_status' | 'set_persona' | 'set_pain' | 'move_funnel_stage' | 'rd_create_conversion' | 'pipedrive_create_deal';
  value?: string;
  values?: string[];
  field?: string;
  points?: number;
  status?: LeadStatus;
  conversionIdentifier?: string;
  conversionName?: string;
  extraTags?: string[];
  includeFields?: string[];
  dedupe?: boolean;
  pipeline?: 'novo_cliente' | 'upsell';
  fieldMappings?: Array<{ fieldKey: string; sourceType: 'lead_field' | 'fixed'; leadField?: string; fixedValue?: string }>;
  note?: string;
}

export interface LeadClassificationRule {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  trigger: string;
  conditions: LeadRuleCondition[];
  actions: LeadRuleAction[];
  lastRunAt: string | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
  _count?: { executions: number };
}

// ─── Funnels ──────────────────────────────────────────────────────────────────

export interface FunnelDef {
  id:               string;
  name:             string;
  description:      string | null;
  color:            string;
  filterSource:     string | null;
  filterMedium:     string | null;
  filterCampaign:   string | null;
  filterLandingPage: string | null;
  leadTags:         string[];
  impressionPages:  string[];
  campaignIds:      string[];
  sortOrder:        number;
  isActive:         boolean;
  createdAt:        string;
  updatedAt:        string;
}

export interface FunnelStats {
  funnelCounts:  FunnelCounts;
  totalLeads:    number;
  mrr:           number;
  impressions:   number;
  gaClicks:      number;
  gaUsers:       number;
  adSpend:       number;
  adImpressions: number;
  adClicks:      number;
}

// ─── UTM Tracker ──────────────────────────────────────────────────────────────

export const UTM_SOURCES = [
  'instagram', 'facebook', 'linkedin', 'google', 'youtube',
  'tiktok', 'whatsapp', 'email', 'wordpress', 'direto',
] as const;

export const UTM_MEDIUMS = [
  'organico', 'pago', 'stories', 'reels', 'feed', 'carrossel',
  'display', 'email', 'cpc', 'video', 'blog',
] as const;

export type UTMSource = typeof UTM_SOURCES[number];
export type UTMMedium = typeof UTM_MEDIUMS[number];

export interface UTMLink {
  id: string;
  title: string | null;
  destinationUrl: string;
  fullUrl: string;
  shortCode: string | null;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string | null;
  utmTerm: string | null;
  clicks: number;
  isTemplate: boolean;
  templateName: string | null;
  isFavorite: boolean;
  createdBy: string;
  campaignId: string | null;
  createdAt: string;
}

export interface UTMDestination {
  id: string;
  label: string;
  url: string;
  createdAt: string;
}

export interface UTMLinkListResult {
  links: UTMLink[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UTMTemplate {
  id: string;
  templateName: string | null;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string | null;
  utmTerm: string | null;
}

export interface UTMCampaignPicker {
  id: string;
  name: string;
  platform: string;
}

export interface PlatformConnection {
  platform: string;
  status: ConnectionStatus;
  accountId: string | null;
  accountName: string | null;
  extraIds: string[];
  tokenExpiry: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  syncCount: number;
  metadata: Record<string, unknown> | null;
}

export interface ConnectionRequirement {
  platform: string;
  requiredEnv: string[];
  missingEnv: string[];
  readyForOAuth: boolean;
}

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
  closedBy?: string | null;
  whyBought?: string[];
  currentSupplier?: string[];
  dealUrl?: string | null;
  contractLink?: string | null;
  leadEmail?: string | null;
  leadName?: string | null;
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
  dataOrigin?: 'ga4_live' | 'database_cache';
  lastSyncAt?: string | null;
}

export interface DailyLeadEntry {
  id: string;
  date: string; // ISO YYYY-MM-DD
  leads: number;
  mql: number;
  sql: number;
  sales: number;
  conversionRate: number; // Calculated (Sales / MQL) * 100 or specific logic
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

export type RdLead = WebhookLead;

export interface CampaignEvent {
  id: string;
  title: string;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
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

export interface GoogleAdsCampaign {
  id: string;
  name: string;
  status: string;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  startDate: string;
  endDate: string;
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
