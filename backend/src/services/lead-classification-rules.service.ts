import { LeadStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { sendRdConversionEvent } from './rdstation.service';
import { createDealForLead } from './pipedrive.service';

type AnyRecord = Record<string, any>;

export type RuleConditionOperator =
  | 'contains'
  | 'contains_any'
  | 'equals'
  | 'filled'
  | 'tag_exists'
  | 'score_gt'
  | 'starts_with'
  | 'ends_with';

export type RuleActionType =
  | 'add_tag'
  | 'remove_tag'
  | 'add_score'
  | 'set_custom_field'
  | 'set_status'
  | 'set_persona'
  | 'set_pain'
  | 'move_funnel_stage'
  | 'rd_create_conversion'
  | 'pipedrive_create_deal';

export interface RuleCondition {
  field: string;
  operator: RuleConditionOperator;
  connector?: 'and' | 'or';
  value?: string;
  values?: string[];
}

export interface RuleAction {
  type: RuleActionType;
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
  // pipedrive_create_deal
  pipeline?: 'novo_cliente' | 'upsell';
  title?: string;
  fieldMappings?: Array<{ fieldKey: string; sourceType: 'lead_field' | 'fixed'; leadField?: string; fixedValue?: string }>;
  note?: string;
}

export interface CreateRuleInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
  priority?: number;
  trigger?: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export interface RuleExecutionResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  actionsApplied: AnyRecord[];
  error?: string;
}

export interface RuleManualRunResult {
  evaluated: number;
  matched: number;
  errors: number;
  results: RuleExecutionResult[];
}

const cleanString = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
};

const cleanArray = (value?: string[]) =>
  Array.from(new Set((value ?? []).map(item => item.trim()).filter(Boolean)));

const toConditions = (value: unknown): RuleCondition[] =>
  Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as RuleCondition[] : [];

const toActions = (value: unknown): RuleAction[] =>
  Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as RuleAction[] : [];

const getPath = (input: AnyRecord, path: string): unknown =>
  path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) return (current as AnyRecord)[key];
    return undefined;
  }, input);

const leadToContext = (lead: AnyRecord, extra: AnyRecord = {}) => ({
  lead: {
    email: lead.email,
    name: lead.name,
    phone: lead.phone,
    company: lead.company,
    jobTitle: lead.jobTitle,
    cargo: lead.jobTitle,
    city: lead.city,
    state: lead.state,
    status: lead.status,
    score: lead.score,
    tags: lead.tags ?? [],
    customFields: lead.customFields ?? {},
  },
  customFields: lead.customFields ?? {},
  tags: lead.tags ?? [],
  score: lead.score ?? 0,
  ...extra,
});

const valueAsText = (value: unknown) =>
  value === null || value === undefined ? '' : String(value).toLowerCase();

const evaluateCondition = (condition: RuleCondition, context: AnyRecord): boolean => {
  const operator = condition.operator;
  const fieldValue = getPath(context, condition.field);

  if (operator === 'filled') {
    return fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== '';
  }

  if (operator === 'tag_exists') {
    const tag = cleanString(condition.value);
    return Boolean(tag && Array.isArray(context.tags) && context.tags.includes(tag));
  }

  if (operator === 'score_gt') {
    return Number(context.score ?? 0) > Number(condition.value ?? 0);
  }

  if (operator === 'equals') {
    return valueAsText(fieldValue) === valueAsText(condition.value);
  }

  if (operator === 'contains') {
    const expected = valueAsText(condition.value);
    return expected.length > 0 && valueAsText(fieldValue).includes(expected);
  }

  if (operator === 'contains_any') {
    const values = cleanArray(condition.values ?? cleanString(condition.value)?.split(','));
    return values.some(item => valueAsText(fieldValue).includes(item.toLowerCase()));
  }

  if (operator === 'starts_with') {
    const expected = valueAsText(condition.value);
    return expected.length > 0 && valueAsText(fieldValue).startsWith(expected);
  }

  if (operator === 'ends_with') {
    const expected = valueAsText(condition.value);
    return expected.length > 0 && valueAsText(fieldValue).endsWith(expected);
  }

  return false;
};

