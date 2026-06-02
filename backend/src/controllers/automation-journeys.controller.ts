import { Request, Response, NextFunction } from 'express';
import { AutomationJourneysService } from '../services/automation-journeys.service';

export class AutomationJourneysController {
  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await AutomationJourneysService.list());
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await AutomationJourneysService.create(req.body));
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await AutomationJourneysService.update(req.params.id, req.body));
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await AutomationJourneysService.remove(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
