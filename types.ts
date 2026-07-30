
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
  firstConversionSource: string | null;
  lastConversionSource: string | null;
  _count: { conversions: number };
}

// ─── CRM Lara (kanban de marketing/nutrição) ──────────────────────────────────
// Estágio interno, separado do LeadStatus (que é sincronizado com o Pipedrive).

export type MarketingStage =
  | 'NOVO'
  | 'QUALIFICACAO'
  | 'NUTRICAO'
  | 'AGUARDANDO_FOLLOWUP'
  | 'AGENDA_ENVIADA'
  | 'REUNIAO_AGENDADA'
  | 'SEM_INTERESSE'
  | 'TRANSFERIDO_HUMANO';

export interface MarketingKanbanCard {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  phone: string | null;
  score: number;
  isHot: boolean;
  marketingStageChangedAt: string | null;
  marketingStageSource: string | null;
}

export interface MarketingKanbanBoard {
  totals: Record<MarketingStage, number>;
  columns: Record<MarketingStage, MarketingKanbanCard[]>;
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
  rawData?: {
    payload?: Record<string, unknown>;
    normalized?: Record<string, unknown>;
    sourceName?: string;
  } | null;
}

export interface LeadStatusHistoryEntry {
  id: string;
  fromStatus: LeadStatus;
  toStatus: LeadStatus;
  changedBy: string | null;
  reason: string | null;
  lostReason: string | null;
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

export interface LeadActivity {
  id: string;
  type: string;
  message: string;
  reason: string | null;
  source: 'ai' | 'system' | 'manual' | string;
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
  pipedrivePipelineId: number | null;
  pipedriveStageId: number | null;
  pipedriveStageName: string | null;
  pipedriveDealStatus: string | null;
  pipedriveDealValue: number | null;
  pipedriveSetupValue: number | null;
  customFields: Record<string, unknown> | null;
  notes: string | null;
  conversions: LeadConversion[];
  conversionsTotal: number;
  statusHistory: LeadStatusHistoryEntry[];
  statusHistoryTotal: number;
  revenueEntries: LeadRevenueEntry[];
  activities: LeadActivity[];
  researchedAt: string | null;
  researchSummary: string | null;
  researchIcpSignal: string | null;
  aiHandoff: boolean;
  whatsappInvalidAt: string | null;
  whatsappInvalidReason: string | null;
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
  publicId?: string;
  detectedFields: string[];
  currentMappings: Record<string, string>;
  suggestedMappings: Record<string, string>;
  normalizedPreview: unknown;
  lastPayload: unknown;
  lastLogStatus: string | null;
  lastLogError: string | null;
  sampleLogId?: string | null;
  sampleLogReceivedAt?: string | null;
  latestLogId?: string | null;
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

export type AutomationJourneyStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED';

export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: string;
  text?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: WhatsAppTemplateComponent[];
}

export interface PipedriveStage {
  id: number;
  name: string;
  pipeline_id: number;
  pipeline_name: string;
  order_nr: number;
}

// ─── Relatórios customizáveis ───────────────────────────────────────────────

export type ReportWidgetType = 'KPI_CARD' | 'LINE_CHART' | 'BAR_CHART' | 'PIE_CHART' | 'TABLE';

export type MetricAggregation = 'sum' | 'count' | 'avg';
export type MetricSource = 'leads' | 'revenue' | 'campaigns' | 'ga4' | 'email';

export interface MetricDef {
  key: string;
  label: string;
  source: MetricSource;
  aggregation: MetricAggregation;
  valueField: string | null;
  dateField: string | null;
  groupableDimensions: string[];
  filterableDimensions: string[];
  description?: string;
}

export interface MetricQueryResult {
  rows: Array<{ dimension: string; value: number }>;
}

export type DrillDownEntity = 'lead' | 'revenue_entry' | 'campaign_metric' | 'email_campaign' | null;

export interface DrillDownResult {
  supported: boolean;
  reason?: string;
  entity: DrillDownEntity;
  total: number;
  page: number;
  pageSize: number;
  rows: Array<Record<string, unknown>>;
}

export type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'is_set' | 'is_not_set';

export interface ReportFilterCondition {
  id: string;
  source: MetricSource;
  field: string;
  operator: FilterOperator;
  value: string;
}

export interface FieldValueOption {
  value: string;
  label: string;
}

// Parâmetros pra abrir o modal de drill-down a partir de um clique num
// widget — dimension null/undefined = clique no total (card de KPI).
export interface DrillDownClickParams {
  metricKey: string;
  groupBy: string | null;
  dimension: string | null;
  filters: ReportFilterCondition[] | null;
  dateFrom: string | null;
  dateTo: string | null;
  datePreset: string | null;
  title: string;
}

// Config do gráfico único de um relatório — passada pros componentes de
// gráfico (WidgetRenderer, KpiCardWidget, etc). "title" é calculado no
// cliente a partir da métrica/agrupamento escolhidos, não é persistido.
export interface ChartConfig {
  type: ReportWidgetType;
  title: string;
  metricKey: string;
  groupBy: string | null;
}

export interface Report {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  isPublic: boolean;
  isFavorite: boolean;
  isOwner: boolean;
  canEdit: boolean;
  filters: ReportFilterCondition[] | null;
  dateFrom: string | null;
  dateTo: string | null;
  datePreset: string | null;
  metricKey: string | null;
  groupBy: string | null;
  chartType: ReportWidgetType;
  createdAt: string;
  updatedAt: string;
}

// Filtros/período globais do relatório, repassados como prop pros widgets —
// já que cada gráfico não tem mais sua própria config de filtro/período.
export interface ReportQueryContext {
  filters: ReportFilterCondition[] | null;
  dateFrom: string | null;
  dateTo: string | null;
  datePreset: string | null;
}

export interface ReportSummary {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  isPublic: boolean;
  isFavorite: boolean;
  isOwner: boolean;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
  chartType: ReportWidgetType;
  metricKey: string | null;
}

export interface WhatsAppPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
}

