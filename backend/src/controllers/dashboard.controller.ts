import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service';

export const getDashboardMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const metrics = await DashboardService.getDashboardMetrics();
    res.json(metrics);
  } catch (error) {
    next(error);
  }
};

export const getPerformanceHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const history = await DashboardService.getPerformanceHistory();
    res.json(history);
  } catch (error) {
    next(error);
  }
};
