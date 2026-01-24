import { Request, Response, NextFunction } from 'express';
import { TeamService } from '../services/team.service';

export const getTeamMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const members = await TeamService.getTeamMembers();
    res.json(members);
  } catch (error) {
    next(error);
  }
};
