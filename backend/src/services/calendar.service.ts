import { prisma } from '../config/database';
import { google } from 'googleapis';
import { CampaignEvent } from '../types/shared.types';

export class CalendarService {
  private static getCalendarConfig() {
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    const credentialsPath = process.env.GOOGLE_CALENDAR_CREDENTIALS_PATH || process.env.GA4_CREDENTIALS_PATH;
    if (!calendarId || !credentialsPath) return null;
    return { calendarId, credentialsPath };
  }

  private static async getCalendarClient() {
    const config = CalendarService.getCalendarConfig();
    if (!config) {
      throw new Error('GOOGLE_CALENDAR_ID e GOOGLE_CALENDAR_CREDENTIALS_PATH (ou GA4_CREDENTIALS_PATH) devem estar configurados no .env');
    }

    const auth = new google.auth.GoogleAuth({
      keyFile: config.credentialsPath,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    return google.calendar({ version: 'v3', auth });
  }

  private static parseDateOnly(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  private static formatDateOnly(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private static shiftDate(value: string, diffDays: number) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    date.setUTCDate(date.getUTCDate() + diffDays);
    return date.toISOString().split('T')[0];
  }

  private static mapGoogleEvent(event: any): CampaignEvent | null {
    const startRaw = event.start?.date || event.start?.dateTime;
    const endRaw = event.end?.date || event.end?.dateTime;
    if (!startRaw) return null;

    const startDate = String(startRaw).slice(0, 10);
    let endDate = String(endRaw || startRaw).slice(0, 10);

    if (event.start?.date && event.end?.date) {
      endDate = CalendarService.shiftDate(endDate, -1);
    }

    const privateProps = event.extendedProperties?.private || {};
    const color = privateProps.color || '#2563eb';
    const notes = privateProps.notes || event.description || undefined;

    return {
      id: event.id,
      title: event.summary || 'Sem título',
      startDate,
      endDate,
      color,
      notes,
    };
  }

  static async getEvents(): Promise<CampaignEvent[]> {
    const config = CalendarService.getCalendarConfig();
    if (config) {
      const calendar = await CalendarService.getCalendarClient();
      const now = new Date();
      const past = new Date(now);
      const future = new Date(now);
      past.setFullYear(now.getFullYear() - 1);
      future.setFullYear(now.getFullYear() + 1);

      const events: CampaignEvent[] = [];
      let pageToken: string | undefined;

      do {
        const response = await calendar.events.list({
          calendarId: config.calendarId,
          timeMin: past.toISOString(),
          timeMax: future.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          pageToken,
          maxResults: 2500,
        });
        const items = response.data.items || [];
        items.forEach(item => {
          const mapped = CalendarService.mapGoogleEvent(item);
          if (mapped) events.push(mapped);
        });
        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      return events;
    }

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
    const config = CalendarService.getCalendarConfig();
    if (config) {
      const calendar = await CalendarService.getCalendarClient();
      const endExclusive = CalendarService.shiftDate(data.endDate, 1);

      const response = await calendar.events.insert({
        calendarId: config.calendarId,
        requestBody: {
          summary: data.title,
          description: data.notes || undefined,
          start: { date: data.startDate },
          end: { date: endExclusive },
          extendedProperties: {
            private: {
              color: data.color || '#2563eb',
              notes: data.notes || '',
            },
          },
        },
      });

      const mapped = CalendarService.mapGoogleEvent(response.data);
      if (!mapped) {
        throw new Error('Falha ao mapear evento do Google Calendar');
      }
      return mapped;
    }

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
    const config = CalendarService.getCalendarConfig();
    if (config) {
      const calendar = await CalendarService.getCalendarClient();
      const endExclusive = CalendarService.shiftDate(data.endDate, 1);

      const response = await calendar.events.patch({
        calendarId: config.calendarId,
        eventId: id,
        requestBody: {
          summary: data.title,
          description: data.notes || undefined,
          start: { date: data.startDate },
          end: { date: endExclusive },
          extendedProperties: {
            private: {
              color: data.color || '#2563eb',
              notes: data.notes || '',
            },
          },
        },
      });

      const mapped = CalendarService.mapGoogleEvent(response.data);
      if (!mapped) {
        throw new Error('Falha ao mapear evento do Google Calendar');
      }
      return mapped;
    }

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
    const config = CalendarService.getCalendarConfig();
    if (config) {
      const calendar = await CalendarService.getCalendarClient();
      await calendar.events.delete({ calendarId: config.calendarId, eventId: id });
      return;
    }

    await prisma.campaignEvent.delete({ where: { id } });
  }
}
