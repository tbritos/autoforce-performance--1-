import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { LeadHubService, normalizeEmail } from './lead-hub.service';
import { LeadClassificationRulesService } from './lead-classification-rules.service';

type FieldMappings = Record<string, string>;
type AnyRecord = Record<string, any>;

export interface CreateLeadWebhookInput {
  name: string;
  type: string;
  description?: string | null;
  isActive?: boolean;
  automaticTags?: string[];
  fieldMappings?: FieldMappings;
  defaultPersona?: string | null;
  defaultPain?: string | null;
  defaultSource?: string | null;
  defaultCampaign?: string | null;
}

export interface UpdateLeadWebhookInput extends Partial<CreateLeadWebhookInput> {}

const WEBHOOK_ID_BYTES = 16;

const cleanString = (value: unknown): string | undefined => {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
};

const cleanStringArray = (values?: string[]) =>
  Array.from(new Set((values ?? []).map(item => item.trim()).filter(Boolean)));

const makePublicId = () => `wbh_${crypto.randomBytes(WEBHOOK_ID_BYTES).toString('hex')}`;

const getByPath = (input: AnyRecord, path: string): unknown => {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as AnyRecord)[key];
    }
    return undefined;
  }, input);
};

const setByPath = (input: AnyRecord, path: string, value: unknown) => {
  if (value === undefined || value === null || value === '') return;
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;

  let current = input;
  for (const part of parts.slice(0, -1)) {
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
};

const normalizeMappings = (value: unknown): FieldMappings => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as AnyRecord)
      .filter(([, target]) => typeof target === 'string' && target.trim().length > 0)
      .map(([source, target]) => [source.trim(), String(target).trim()])
  );
};

const buildMappedPayload = (payload: AnyRecord, mappings: FieldMappings) => {
  const mapped: AnyRecord = {};
  for (const [sourcePath, targetPath] of Object.entries(mappings)) {
    setByPath(mapped, targetPath, getByPath(payload, sourcePath));
  }
  return mapped;
};

