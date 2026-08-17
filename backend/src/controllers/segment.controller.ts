import { Request, Response, NextFunction } from 'express';
import { SegmentService, SegmentRules, SegmentValidationError } from '../services/segment.service';

function handleSegmentError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof SegmentValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }
  next(error);
}

export class SegmentController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try { res.json(await SegmentService.listSegments()); } catch (e) { next(e); }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try { res.json(await SegmentService.getSegment(req.params.id)); } catch (e) { next(e); }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description, color, rules } = req.body;
      if (!name?.trim()) { res.status(400).json({ error: 'name obrigatório' }); return; }
      if (!rules?.conditions) { res.status(400).json({ error: 'rules obrigatório' }); return; }
      res.status(201).json(await SegmentService.createSegment({ name, description, color, rules }));
    } catch (e) { handleSegmentError(e, res, next); }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await SegmentService.updateSegment(req.params.id, req.body));
    } catch (e) { handleSegmentError(e, res, next); }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try { await SegmentService.deleteSegment(req.params.id); res.status(204).end(); } catch (e) { handleSegmentError(e, res, next); }
  }

  static async preview(req: Request, res: Response, next: NextFunction) {
    try {
      const { segmentId, ...rules } = req.body as SegmentRules & { segmentId?: string };
      const count = await SegmentService.previewCount(rules, segmentId);
      res.json({ count });
    } catch (e) { handleSegmentError(e, res, next); }
  }

  static async leads(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, pageSize } = req.query as Record<string, string | undefined>;
      res.json(await SegmentService.getSegmentLeads(
        req.params.id,
        page ? Number(page) : 1,
        pageSize ? Number(pageSize) : 25
      ));
    } catch (e) { next(e); }
  }

  static async export(req: Request, res: Response, next: NextFunction) {
    try { res.json(await SegmentService.exportSegment(req.params.id)); } catch (e) { next(e); }
  }
}
