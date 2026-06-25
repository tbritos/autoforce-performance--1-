import { Request, Response, NextFunction } from 'express';
import { RevenueService } from '../services/revenue.service';
import { prisma } from '../config/database';

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

export const updateRevenueEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const entry = await RevenueService.updateRevenueEntry(id, req.body);
    res.json(entry);
  } catch (error) {
    next(error);
  }
};

export const deleteRevenueEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    await RevenueService.deleteRevenueEntry(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const searchLeads = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q || q.length < 2) { res.json([]); return; }

    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name:  { contains: q, mode: 'insensitive' } },
          { company: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { email: true, name: true, company: true, phone: true },
      take: 10,
    });

    res.json(leads);
  } catch (error) {
    next(error);
  }
};