// Numero da Meta WABA combinado com o rotulo amigavel ja cadastrado no nosso
// diretorio (ou null se ainda nao foi "cadastrado" no sistema).
export interface WhatsAppNumberEntry {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  label: string | null;
  isRegistered: boolean;
}

export interface WhatsAppConversationMessage {
  id: string;
  leadId: string | null;
  leadEmail: string | null;
  phone: string;
  direction: 'outbound' | 'inbound' | string;
  type: string;
  status: string;
  messageId: string | null;
  repliedToMessageId: string | null;
  automationJourneyId: string | null;
  automationExecutionId: string | null;
  templateName: string | null;
  text: string | null;
  payload: unknown;
  phoneNumberId: string | null;
  phoneNumberLabel: string | null;
  phoneNumberDisplay: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  receivedAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export type AutomationNodeType =
  | 'trigger'
  | 'condition'
  | 'wait'
  | 'whatsapp_wait_reply'
  | 'email_wait_event'
  | 'ai_prequalify'
  | 'internal_action'
  | 'rd_conversion'
  | 'whatsapp_message'
  | 'pipedrive_action'
  | 'send_email';

export interface AutomationJourneyNode {
  id: string;
  type: AutomationNodeType;
  label: string;
  x: number;
  y: number;
  config?: Record<string, string | number | boolean | string[] | null>;
}

export interface AutomationJourneyEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: 'true' | 'false' | 'default' | 'replied' | 'no_reply' | 'failed' | string | null;
  targetHandle?: string | null;
}

export interface ExitConditionRule {
  field: string;
  operator: string;
  value: string;
}

export interface ExitConditions {
  logic: 'AND' | 'OR';
  conditions: ExitConditionRule[];
}

export interface AutomationJourney {
  id: string;
  name: string;
  description: string | null;
  status: AutomationJourneyStatus;
  nodes: AutomationJourneyNode[];
  edges: AutomationJourneyEdge[];
  triggerType: string | null;
  isActive: boolean;
  exitConditions?: ExitConditions | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    executions?: number;
  };
}

export type AutomationExecutionStatus = 'running' | 'waiting' | 'completed' | 'failed';

export interface AutomationExecutionLogEntry {
  nodeId: string;
  nodeType: string;
  status: 'ok' | 'error' | 'skipped';
  message?: string;
  ts: string;
}

