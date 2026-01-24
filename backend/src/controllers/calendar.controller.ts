import { Request, Response, NextFunction } from 'express';
import { CalendarService } from '../services/calendar.service';

export const getEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const events = await CalendarService.getEvents();
    res.json(events);
  } catch (error) {
    next(error);
  }
};

export const createEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const event = await CalendarService.createEvent(req.body);
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
};

export const updateEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const event = await CalendarService.updateEvent(req.params.id, req.body);
    res.json(event);
  } catch (error) {
    next(error);
  }
};

export const deleteEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await CalendarService.deleteEvent(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
