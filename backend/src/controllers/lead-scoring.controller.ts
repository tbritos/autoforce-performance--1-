import { Request, Response, NextFunction } from 'express';
import { LeadScoringService } from '../services/lead-scoring.service';

export class LeadScoringController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try { res.json(await LeadScoringService.listRules()); } catch (e) { next(e); }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try { res.json(await LeadScoringService.getRule(req.params.id)); } catch (e) { next(e); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, logic, conditions, points, isActive } = req.body;
      if (!name?.trim()) { res.status(400).json({ error: 'name obrigatório' }); return; }
      if (!Array.isArray(conditions) || conditions.length === 0) { res.status(400).json({ error: 'conditions obrigatório' }); return; }
      if (typeof points !== 'number') { res.status(400).json({ error: 'points obrigatório' }); return; }
      res.status(201).json(await LeadScoringService.createRule({ name, logic, conditions, points, isActive }));
    } catch (e) { next(e); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await LeadScoringService.updateRule(req.params.id, req.body));
    } catch (e) { next(e); }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try { await LeadScoringService.deleteRule(req.params.id); res.status(204).end(); } catch (e) { next(e); }
  }

  static async applyExisting(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await LeadScoringService.applyScoringRulesToExistingLeads();
      res.json({ message: 'Regras aplicadas', ...result });
    } catch (e) { next(e); }
  }
}
