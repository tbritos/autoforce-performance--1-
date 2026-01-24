import { Request, Response, NextFunction } from 'express';
import { CampaignsService } from '../services/campaigns.service';
import { fetchMetaCampaigns } from '../services/metaAds.service';

export const getCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const campaigns = await CampaignsService.getCampaigns();
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
};

export const createCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const campaign = await CampaignsService.createCampaign(req.body);
    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
};

export const updateCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const campaign = await CampaignsService.updateCampaign(req.params.id, req.body);
    res.json(campaign);
  } catch (error) {
    next(error);
  }
};

export const deleteCampaign = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await CampaignsService.deleteCampaign(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getMetaCampaigns = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate } = req.query;
    const campaigns = await fetchMetaCampaigns(startDate as string, endDate as string);
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
};
