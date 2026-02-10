import { Request, Response, NextFunction } from 'express';
import { RdLeadsService } from '../services/rdleads.service';

export const syncSegmentationContacts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const includeConversion =
      req.query.includeConversion === 'true' || req.query.includeConversion === '1';
    const maxPages = req.query.maxPages ? Number(req.query.maxPages) : undefined;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;

    const result = await RdLeadsService.syncSegmentationContacts(id, {
      includeConversion,
      maxPages,
      pageSize,
    });

    res.json(result);
  } catch (error) {
    console.error('Error syncing RD segmentation contacts:', error);
    next(error);
  }
};

export const listSegmentationContacts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

    const leads = await RdLeadsService.listLeads({ startDate, endDate });
    res.json(leads);
  } catch (error) {
    console.error('Error listing RD leads:', error);
    next(error);
  }
};
