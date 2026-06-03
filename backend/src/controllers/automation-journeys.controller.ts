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

  static async getExecutions(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      res.json(await AutomationJourneysService.getExecutions(req.params.id, limit));
    } catch (error) {
      next(error);
    }
  }

  static async getExecutionStats(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await AutomationJourneysService.getExecutionStats(req.params.id));
    } catch (error) {
      next(error);
    }
  }

  static async testRun(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body as { email?: string };
      if (!email?.trim()) {
        res.status(400).json({ error: 'email é obrigatório' });
        return;
      }

      // Verify lead exists
      const { prisma } = await import('../config/database');
      const lead = await prisma.lead.findUnique({ where: { email: email.toLowerCase().trim() }, select: { id: true } });
      if (!lead) {
        res.status(404).json({ error: `Lead não encontrado: ${email}` });
        return;
      }

      res.json(await AutomationJourneysService.testRun(req.params.id, email));
    } catch (error) {
      next(error);
    }
  }
}