const fallbackLead = (payload: AnyRecord): AnyRecord => {
  const source = payload.lead || payload.contact || payload.contact_data || payload;
  const firstName = cleanString(source.first_name || source.firstName);
  const lastName = cleanString(source.last_name || source.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  return {
    email: cleanString(source.email || payload.email),
    name: cleanString(source.name || payload.name || fullName),
    phone: cleanString(source.phone || source.mobile_phone || source.personal_phone || source.whatsapp || payload.phone),
    company: cleanString(source.company || source.company_name || source.organization || payload.company),
    jobTitle: cleanString(source.jobTitle || source.job_title || source.cargo || payload.jobTitle || payload.cargo),
    city: cleanString(source.city || source.cidade || payload.city || payload.cidade),
    state: cleanString(source.state || source.estado || payload.state || payload.estado),
  };
};

const fallbackConversion = (payload: AnyRecord): AnyRecord => {
  const conversion = payload.conversion || {};
  return {
    externalId: cleanString(payload.externalId || payload.external_id || payload.id || conversion.externalId || conversion.external_id),
    campaignName: cleanString(conversion.campaignName || conversion.campaign_name || payload.campaignName || payload.campaign_name),
    formName: cleanString(conversion.formName || conversion.form_name || payload.formName || payload.form_name),
    landingPage: cleanString(conversion.landingPage || conversion.landing_page || payload.landingPage || payload.landing_page),
    utmSource: cleanString(conversion.utmSource || conversion.utm_source || payload.utm_source),
    utmMedium: cleanString(conversion.utmMedium || conversion.utm_medium || payload.utm_medium),
    utmCampaign: cleanString(conversion.utmCampaign || conversion.utm_campaign || payload.utm_campaign),
    utmContent: cleanString(conversion.utmContent || conversion.utm_content || payload.utm_content),
    utmTerm: cleanString(conversion.utmTerm || conversion.utm_term || payload.utm_term),
  };
};

const buildNormalizedPayload = (payload: AnyRecord, mappings: FieldMappings) => {
  const mapped = Object.keys(mappings).length > 0 ? buildMappedPayload(payload, mappings) : {};
  return {
    lead: {
      ...fallbackLead(payload),
      ...(mapped.lead || {}),
      ...(payload.lead || {}),
    },
    conversion: {
      ...fallbackConversion(payload),
      ...(mapped.conversion || {}),
      ...(payload.conversion || {}),
    },
    answers: {
      ...(payload.answers || {}),
      ...(mapped.answers || {}),
    },
    customFields: {
      ...(payload.customFields || {}),
      ...(mapped.customFields || {}),
    },
    metadata: {
      ...(payload.metadata || {}),
      ...(mapped.metadata || {}),
    },
  };
};

const buildWebhookUrl = (publicId: string) => {
  const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${appUrl.replace(/\/$/, '')}/api/lead-webhooks/${publicId}`;
};

const flattenPayloadFields = (value: unknown, prefix = '', output: string[] = []): string[] => {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) return output;

  for (const [key, child] of Object.entries(value as AnyRecord)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      flattenPayloadFields(child, path, output);
    } else {
      output.push(path);
    }
  }

  return output;
};

const detectTargetForField = (field: string): string => {
  const normalized = field.toLowerCase().replace(/[^a-z0-9]/g, '');
  const lastPart = field.split('.').pop()?.toLowerCase() ?? field.toLowerCase();

  if (normalized === 'email' || normalized.endsWith('email')) return 'lead.email';
  if (['nome', 'name', 'fullname', 'full_name'].includes(lastPart) || normalized.endsWith('nome')) return 'lead.name';
  if (['telefone', 'phone', 'whatsapp', 'mobilephone', 'personalphone'].includes(lastPart.replace(/_/g, ''))) return 'lead.phone';
  if (['empresa', 'company', 'organization', 'companyname'].includes(lastPart.replace(/_/g, ''))) return 'lead.company';
  if (['cargo', 'jobtitle', 'job_title', 'role'].includes(lastPart.replace(/_/g, ''))) return 'lead.jobTitle';
  if (['cidade', 'city'].includes(lastPart)) return 'lead.city';
  if (['estado', 'state', 'uf'].includes(lastPart)) return 'lead.state';
  if (lastPart === 'utm_source' || normalized.endsWith('utmsource')) return 'conversion.utmSource';
  if (lastPart === 'utm_medium' || normalized.endsWith('utmmedium')) return 'conversion.utmMedium';
  if (lastPart === 'utm_campaign' || normalized.endsWith('utmcampaign')) return 'conversion.utmCampaign';
  if (lastPart === 'utm_content' || normalized.endsWith('utmcontent')) return 'conversion.utmContent';
  if (lastPart === 'utm_term' || normalized.endsWith('utmterm')) return 'conversion.utmTerm';
  if (['landingpage', 'landing_page', 'pageurl', 'url'].includes(lastPart.replace(/_/g, ''))) return 'conversion.landingPage';
  if (['formname', 'form_name', 'formulario'].includes(lastPart.replace(/_/g, ''))) return 'conversion.formName';
  return '';
};

export class LeadWebhooksService {
  static async listSources() {
    const sources = await prisma.leadWebhookSource.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { logs: true } },
        logs: {
          orderBy: { receivedAt: 'desc' },
          take: 1,
          select: { status: true, receivedAt: true, error: true },
        },
      },
    });

    return Promise.all(sources.map(async (source) => {
      const [successCount, errorCount] = await Promise.all([
        prisma.webhookLog.count({ where: { sourceId: source.id, status: 'success' } }),
        prisma.webhookLog.count({ where: { sourceId: source.id, status: 'error' } }),
      ]);
      const lastLog = source.logs[0] ?? null;
      const mappings = normalizeMappings(source.fieldMappings);
      const hasRequiredEmailMapping =
        Object.values(mappings).includes('lead.email') ||
        source._count.logs === 0;
      const healthStatus = !source.isActive
        ? 'inactive'
        : source._count.logs === 0
          ? 'waiting_test'
          : lastLog?.status === 'error'
            ? 'error'
            : Object.keys(mappings).length === 0
              ? 'needs_mapping'
              : !hasRequiredEmailMapping
                ? 'missing_email_mapping'
                : 'ready';

      return {
        ...source,
        webhookUrl: buildWebhookUrl(source.publicId),
        totalLogs: source._count.logs,
        successCount,
        errorCount,
        healthStatus,
        mappingCount: Object.keys(mappings).length,
        hasRequiredEmailMapping,
        lastLog,
        _count: undefined,
        logs: undefined,
      };
    }));
  }

  static async createSource(input: CreateLeadWebhookInput) {
    const name = cleanString(input.name);
    const type = cleanString(input.type);
    if (!name || !type) {
      throw new Error('Nome e tipo do webhook sao obrigatorios');
    }

    const source = await prisma.leadWebhookSource.create({
      data: {
        publicId: makePublicId(),
        name,
        type,
        description: cleanString(input.description) || null,
        isActive: input.isActive ?? true,
        automaticTags: cleanStringArray(input.automaticTags),
        fieldMappings: normalizeMappings(input.fieldMappings) as Prisma.JsonObject,
        defaultPersona: cleanString(input.defaultPersona) || null,
        defaultPain: cleanString(input.defaultPain) || null,
        defaultSource: cleanString(input.defaultSource) || null,
        defaultCampaign: cleanString(input.defaultCampaign) || null,
      },
    });

    return { ...source, webhookUrl: buildWebhookUrl(source.publicId) };
  }

  static async updateSource(id: string, input: UpdateLeadWebhookInput) {
    const data: Prisma.LeadWebhookSourceUpdateInput = {};
    if (input.name !== undefined) data.name = cleanString(input.name);
    if (input.type !== undefined) data.type = cleanString(input.type);
    if (input.description !== undefined) data.description = cleanString(input.description) || null;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.automaticTags !== undefined) data.automaticTags = cleanStringArray(input.automaticTags);
    if (input.fieldMappings !== undefined) data.fieldMappings = normalizeMappings(input.fieldMappings) as Prisma.JsonObject;
    if (input.defaultPersona !== undefined) data.defaultPersona = cleanString(input.defaultPersona) || null;
    if (input.defaultPain !== undefined) data.defaultPain = cleanString(input.defaultPain) || null;
    if (input.defaultSource !== undefined) data.defaultSource = cleanString(input.defaultSource) || null;
    if (input.defaultCampaign !== undefined) data.defaultCampaign = cleanString(input.defaultCampaign) || null;

    const source = await prisma.leadWebhookSource.update({ where: { id }, data });
    return { ...source, webhookUrl: buildWebhookUrl(source.publicId) };
  }

  static async regenerateUrl(id: string) {
    const source = await prisma.leadWebhookSource.update({
      where: { id },
      data: { publicId: makePublicId() },
    });
    return { ...source, webhookUrl: buildWebhookUrl(source.publicId) };
  }

  static async deleteSource(id: string) {
    await prisma.webhookLog.deleteMany({ where: { sourceId: id } });
    await prisma.leadWebhookSource.delete({ where: { id } });
  }

  static async listLogs(sourceId: string, limit = 50) {
    return prisma.webhookLog.findMany({
      where: { sourceId },
      orderBy: { receivedAt: 'desc' },
      take: Math.min(100, Math.max(1, limit)),
    });
  }

  static async inspectSource(id: string) {
    const source = await prisma.leadWebhookSource.findUniqueOrThrow({ where: { id } });
    const lastLog = await prisma.webhookLog.findFirst({
      where: { sourceId: id },
      orderBy: { receivedAt: 'desc' },
    });

    const detectedFields = lastLog ? flattenPayloadFields(lastLog.payload) : [];
    const currentMappings = normalizeMappings(source.fieldMappings);
    const suggestedMappings = Object.fromEntries(
      detectedFields
        .map(field => [field, currentMappings[field] || detectTargetForField(field)])
        .filter(([, target]) => target)
    );

    const normalizedPreview = lastLog
      ? buildNormalizedPayload(lastLog.payload as AnyRecord, { ...suggestedMappings, ...currentMappings })
      : null;

    return {
      sourceId: id,
      detectedFields,
      currentMappings,
      suggestedMappings,
      normalizedPreview,
      lastPayload: lastLog?.payload ?? null,
      lastLogStatus: lastLog?.status ?? null,
      lastLogError: lastLog?.error ?? null,
    };
  }

  static async ingest(publicId: string, payload: AnyRecord) {
    const source = await prisma.leadWebhookSource.findUnique({ where: { publicId } });
    if (!source) {
      throw new Error('Webhook nao encontrado');
    }
    if (!source.isActive) {
      throw new Error('Webhook inativo');
    }

    const mappings = normalizeMappings(source.fieldMappings);
    const normalized = buildNormalizedPayload(payload || {}, mappings);
    const email = cleanString(normalized.lead.email);

    const log = await prisma.webhookLog.create({
      data: {
        source: source.name,
        sourceId: source.id,
        payload: (payload || {}) as Prisma.JsonObject,
        normalized: normalized as Prisma.JsonObject,
        status: 'processing',
        leadEmail: email ? normalizeEmail(email) : null,
      },
    });

    try {
      if (!email) {
        throw new Error('Email obrigatorio nao encontrado no payload');
      }

      const firstSource = cleanString(normalized.conversion.utmSource) || source.defaultSource || source.name;
      const campaignName = cleanString(normalized.conversion.campaignName) || source.defaultCampaign || undefined;

      const lead = await LeadHubService.upsertLead(
        {
          email,
          name: cleanString(normalized.lead.name),
          phone: cleanString(normalized.lead.phone),
          company: cleanString(normalized.lead.company),
          jobTitle: cleanString(normalized.lead.jobTitle),
          city: cleanString(normalized.lead.city),
          state: cleanString(normalized.lead.state),
        },
        {
          source: firstSource,
          medium: cleanString(normalized.conversion.utmMedium),
          campaign: cleanString(normalized.conversion.utmCampaign) || campaignName,
          landingPage: cleanString(normalized.conversion.landingPage),
        }
      );

      const tags = cleanStringArray([
        ...source.automaticTags,
        source.defaultPersona ? `persona:${source.defaultPersona}` : '',
        source.defaultPain ? `dor:${source.defaultPain}` : '',
      ]);

      const currentCustomFields =
        lead.customFields && typeof lead.customFields === 'object' && !Array.isArray(lead.customFields)
          ? lead.customFields as AnyRecord
          : {};
      const nextCustomFields = {
        ...currentCustomFields,
        ...normalized.answers,
        ...normalized.customFields,
        ...(source.defaultPersona ? { persona: source.defaultPersona } : {}),
        ...(source.defaultPain ? { dor_principal: source.defaultPain } : {}),
      };

      const updatedLead = await prisma.lead.update({
        where: { email: normalizeEmail(email) },
        data: {
          tags: Array.from(new Set([...lead.tags, ...tags])),
          customFields: nextCustomFields as Prisma.JsonObject,
          lastSeenAt: new Date(),
        },
      });

      const conversion = await LeadHubService.recordConversion({
        leadEmail: email,
        source: source.name,
        externalId: cleanString(normalized.conversion.externalId),
        campaignName,
        formName: cleanString(normalized.conversion.formName) || source.name,
        landingPage: cleanString(normalized.conversion.landingPage),
        utmSource: firstSource,
        utmMedium: cleanString(normalized.conversion.utmMedium),
        utmCampaign: cleanString(normalized.conversion.utmCampaign) || campaignName,
        utmContent: cleanString(normalized.conversion.utmContent),
        utmTerm: cleanString(normalized.conversion.utmTerm),
        rawData: {
          payload,
          normalized,
          sourceId: source.id,
          sourceName: source.name,
        },
      });

      const rules = await LeadClassificationRulesService.executeForLead(updatedLead.email, 'webhook_received', {
        webhookSourceId: source.id,
        webhookSourceName: source.name,
        normalized,
      });
      const rulesResult = rules.map(rule => ({
        ruleId: rule.ruleId,
        ruleName: rule.ruleName,
        matched: rule.matched,
        actionsApplied: rule.actionsApplied,
        error: rule.error,
      }));

      await prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          leadEmail: normalizeEmail(email),
          result: {
            leadId: updatedLead.id,
            email: updatedLead.email,
            conversionId: conversion.id,
            tagsApplied: tags,
            rules: rulesResult,
            leadAction: lead.createdAt.getTime() === lead.updatedAt.getTime() ? 'created' : 'updated',
          } as Prisma.JsonObject,
          processedAt: new Date(),
        },
      });

      return {
        ok: true,
        leadId: updatedLead.id,
        email: updatedLead.email,
        conversionId: conversion.id,
        tagsApplied: tags,
        logId: log.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          status: 'error',
          error: message,
          result: {
            error: message,
            requiredFields: ['lead.email'],
            hasEmail: Boolean(email),
          } as Prisma.JsonObject,
          processedAt: new Date(),
        },
      });
      throw error;
    }
  }
}
