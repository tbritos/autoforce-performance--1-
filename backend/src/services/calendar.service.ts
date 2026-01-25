import { prisma } from '../config/database';
import { CampaignEvent } from '../../../types';

export class CalendarService {
  private static parseDateOnly(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  private static formatDateOnly(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  static async getEvents(): Promise<CampaignEvent[]> {
    const events = await prisma.campaignEvent.findMany({
      orderBy: { startDate: 'asc' },
    });

    return events.map(event => ({
      id: event.id,
      title: event.title,
      startDate: CalendarService.formatDateOnly(event.startDate),
      endDate: CalendarService.formatDateOnly(event.endDate),
      color: event.color,
      notes: event.notes || undefined,
    }));
  }

  static async createEvent(data: Omit<CampaignEvent, 'id'>): Promise<CampaignEvent> {
    const event = await prisma.campaignEvent.create({
      data: {
        title: data.title,
        startDate: CalendarService.parseDateOnly(data.startDate),
        endDate: CalendarService.parseDateOnly(data.endDate),
        color: data.color,
        notes: data.notes || null,
      },
    });

    return {
      id: event.id,
      title: event.title,
      startDate: CalendarService.formatDateOnly(event.startDate),
      endDate: CalendarService.formatDateOnly(event.endDate),
      color: event.color,
      notes: event.notes || undefined,
    };
  }

  static async updateEvent(id: string, data: Omit<CampaignEvent, 'id'>): Promise<CampaignEvent> {
    const event = await prisma.campaignEvent.update({
      where: { id },
      data: {
        title: data.title,
        startDate: CalendarService.parseDateOnly(data.startDate),
        endDate: CalendarService.parseDateOnly(data.endDate),
        color: data.color,
        notes: data.notes || null,
      },
    });

    return {
      id: event.id,
      title: event.title,
      startDate: CalendarService.formatDateOnly(event.startDate),
      endDate: CalendarService.formatDateOnly(event.endDate),
      color: event.color,
      notes: event.notes || undefined,
    };
  }

  static async deleteEvent(id: string): Promise<void> {
    await prisma.campaignEvent.delete({ where: { id } });
  }
}
