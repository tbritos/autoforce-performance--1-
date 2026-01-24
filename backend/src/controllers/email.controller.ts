import { Request, Response, NextFunction } from 'express';
import { EmailService } from '../services/email.service';

export const getEmailCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const campaigns = await EmailService.getEmailCampaigns();
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
