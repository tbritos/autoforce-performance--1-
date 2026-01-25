import { Request, Response, NextFunction } from 'express';
import { EmailService } from '../services/email.service';

export const getEmailCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { source } = req.query;
    const campaigns = await EmailService.getEmailCampaigns(
      source === 'rd' ? 'rd' : 'manual'
    );
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
};

export const createEmailCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const campaign = await EmailService.createEmailCampaign(req.body);
    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
};

export const updateEmailCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const campaign = await EmailService.updateEmailCampaign(req.params.id, req.body);
    res.json(campaign);
  } catch (error) {
    next(error);
  }
};

export const deleteEmailCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await EmailService.deleteEmailCampaign(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getRdEmailCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const campaigns = await EmailService.getEmailCampaigns('rd');
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
};

export const syncRdEmailCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate } = req.query;
    const campaigns = await EmailService.syncRdCampaigns(
      startDate as string,
      endDate as string
    );
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
};

export const getRdWorkflowEmailStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const stats = await EmailService.getWorkflowStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

export const syncRdWorkflowEmailStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = await EmailService.syncWorkflowStats(startDate as string, endDate as string);
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

export const getSyncLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const logs = await EmailService.getSyncLogs(limit);
    res.json(logs);
  } catch (error) {
    next(error);
  }
};
