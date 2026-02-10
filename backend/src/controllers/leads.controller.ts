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

export const updateDailyLead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const lead = await LeadsService.updateDailyLead(id, req.body);
    res.json(lead);
  } catch (error) {
    console.error('Error updating daily lead:', error);
    next(error);
  }
};

export const deleteDailyLead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    await LeadsService.deleteDailyLead(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting daily lead:', error);
    next(error);
  }
};

export const getLeadConversions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const conversions = await LeadsService.getLeadConversions();
    res.json(conversions);
  } catch (error) {
    console.error('Error fetching lead conversions:', error);
    next(error);
  }
};
