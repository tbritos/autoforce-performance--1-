import { Request, Response, NextFunction } from 'express';
import { LeadCustomFieldsService } from '../services/lead-custom-fields.service';

export class CustomFieldsController {

  // GET /api/lead-hub/custom-fields
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const defs = await LeadCustomFieldsService.listFieldDefs();
      res.json(defs);
    } catch (err) {
      next(err);
    }
  }

  // GET /api/lead-hub/custom-fields/:id
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const def = await LeadCustomFieldsService.getFieldDef(req.params.id);
      if (!def) { res.status(404).json({ error: 'Campo não encontrado' }); return; }
      res.json(def);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/lead-hub/custom-fields
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, label, fieldType, options, placeholder, required, visible, sortOrder, sourceHint } = req.body as Record<string, unknown>;
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Campo "name" é obrigatório' }); return;
      }
      if (typeof label !== 'string' || !label.trim()) {
        res.status(400).json({ error: 'Campo "label" é obrigatório' }); return;
      }
      const def = await LeadCustomFieldsService.createFieldDef({
        name,
        label,
        fieldType:   typeof fieldType   === 'string'  ? fieldType as never   : undefined,
        options:     Array.isArray(options)             ? options as string[] : undefined,
        placeholder: typeof placeholder === 'string'  ? placeholder         : undefined,
        required:    typeof required    === 'boolean' ? required             : undefined,
        visible:     typeof visible     === 'boolean' ? visible              : undefined,
        sortOrder:   typeof sortOrder   === 'number'  ? sortOrder            : undefined,
        sourceHint:  typeof sourceHint  === 'string'  ? sourceHint           : undefined,
      });
      res.status(201).json(def);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/lead-hub/custom-fields/:id
  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { label, fieldType, options, placeholder, required, visible, sortOrder, sourceHint } = req.body as Record<string, unknown>;
      const def = await LeadCustomFieldsService.updateFieldDef(req.params.id, {
        label:       typeof label       === 'string'  ? label.trim()          : undefined,
        fieldType:   typeof fieldType   === 'string'  ? fieldType as never    : undefined,
        options:     Array.isArray(options)             ? options as string[] : undefined,
        placeholder: typeof placeholder === 'string'  ? placeholder          : undefined,
        required:    typeof required    === 'boolean' ? required              : undefined,
        visible:     typeof visible     === 'boolean' ? visible               : undefined,
        sortOrder:   typeof sortOrder   === 'number'  ? sortOrder             : undefined,
        sourceHint:  typeof sourceHint  === 'string'  ? sourceHint            : undefined,
      });
      res.json(def);
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/lead-hub/custom-fields/:id
  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await LeadCustomFieldsService.deleteFieldDef(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/lead-hub/:email/custom-fields/:field
  static async patchValue(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, field } = req.params;
      const { value } = req.body as { value: unknown };
      await LeadCustomFieldsService.patchLeadCustomField(
        decodeURIComponent(email),
        field,
        value
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  static async patchValueByLeadId(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, field } = req.params;
      const { value } = req.body as { value: unknown };
      await LeadCustomFieldsService.patchLeadCustomFieldById(id, field, value);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  static async patchValuesByLeadId(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { fields } = req.body as { fields?: Record<string, unknown> };
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
        res.status(400).json({ error: 'Campo "fields" deve ser um objeto' });
        return;
      }

      await LeadCustomFieldsService.patchLeadCustomFieldsById(id, fields);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
}
