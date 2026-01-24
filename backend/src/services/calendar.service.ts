import { prisma } from '../config/database';
import { CampaignEvent } from '../../../types';

export class CalendarService {
  static async getEvents(): Promise<CampaignEvent[]> {
    const events = await prisma.campaignEvent.findMany({
      orderBy: { startDate: 'asc' },
    });

    return events.map(event => ({
      id: event.id,
      title: event.title,
      startDate: event.startDate.toISOString().split('T')[0],
      endDate: event.endDate.toISOString().split('T')[0],
      color: event.color,
      notes: event.notes || undefined,
    }));
  }

  static async createEvent(data: Omit<CampaignEvent, 'id'>): Promise<CampaignEvent> {
    const event = await prisma.campaignEvent.create({
      data: {
        title: data.title,
        startDate: new Date(`${data.startDate}T00:00:00`),
        endDate: new Date(`${data.endDate}T00:00:00`),
        color: data.color,
        notes: data.notes || null,
      },
    });

    return {
      id: event.id,
      title: event.title,
      startDate: event.startDate.toISOString().split('T')[0],
      endDate: event.endDate.toISOString().split('T')[0],
      color: event.color,
      notes: event.notes || undefined,
    };
  }

  static async updateEvent(id: string, data: Omit<CampaignEvent, 'id'>): Promise<CampaignEvent> {
    const event = await prisma.campaignEvent.update({
      where: { id },
      data: {
        title: data.title,
        startDate: new Date(`${data.startDate}T00:00:00`),
        endDate: new Date(`${data.endDate}T00:00:00`),
        color: data.color,
        notes: data.notes || null,
      },
    });

    return {
      id: event.id,
      title: event.title,
      startDate: event.startDate.toISOString().split('T')[0],
      endDate: event.endDate.toISOString().split('T')[0],
      color: event.color,
      notes: event.notes || undefined,
    };
  }

  static async deleteEvent(id: string): Promise<void> {
    await prisma.campaignEvent.delete({ where: { id } });
  }
}
