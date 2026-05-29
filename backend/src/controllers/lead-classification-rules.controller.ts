import { Request, Response, NextFunction } from 'express';
import { LeadClassificationRulesService } from '../services/lead-classification-rules.service';

export class LeadClassificationRulesController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await LeadClassificationRulesService.listRules());
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await LeadClassificationRulesService.createRule(req.body));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await LeadClassificationRulesService.updateRule(req.params.id, req.body));
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await LeadClassificationRulesService.deleteRule(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async runExistingLeads(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await LeadClassificationRulesService.runRuleForExistingLeads(req.params.id, req.body));
    } catch (error) {
      next(error);
    }
  }
}
