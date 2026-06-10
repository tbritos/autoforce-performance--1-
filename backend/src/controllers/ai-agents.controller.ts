import { Request, Response, NextFunction } from 'express';
import { AIAgentsService } from '../services/ai-agents.service';

export class AIAgentsController {
  static async listAgents(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await AIAgentsService.listAgents());
    } catch (error) {
      next(error);
    }
  }

  static async getAgent(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await AIAgentsService.getAgent(req.params.id));
    } catch (error) {
      next(error);
    }
  }

  static async createAgent(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await AIAgentsService.createAgent(req.body));
    } catch (error) {
      next(error);
    }
  }

  static async updateAgent(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await AIAgentsService.updateAgent(req.params.id, req.body));
    } catch (error) {
      next(error);
    }
  }

  static async removeAgent(req: Request, res: Response, next: NextFunction) {
    try {
      await AIAgentsService.removeAgent(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async listKnowledge(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await AIAgentsService.listKnowledge({
        agentId: req.query.agentId ? String(req.query.agentId) : undefined,
        category: req.query.category ? String(req.query.category) : undefined,
        tag: req.query.tag ? String(req.query.tag) : undefined,
      }));
    } catch (error) {
      next(error);
    }
  }

  static async createKnowledge(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await AIAgentsService.createKnowledge(req.body));
    } catch (error) {
      next(error);
    }
  }

  static async updateKnowledge(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await AIAgentsService.updateKnowledge(req.params.id, req.body));
    } catch (error) {
      next(error);
    }
  }

  static async removeKnowledge(req: Request, res: Response, next: NextFunction) {
    try {
      await AIAgentsService.removeKnowledge(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  static async listLogs(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await AIAgentsService.listLogs({
        agentId: req.query.agentId ? String(req.query.agentId) : undefined,
        leadEmail: req.query.leadEmail ? String(req.query.leadEmail) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }));
    } catch (error) {
      next(error);
    }
  }

  static async listMemories(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await AIAgentsService.listMemories({
        agentId: req.query.agentId ? String(req.query.agentId) : undefined,
        leadEmail: req.query.leadEmail ? String(req.query.leadEmail) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }));
    } catch (error) {
      next(error);
    }
  }
}