export interface AutomationExecution {
  id: string;
  journeyId: string;
  leadEmail: string;
  leadName: string | null;
  leadId: string | null;
  status: AutomationExecutionStatus;
  currentNodeId: string | null;
  resumeAt: string | null;
  log: AutomationExecutionLogEntry[];
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface AutomationExecutionStats {
  running: number;
  waiting: number;
  completed: number;
  failed: number;
  total: number;
}

export type AIProvider = 'gemini' | 'openai';

export interface AIAgent {
  id: string;
  name: string;
  description: string | null;
  objective: string;
  companyContext: string;
  salesContext: string;
  icp: unknown;
  qualificationCriteria: unknown;
  disqualificationCriteria: unknown;
  toneOfVoice: string[];
  safetyRules: string[];
  discoveryQuestions: string[];
  handoffRules: unknown;
  outputSchema: unknown;
  defaultProvider: AIProvider | string | null;
  defaultModel: string | null;
  fallbackModels: string[];
  isActive: boolean;
  whatsappPhoneNumberId: string | null;
  followUpDelayHours: number;
  followUpMaxAttempts: number;
  followUpTemplateNames: string[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    knowledgeItems?: number;
    interactions?: number;
    memories?: number;
  };
}

export interface AIKnowledgeItem {
  id: string;
  agentId: string | null;
  title: string;
  category: string;
  content: string;
  tags: string[];
  priority: number;
  metadata: unknown;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIInteractionLog {
  id: string;
  agentId: string;
  leadEmail: string;
  journeyId: string | null;
  executionId: string | null;
  nodeId: string | null;
  channel: string;
  provider: string;
  model: string;
  promptSnapshot: unknown;
  response: unknown;
  decision: string | null;
  confidence: number | null;
  recommendedActions: unknown;
  error: string | null;
  createdAt: string;
  agent?: { id: string; name: string };
}

export interface AIConversationMemory {
  id: string;
  agentId: string;
  leadEmail: string;
  channel: string;
  summary: string | null;
  knownFacts: unknown;
  pains: string[];
  objections: string[];
  interests: string[];
  lastIntent: string | null;
  lastConversationState: string | null;
  nextBestAction: string | null;
  openQuestions: string[];
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  agent?: { id: string; name: string };
}

// ─── Funnels ──────────────────────────────────────────────────────────────────

export interface FunnelStage {
  id:     string;
  name:   string;
  source: string;  // 'ga4_users' | 'crm_lead' | 'crm_mql' | 'crm_sql' | 'crm_scheduled' | 'crm_demo' | 'crm_proposal' | 'crm_client' | 'crm_lost'
  color?: string;
}

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
  stagesConfig:     FunnelStage[] | null;
  sortOrder:        number;
  isActive:         boolean;
  createdAt:        string;
  updatedAt:        string;
}

export type CumulativeStageKey = 'LEAD' | 'MQL' | 'SQL' | 'SCHEDULED' | 'DEMO' | 'PROPOSAL' | 'CLIENT';

export type FunnelCumulativeCounts = Record<CumulativeStageKey, number>;

export interface FunnelStats {
  funnelCounts:      FunnelCounts;
  everReachedCounts: FunnelCumulativeCounts;
  totalLeads:        number;
  mrr:               number;
  impressions:       number;
  gaClicks:          number;
  gaUsers:           number;
  gaErrors?:         string[];
  adSpend:           number;
  adImpressions:     number;
  adClicks:          number;
}

export interface FunnelStageLead {
  id:          string;
  email:       string;
  name:        string | null;
  company:     string | null;
  phone:       string | null;
  status:      LeadStatus;
  score:       number;
  firstSeenAt: string;
}

export interface FunnelStageLeadsResult {
  total:    number;
  page:     number;
  pageSize: number;
  leads:    FunnelStageLead[];
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
  target?: number;
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
  leadId?: string | null;
  leadTags?: string[];
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

export interface EmailSent {
  id: string;
  leadEmail: string;
  resendId: string | null;
  subject: string;
  fromName: string | null;
  fromEmail: string | null;
  toEmail: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed';
  htmlBody: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  clickedUrl: string | null;
  bouncedAt: string | null;
  complainedAt: string | null;
  automationExecutionId: string | null;
  sentAt: string;
  createdAt: string;
}

export interface EmailReceived {
  id: string;
  leadEmail: string;
  resendId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string | null;
  subject: string | null;
  text: string | null;
  html: string | null;
  receivedAt: string;
  createdAt: string;
}

export interface EmailStats {
  total: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  deliveredRate: number;
  openedRate: number;
  clickedRate: number;
  bounceRate: number;
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
