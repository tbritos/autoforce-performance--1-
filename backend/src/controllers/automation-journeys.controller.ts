import { Request, Response, NextFunction } from 'express';
import { AutomationJourneysService } from '../services/automation-journeys.service';

export class AutomationJourneysController {
  static async listNurtureGroups(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await AutomationJourneysService.listNurtureGroups());
    } catch (error) {
      next(error);
    }
  }

  static async createNurtureGroup(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await AutomationJourneysService.createNurtureGroup(req.body));
    } catch (error) {
      next(error);
    }
  }

  static async updateNurtureGroup(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await AutomationJourneysService.updateNurtureGroup(req.params.id, req.body));
    } catch (error) {
      next(error);
    }
  }

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
      const { email, startNodeId } = req.body as { email?: string; startNodeId?: string };
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

      res.json(await AutomationJourneysService.testRun(req.params.id, email, startNodeId || undefined));
    } catch (error) {
      next(error);
    }
  }

  // Limpa o rastreamento de "Entrou em segmento" desta journey — o proximo ciclo do
  // avaliador (ate 2 min) trata todo mundo que bate com o segmento agora como entrada
  // nova e dispara de novo. Util apos corrigir um bug num bloco da automacao.
  static async reprocessSegment(req: Request, res: Response, next: NextFunction) {
    try {
      const { resetSegmentTriggerForJourney } = await import('../services/segment-trigger.service');
      const cleared = await resetSegmentTriggerForJourney(req.params.id);
      res.json({ ok: true, cleared });
    } catch (error) {
      next(error);
    }
  }

  // Reenvia o gatilho de conversão para os leads que já converteram no
  // formulário configurado na jornada. A própria engine aplica prioridade,
  // condições de persona e deduplicação antes de criar a execução.
  static async reprocessConversion(req: Request, res: Response, next: NextFunction) {
    try {
      const { prisma } = await import('../config/database');
      const { fireTrigger } = await import('../services/automation-engine.service');
      const journey = await prisma.automationJourney.findUnique({ where: { id: req.params.id } });
      if (!journey) { res.status(404).json({ error: 'Automação não encontrada' }); return; }
      const nodes = (journey.nodes as any[]) ?? [];
      const trigger = nodes.find(node => node?.type === 'trigger');
      const configuredEvent = String(trigger?.config?.event ?? '');
      const conversionName = String(trigger?.config?.eventValue ?? '').trim();
      if (configuredEvent !== 'conversion_received' || !conversionName) {
        res.status(400).json({ error: 'Esta automação não possui um gatilho de conversão configurado' }); return;
      }

      const conversions = await prisma.leadConversion.findMany({
        where: { OR: [{ formName: conversionName }, { campaignName: conversionName }] },
        select: { leadEmail: true, source: true, formName: true, convertedAt: true },
        distinct: ['leadEmail'],
      });
      for (const conversion of conversions) {
        await fireTrigger('conversion_received', conversion.leadEmail, {
          conversionName: conversion.formName || conversionName,
          source: conversion.source,
        });
      }
      res.json({ ok: true, queued: conversions.length });
    } catch (error) { next(error); }
  }
}