const evaluateConditions = (conditions: RuleCondition[], context: AnyRecord): boolean => {
  if (conditions.length === 0) return true;

  return conditions.reduce((result, condition, index) => {
    const matched = evaluateCondition(condition, context);
    if (index === 0) return matched;
    return condition.connector === 'or' ? result || matched : result && matched;
  }, true);
};

const validateLeadStatus = (value?: string): LeadStatus | undefined => {
  const valid: LeadStatus[] = ['LEAD', 'MQL', 'SQL', 'SCHEDULED', 'DEMO', 'PROPOSAL', 'OPPORTUNITY', 'CLIENT', 'LOST', 'DISQUALIFIED'];
  return valid.includes(value as LeadStatus) ? value as LeadStatus : undefined;
};

const buildRdPayload = (lead: AnyRecord, context: AnyRecord, action: RuleAction) => {
  const identifier = cleanString(action.conversionIdentifier || action.value);
  if (!identifier) throw new Error('Identificador da conversao RD e obrigatorio');

  const includeFields = cleanArray(action.includeFields);
  const currentTags = Array.isArray(lead.tags) ? lead.tags : [];
  const extraTags = cleanArray(action.extraTags ?? action.values);
  const customFields =
    lead.customFields && typeof lead.customFields === 'object' && !Array.isArray(lead.customFields)
      ? lead.customFields as AnyRecord
      : {};
  const normalized = context.normalized && typeof context.normalized === 'object'
    ? context.normalized as AnyRecord
    : {};
  const conversion = normalized.conversion && typeof normalized.conversion === 'object'
    ? normalized.conversion as AnyRecord
    : {};

  const payload: AnyRecord = {
    conversion_identifier: identifier,
    email: lead.email,
  };

  const conversionName = cleanString(action.conversionName);
  if (conversionName) payload.conversion_name = conversionName;

  if (includeFields.includes('name') && lead.name) payload.name = lead.name;
  if (includeFields.includes('phone') && lead.phone) payload.mobile_phone = lead.phone;
  if (includeFields.includes('company') && lead.company) payload.company_name = lead.company;
  if (includeFields.includes('jobTitle') && lead.jobTitle) payload.job_title = lead.jobTitle;
  if (includeFields.includes('city') && lead.city) payload.city = lead.city;
  if (includeFields.includes('state') && lead.state) payload.state = lead.state;
  if (includeFields.includes('score')) payload.lead_score = lead.score ?? 0;
  if (includeFields.includes('tags')) payload.tags = Array.from(new Set([...currentTags, ...extraTags]));
  if (includeFields.includes('customFields')) Object.assign(payload, customFields);
  if (includeFields.includes('source') && normalized.source) payload.cf_origem_sistema = normalized.source;
  if (includeFields.includes('campaign') && conversion.campaignName) payload.cf_campanha = conversion.campaignName;
  if (includeFields.includes('landingPage') && conversion.landingPage) payload.cf_landing_page = conversion.landingPage;

  return { identifier, payload };
};

