import { Request, Response, NextFunction } from 'express';
import { RevenueService } from '../services/revenue.service';

export const getRevenueHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const origin = typeof req.query.origin === 'string' ? req.query.origin : undefined;
    const productParam = typeof req.query.product === 'string' ? req.query.product : undefined;
    const products = productParam
      ? productParam.split(',').map(item => item.trim()).filter(Boolean)
      : undefined;

    const revenue = await RevenueService.getRevenueHistory({
      origin,
      products,
    });
    res.json(revenue);
  } catch (error) {
    next(error);
  }
};

export const saveRevenueEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const entry = await RevenueService.saveRevenueEntry(req.body);
    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
};
