import { Request, Response, NextFunction } from 'express';
import { OKRsService } from '../services/okrs.service';

export const getOKRs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const okrs = await OKRsService.getOKRs();
    res.json(okrs);
  } catch (error) {
    next(error);
  }
};

export const saveOKR = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const okr = await OKRsService.saveOKR(req.body);
    res.status(201).json(okr);
  } catch (error) {
    next(error);
  }
};

export const updateOKR = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const payload = { ...req.body, id };
    const okr = await OKRsService.saveOKR(payload);
    res.json(okr);
  } catch (error) {
    next(error);
  }
};

export const deleteOKR = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    await OKRsService.deleteOKR(id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
