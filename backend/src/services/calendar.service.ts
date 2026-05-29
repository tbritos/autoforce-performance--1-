import { prisma } from '../config/database';
import { google } from 'googleapis';
import { CampaignEvent } from '../types/shared.types';

export class CalendarService {
  private static getCalendarConfig() {
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    const credentialsPath =
      process.env.GOOGLE_CALENDAR_CREDENTIALS_PATH ||
      process.env.GA4_CREDENTIALS_PATH;
    const credentialsJson =
      process.env.GOOGLE_CALENDAR_CREDENTIALS_JSON ||
      process.env.GA4_CREDENTIALS_JSON;
    return { calendarId, credentialsPath, credentialsJson };
  }

  private static async getCalendarClient() {
    const { PlatformConnectionService } = await import('./platform-connection.service');
    const conn = await PlatformConnectionService.getInternalConnection('GOOGLE_CALENDAR');
    const meta = (conn?.metadata ?? {}) as Record<string, unknown>;
    const config = CalendarService.getCalendarConfig();
    const calendarId = (meta.calendarId as string | undefined) || config.calendarId;
    if (!calendarId) throw new Error('GOOGLE_CALENDAR_ID nao configurado.');

    let auth: any;
    try {
      const { OAuthService } = await import('./oauth.service');
      const token = await OAuthService.getValidToken('GOOGLE_CALENDAR');
      auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });
    } catch {
      if (!config.credentialsPath && !config.credentialsJson) {
        throw new Error('Google Calendar nao conectado. Configure OAuth em Integracoes ou credenciais de service account.');
      }
      if (config.credentialsJson) {
        const parsed = JSON.parse(config.credentialsJson);
        auth = new google.auth.GoogleAuth({
          credentials: parsed,
          scopes: ['https://www.googleapis.com/auth/calendar'],
        });
      } else {
        auth = new google.auth.GoogleAuth({
          keyFile: config.credentialsPath as string,
          scopes: ['https://www.googleapis.com/auth/calendar'],
        });
      }
    }

    return { calendar: google.calendar({ version: 'v3', auth }), calendarId };
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
      source: 'google',
    };
  }

  static async getEvents(): Promise<CampaignEvent[]> {
    const config = CalendarService.getCalendarConfig();
    if (config.calendarId || config.credentialsJson || config.credentialsPath) {
      const { calendar, calendarId } = await CalendarService.getCalendarClient();
      const now = new Date();
      const past = new Date(now);
      const future = new Date(now);
      past.setFullYear(now.getFullYear() - 1);
      future.setFullYear(now.getFullYear() + 1);

      const events: CampaignEvent[] = [];
      let pageToken: string | undefined;

      do {
        const response = await calendar.events.list({
          calendarId,
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

      const localEvents = await prisma.campaignEvent.findMany({
        orderBy: { startDate: 'asc' },
      });
      const localMap = new Map(localEvents.map(event => [event.id, event]));
      const merged: CampaignEvent[] = events.map(event => {
        const override = localMap.get(event.id);
        if (!override) return event;
        return {
          id: override.id,
          title: override.title,
          startDate: CalendarService.formatDateOnly(override.startDate),
          endDate: CalendarService.formatDateOnly(override.endDate),
          color: override.color,
          notes: override.notes || undefined,
          source: 'local',
        };
      });
      const googleIds = new Set(events.map(event => event.id));
      localEvents.forEach(event => {
        if (!googleIds.has(event.id)) {
          merged.push({
            id: event.id,
            title: event.title,
            startDate: CalendarService.formatDateOnly(event.startDate),
            endDate: CalendarService.formatDateOnly(event.endDate),
            color: event.color,
            notes: event.notes || undefined,
            source: 'local',
          });
        }
      });
      return merged;
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
      source: 'local',
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
      source: 'local',
    };
  }

  static async updateEvent(id: string, data: Omit<CampaignEvent, 'id'>): Promise<CampaignEvent> {
    const event = await prisma.campaignEvent.upsert({
      where: { id },
      update: {
        title: data.title,
        startDate: CalendarService.parseDateOnly(data.startDate),
        endDate: CalendarService.parseDateOnly(data.endDate),
        color: data.color,
        notes: data.notes || null,
      },
      create: {
        id,
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
      source: 'local',
    };
  }

  static async deleteEvent(id: string): Promise<void> {
    await prisma.campaignEvent.deleteMany({ where: { id } });
  }

  static async syncGoogleEvents(): Promise<{ synced: number; errors: number }> {
    const { calendar, calendarId } = await CalendarService.getCalendarClient();
    const now = new Date();
    const past = new Date(now);
    const future = new Date(now);
    past.setFullYear(now.getFullYear() - 1);
    future.setFullYear(now.getFullYear() + 1);

    let synced = 0;
    let errors = 0;
    let pageToken: string | undefined;

    do {
      const response = await calendar.events.list({
        calendarId,
        timeMin: past.toISOString(),
        timeMax: future.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        pageToken,
        maxResults: 2500,
      });

      for (const item of response.data.items || []) {
        const mapped = CalendarService.mapGoogleEvent(item);
        if (!mapped) continue;
        try {
          await prisma.campaignEvent.upsert({
            where: { id: mapped.id },
            update: {
              title: mapped.title,
              startDate: CalendarService.parseDateOnly(mapped.startDate),
              endDate: CalendarService.parseDateOnly(mapped.endDate),
              color: mapped.color,
              notes: mapped.notes || null,
              externalId: mapped.id,
            },
            create: {
              id: mapped.id,
              title: mapped.title,
              startDate: CalendarService.parseDateOnly(mapped.startDate),
              endDate: CalendarService.parseDateOnly(mapped.endDate),
              color: mapped.color,
              notes: mapped.notes || null,
              externalId: mapped.id,
            },
          });
          synced++;
        } catch {
          errors++;
        }
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return { synced, errors };
  }
}


