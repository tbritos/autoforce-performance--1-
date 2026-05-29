import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';

// ============================================================
// LeadCustomFieldsService
// Manages the definition of custom fields (LeadCustomFieldDef)
// and reads/writes their values inside Lead.customFields (JSON).
//
// Field types: text | number | boolean | date | select | url
// ============================================================

export type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select' | 'url';

export interface CreateFieldDefInput {
  name: string;
  label: string;
  fieldType?: FieldType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  visible?: boolean;
  sortOrder?: number;
  sourceHint?: string;
}

export interface UpdateFieldDefInput {
  label?: string;
  fieldType?: FieldType;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  visible?: boolean;
  sortOrder?: number;
  sourceHint?: string;
}

// ─── Field definitions (schema management) ───────────────────────────────────

export const LeadCustomFieldsService = {

  listFieldDefs() {
    return prisma.leadCustomFieldDef.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  },

  getFieldDef(id: string) {
    return prisma.leadCustomFieldDef.findUnique({ where: { id } });
  },

  createFieldDef(input: CreateFieldDefInput) {
    const name = input.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!name) throw new Error('Nome do campo inválido');

    return prisma.leadCustomFieldDef.create({
      data: {
        name,
        label:       input.label.trim(),
        fieldType:   input.fieldType   ?? 'text',
        options:     input.options     ?? [],
        placeholder: input.placeholder ?? null,
        required:    input.required    ?? false,
        visible:     input.visible     ?? true,
        sortOrder:   input.sortOrder   ?? 0,
        sourceHint:  input.sourceHint  ?? null,
      },
    });
  },

  updateFieldDef(id: string, input: UpdateFieldDefInput) {
    return prisma.leadCustomFieldDef.update({
      where: { id },
      data: {
        ...(input.label       !== undefined ? { label:       input.label.trim() } : {}),
        ...(input.fieldType   !== undefined ? { fieldType:   input.fieldType }    : {}),
        ...(input.options     !== undefined ? { options:     input.options }      : {}),
        ...(input.placeholder !== undefined ? { placeholder: input.placeholder }  : {}),
        ...(input.required    !== undefined ? { required:    input.required }     : {}),
        ...(input.visible     !== undefined ? { visible:     input.visible }      : {}),
        ...(input.sortOrder   !== undefined ? { sortOrder:   input.sortOrder }    : {}),
        ...(input.sourceHint  !== undefined ? { sourceHint:  input.sourceHint }   : {}),
      },
    });
  },

  deleteFieldDef(id: string) {
    return prisma.leadCustomFieldDef.delete({ where: { id } });
  },

  // ─── Field values (read/write on Lead.customFields) ────────────────────────

  async getLeadCustomFields(email: string): Promise<Record<string, unknown>> {
    const lead = await prisma.lead.findUnique({
      where: { email },
      select: { customFields: true },
    });
    return (lead?.customFields as Record<string, unknown>) ?? {};
  },

  async setLeadCustomFields(
    email: string,
    fields: Record<string, unknown>
  ): Promise<void> {
    const defs = await prisma.leadCustomFieldDef.findMany({ select: { name: true } });
    const validNames = new Set(defs.map(d => d.name));

    // Only persist fields that have a valid definition
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (validNames.has(key)) sanitized[key] = value;
    }

    const existing = await prisma.lead.findUnique({
      where: { email },
      select: { customFields: true },
    });
    const current = (existing?.customFields as Record<string, unknown>) ?? {};
    const merged  = { ...current, ...sanitized };

    await prisma.lead.update({
      where: { email },
      data: { customFields: merged as Prisma.InputJsonValue },
    });
  },

  async patchLeadCustomField(
    email: string,
    fieldName: string,
    value: unknown
  ): Promise<void> {
    const def = await prisma.leadCustomFieldDef.findUnique({ where: { name: fieldName } });
    if (!def) throw new Error(`Campo customizado "${fieldName}" não existe`);

    const existing = await prisma.lead.findUnique({
      where: { email },
      select: { customFields: true },
    });
    const current = (existing?.customFields as Record<string, unknown>) ?? {};
    const merged  = { ...current, [fieldName]: value };

    await prisma.lead.update({
      where: { email },
      data: { customFields: merged as Prisma.InputJsonValue },
    });
  },

  async patchLeadCustomFieldById(
    leadId: string,
    fieldName: string,
    value: unknown
  ): Promise<void> {
    const def = await prisma.leadCustomFieldDef.findUnique({ where: { name: fieldName } });
    if (!def) throw new Error(`Campo customizado "${fieldName}" nÃ£o existe`);

    const existing = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { customFields: true },
    });
    const current = (existing?.customFields as Record<string, unknown>) ?? {};
    const merged  = { ...current, [fieldName]: value };

    await prisma.lead.update({
      where: { id: leadId },
      data: { customFields: merged as Prisma.InputJsonValue },
    });
  },

  async patchLeadCustomFieldsById(
    leadId: string,
    fields: Record<string, unknown>
  ): Promise<void> {
    const defs = await prisma.leadCustomFieldDef.findMany({ select: { name: true } });
    const validNames = new Set(defs.map(def => def.name));

    const sanitized: Record<string, unknown> = {};
    for (const [fieldName, value] of Object.entries(fields)) {
      if (!validNames.has(fieldName)) {
        throw new Error(`Campo customizado "${fieldName}" nÃ£o existe`);
      }
      sanitized[fieldName] = value;
    }

    const existing = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { customFields: true },
    });
    const current = (existing?.customFields as Record<string, unknown>) ?? {};
    const merged  = { ...current, ...sanitized };

    await prisma.lead.update({
      where: { id: leadId },
      data: { customFields: merged as Prisma.InputJsonValue },
    });
  },

  // Used by Pipedrive sync and other integrations to write custom fields
  // sourced from external platforms. Only creates fields that don't exist.
  async ensureFieldDefs(
    fields: Array<{ name: string; label: string; fieldType?: FieldType; sourceHint?: string }>
  ): Promise<void> {
    for (const field of fields) {
      const name = field.name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (!name) continue;

      await prisma.leadCustomFieldDef.upsert({
        where: { name },
        update: {},
        create: {
          name,
          label:      field.label,
          fieldType:  field.fieldType ?? 'text',
          sourceHint: field.sourceHint ?? null,
        },
      });
    }
  },
};