export class LeadClassificationRulesService {
  static async listRules() {
    return prisma.leadClassificationRule.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { executions: true } },
      },
    });
  }

  static async createRule(input: CreateRuleInput) {
    const name = cleanString(input.name);
    if (!name) throw new Error('Nome da regra e obrigatorio');

    return prisma.leadClassificationRule.create({
      data: {
        name,
        description: cleanString(input.description) || null,
        isActive: input.isActive ?? true,
        priority: Number.isFinite(input.priority) ? Number(input.priority) : 100,
        trigger: cleanString(input.trigger) || 'lead_updated',
        conditions: toConditions(input.conditions) as unknown as Prisma.JsonArray,
        actions: toActions(input.actions) as unknown as Prisma.JsonArray,
      },
    });
  }

  static async updateRule(id: string, input: Partial<CreateRuleInput>) {
    const data: Prisma.LeadClassificationRuleUpdateInput = {};
    if (input.name !== undefined) data.name = cleanString(input.name);
    if (input.description !== undefined) data.description = cleanString(input.description) || null;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.priority !== undefined) data.priority = Number(input.priority);
    if (input.trigger !== undefined) data.trigger = cleanString(input.trigger) || 'lead_updated';
    if (input.conditions !== undefined) data.conditions = toConditions(input.conditions) as unknown as Prisma.JsonArray;
    if (input.actions !== undefined) data.actions = toActions(input.actions) as unknown as Prisma.JsonArray;
    return prisma.leadClassificationRule.update({ where: { id }, data });
  }

  static async deleteRule(id: string) {
    await prisma.leadClassificationRule.delete({ where: { id } });
  }

  private static async executeRuleObject(rule: AnyRecord, leadEmail: string, extraContext: AnyRecord = {}): Promise<RuleExecutionResult> {
    const conditions = toConditions(rule.conditions);
    const actions = toActions(rule.actions);
    const currentLead = await prisma.lead.findUniqueOrThrow({ where: { email: leadEmail } });
    const context = leadToContext(currentLead, extraContext);
    const matched = evaluateConditions(conditions, context);
    const actionsApplied: AnyRecord[] = [];

    try {
      if (matched) {
        for (const action of actions) {
          const latest = await prisma.lead.findUniqueOrThrow({ where: { email: leadEmail } });
          const currentTags = latest.tags ?? [];
          const currentCustomFields =
            latest.customFields && typeof latest.customFields === 'object' && !Array.isArray(latest.customFields)
              ? latest.customFields as AnyRecord
              : {};

          if (action.type === 'add_tag') {
            for (const tag of cleanArray(action.values ?? [action.value ?? ''])) {
              if (!currentTags.includes(tag)) {
                await prisma.lead.update({ where: { email: leadEmail }, data: { tags: [...currentTags, tag] } });
                actionsApplied.push({ type: action.type, tag });
              }
            }
          }

          if (action.type === 'remove_tag') {
            for (const tag of cleanArray(action.values ?? [action.value ?? ''])) {
              await prisma.lead.update({ where: { email: leadEmail }, data: { tags: currentTags.filter(item => item !== tag) } });
              actionsApplied.push({ type: action.type, tag });
            }
          }

          if (action.type === 'add_score') {
            const points = Number(action.points ?? action.value ?? 0);
            if (Number.isFinite(points) && points !== 0) {
              await prisma.lead.update({ where: { email: leadEmail }, data: { score: (latest.score ?? 0) + points } });
              actionsApplied.push({ type: action.type, points });
            }
          }

          if (action.type === 'set_custom_field') {
            const field = cleanString(action.field);
            if (field) {
              await prisma.lead.update({
                where: { email: leadEmail },
                data: { customFields: { ...currentCustomFields, [field]: action.value ?? '' } as Prisma.JsonObject },
              });
              actionsApplied.push({ type: action.type, field, value: action.value ?? '' });
            }
          }

          if (action.type === 'set_persona' || action.type === 'set_pain' || action.type === 'move_funnel_stage') {
            const value = cleanString(action.value);
            const fieldMap: Record<string, string> = {
              set_persona: 'persona',
              set_pain: 'dor_principal',
              move_funnel_stage: 'etapa_funil',
            };
            const tagMap: Record<string, string> = {
              set_persona: 'persona',
              set_pain: 'dor',
              move_funnel_stage: 'funil',
            };

            if (value) {
              const field = fieldMap[action.type];
              const tag = `${tagMap[action.type]}:${value}`;
              const nextTags = currentTags.includes(tag) ? currentTags : [...currentTags, tag];
              await prisma.lead.update({
                where: { email: leadEmail },
                data: {
                  tags: nextTags,
                  customFields: { ...currentCustomFields, [field]: value } as Prisma.JsonObject,
                },
              });
              actionsApplied.push({ type: action.type, field, value, tag });
            }
          }

          if (action.type === 'set_status') {
            const status = validateLeadStatus(action.status || action.value);
            if (status && latest.status !== status) {
              await prisma.lead.update({ where: { email: leadEmail }, data: { status } });
              await prisma.leadStatusHistory.create({
                data: {
                  leadEmail,
                  fromStatus: latest.status,
                  toStatus: status,
                  reason: `Regra: ${rule.name}`,
                },
              });
              actionsApplied.push({ type: action.type, status });
            }
          }

          if (action.type === 'rd_create_conversion') {
            const { identifier, payload } = buildRdPayload(latest, context, action);
            const externalId = `${identifier}:${leadEmail}`;
            const source = 'rd_station_rule';

            if (action.dedupe !== false) {
              const existing = await prisma.leadConversion.findUnique({
                where: {
                  externalId_source: {
                    externalId,
                    source,
                  },
                },
              });

              if (existing) {
                actionsApplied.push({ type: action.type, conversionIdentifier: identifier, skipped: true, reason: 'duplicate' });
                continue;
              }
            }

            const rdResult = await sendRdConversionEvent(payload);
            await prisma.leadConversion.create({
              data: {
                leadEmail,
                source,
                externalId,
                formName: identifier,
                campaignName: cleanString(action.conversionName) || identifier,
                rawData: {
                  ruleId: rule.id,
                  ruleName: rule.name,
                  rdPayload: payload,
                  rdResult,
                } as Prisma.JsonObject,
                convertedAt: new Date(),
              },
            });
            actionsApplied.push({
              type: action.type,
              conversionIdentifier: identifier,
              conversionName: cleanString(action.conversionName) || null,
              eventUuid: rdResult.event_uuid || null,
            });
          }

          if (action.type === 'pipedrive_create_deal') {
            if (latest.pipedriveDealId) {
              actionsApplied.push({ type: action.type, skipped: true, reason: 'already_has_deal', dealId: latest.pipedriveDealId });
              continue;
            }
            try {
              const pipeline = (action.pipeline as 'novo_cliente' | 'upsell') ?? 'novo_cliente';
              const result = await createDealForLead(leadEmail, pipeline, action.fieldMappings, action.note);
              actionsApplied.push({ type: action.type, pipeline, pipedriveDealId: result.dealId, pipedrivePersonId: result.personId });
            } catch (pipedriveErr) {
              const msg = pipedriveErr instanceof Error ? pipedriveErr.message : String(pipedriveErr);
              actionsApplied.push({ type: action.type, error: msg });
            }
          }
        }
      }

      await prisma.leadClassificationRuleExecution.create({
        data: {
          ruleId: rule.id,
          leadEmail,
          matched,
          actionsApplied: actionsApplied as unknown as Prisma.JsonArray,
          context: extraContext as Prisma.JsonObject,
        },
      });
      await prisma.leadClassificationRule.update({
        where: { id: rule.id },
        data: { lastRunAt: new Date(), runCount: { increment: 1 } },
      });
      return { ruleId: rule.id, ruleName: rule.name, matched, actionsApplied };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.leadClassificationRuleExecution.create({
        data: {
          ruleId: rule.id,
          leadEmail,
          matched,
          actionsApplied: actionsApplied as unknown as Prisma.JsonArray,
          error: message,
          context: extraContext as Prisma.JsonObject,
        },
      });
      return { ruleId: rule.id, ruleName: rule.name, matched, actionsApplied, error: message };
    }
  }

  static async executeForLead(leadEmail: string, trigger = 'lead_updated', extraContext: AnyRecord = {}): Promise<RuleExecutionResult[]> {
    const lead = await prisma.lead.findUnique({ where: { email: leadEmail } });
    if (!lead) return [];

    const rules = await prisma.leadClassificationRule.findMany({
      where: { isActive: true, trigger: { in: [trigger, 'lead_updated'] } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    const results: RuleExecutionResult[] = [];

    for (const rule of rules) {
      results.push(await LeadClassificationRulesService.executeRuleObject(rule as unknown as AnyRecord, leadEmail, extraContext));
    }

    return results;
  }

  static async runRuleForExistingLeads(ruleId: string, input: { leadEmail?: string; limit?: number } = {}): Promise<RuleManualRunResult> {
    const rule = await prisma.leadClassificationRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new Error('Regra nao encontrada');

    const limit = Math.min(Math.max(Number(input.limit ?? 100), 1), 500);
    const leads = input.leadEmail
      ? await prisma.lead.findMany({ where: { email: input.leadEmail }, select: { email: true } })
      : await prisma.lead.findMany({
          where: { deletedAt: null },
          orderBy: { lastSeenAt: 'desc' },
          take: limit,
          select: { email: true },
        });

    const results: RuleExecutionResult[] = [];
    for (const lead of leads) {
      results.push(await LeadClassificationRulesService.executeRuleObject(rule as unknown as AnyRecord, lead.email, {
        manualRun: true,
        source: 'existing_leads',
      }));
    }

    return {
      evaluated: results.length,
      matched: results.filter(result => result.matched).length,
      errors: results.filter(result => result.error).length,
      results,
    };
  }
}
