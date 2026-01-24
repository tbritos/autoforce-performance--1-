import { Request, Response, NextFunction } from 'express';
import { LeadsService } from '../services/leads.service';

export const getDailyLeads = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const leads = await LeadsService.getDailyLeads();
    res.json(leads);
  } catch (error) {
    console.error('Error fetching daily leads:', error);
    next(error);
  }
};

export const saveDailyLead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const lead = await LeadsService.saveDailyLead(req.body);
    res.status(201).json(lead);
  } catch (error) {
    console.error('Error saving daily lead:', error);
    next(error);
  }
};
