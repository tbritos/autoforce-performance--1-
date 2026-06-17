import { google } from 'googleapis';
import { randomUUID } from 'crypto';
import { LeadStatus } from '@prisma/client';
import { prisma } from '../config/database';

const BRT_OFFSET = -3; // Brazil commercial team timezone, no DST.
const DEFAULT_WORK_START_H = 9;
const DEFAULT_WORK_END_H = 18;
const DEFAULT_SLOT_DURATION_MIN = 30;
const DEFAULT_DAYS_AHEAD = 5;
const DEFAULT_MAX_SLOTS = 6;
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export interface SellerCalendar {
  name: string;
  email: string;
  calendarId: string;
  timezone: string;
  active: boolean;
  workStartHour: number;
  workEndHour: number;
}

export interface MeetingSlot {
  label: string;
  startIso: string;
  endIso: string;
  closerEmail: string;
  closerName: string;
  calendarId: string;
}

export interface BookedMeeting {
  eventId: string;
  meetLink: string | null;
  slot: MeetingSlot;
}

let nextSellerIndex = 0;

function envInt(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseSellerEntry(raw: string): SellerCalendar | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const defaults = {
    timezone: process.env.MEETING_TIMEZONE || DEFAULT_TIMEZONE,
    active: true,
    workStartHour: envInt('MEETING_WORK_START_HOUR', DEFAULT_WORK_START_H),
    workEndHour: envInt('MEETING_WORK_END_HOUR', DEFAULT_WORK_END_H),
  };

  if (trimmed.includes('|')) {
    const [nameRaw, emailRaw, calendarRaw, startRaw, endRaw] = trimmed.split('|').map(s => s.trim());
    const email = normalizeEmail(emailRaw || nameRaw);
    if (!email.includes('@')) return null;
    return {
      name: nameRaw && nameRaw.includes('@') ? email.split('@')[0] : (nameRaw || email.split('@')[0]),
      email,
      calendarId: calendarRaw || email,
      timezone: defaults.timezone,
      active: true,
      workStartHour: Number.parseInt(startRaw || '', 10) || defaults.workStartHour,
      workEndHour: Number.parseInt(endRaw || '', 10) || defaults.workEndHour,
    };
  }

  const match = trimmed.match(/^(.*?)\s*<([^>]+)>$/);
  const name = match?.[1]?.trim();
  const email = normalizeEmail(match?.[2] ?? trimmed);
  if (!email.includes('@')) return null;

  return {
    name: name || email.split('@')[0],
    email,
    calendarId: email,
    ...defaults,
  };
}

function parseJsonSellerConfig(): SellerCalendar[] {
  const raw = process.env.CLOSERS_CONFIG || process.env.SELLER_CALENDARS_JSON;
  if (!raw?.trim()) return [];

  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
  return parsed
    .map(item => {
      const email = normalizeEmail(String(item.email ?? ''));
      if (!email.includes('@')) return null;
      return {
        name: String(item.name ?? email.split('@')[0]),
        email,
        calendarId: String(item.calendarId ?? item.calendar ?? email),
        timezone: String(item.timezone ?? process.env.MEETING_TIMEZONE ?? DEFAULT_TIMEZONE),
        active: item.active !== false,
        workStartHour: Number(item.workStartHour ?? item.startHour ?? envInt('MEETING_WORK_START_HOUR', DEFAULT_WORK_START_H)),
        workEndHour: Number(item.workEndHour ?? item.endHour ?? envInt('MEETING_WORK_END_HOUR', DEFAULT_WORK_END_H)),
      };
    })
    .filter((seller): seller is SellerCalendar => Boolean(seller?.active));
}

async function getSellerCalendars(): Promise<SellerCalendar[]> {
  const fromJson = parseJsonSellerConfig();
  if (fromJson.length > 0) return dedupeSellers(fromJson);

  const env = process.env.CLOSER_EMAILS ?? '';
  const fromEnv = env.split(',').map(parseSellerEntry).filter((seller): seller is SellerCalendar => Boolean(seller));
  if (fromEnv.length > 0) return dedupeSellers(fromEnv);

  const team = await prisma.teamMember.findMany({
    where: {
      email: { not: null },
      OR: [
        { role: { contains: 'vendedor', mode: 'insensitive' } },
        { role: { contains: 'closer', mode: 'insensitive' } },
        { role: { contains: 'comercial', mode: 'insensitive' } },
        { role: { contains: 'sales', mode: 'insensitive' } },
      ],
    },
    orderBy: { name: 'asc' },
  });

  const fromTeam = team
    .map(member => parseSellerEntry(`${member.name} <${member.email ?? ''}>`))
    .filter((seller): seller is SellerCalendar => Boolean(seller));

  return dedupeSellers(fromTeam.length > 0 ? fromTeam : [parseSellerEntry('tallys.brito@autoforce.com')].filter(Boolean) as SellerCalendar[]);
}

function dedupeSellers(sellers: SellerCalendar[]): SellerCalendar[] {
  const seen = new Set<string>();
  return sellers.filter(seller => {
    const key = seller.calendarId || seller.email;
    if (seen.has(key)) return false;
    seen.add(key);
    return seller.active;
  });
}

async function getAuth() {
  try {
    const { OAuthService } = await import('./oauth.service');
    const token = await OAuthService.getValidToken('GOOGLE_CALENDAR');
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });
    return auth;
  } catch {
    const credJson = process.env.GOOGLE_CALENDAR_CREDENTIALS_JSON;
    if (!credJson) throw new Error('Google Calendar nao autenticado. Configure OAuth em Integracoes.');
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(credJson),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
  }
}

function nextBusinessDays(n: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  while (days.length < n) {
    const brtDay = new Date(cursor.getTime() + BRT_OFFSET * 3600 * 1000);
    const dow = brtDay.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function generateSlotsForDay(dayUtc: Date, seller: SellerCalendar): Array<{ startIso: string; endIso: string }> {
  const durationMin = envInt('MEETING_SLOT_DURATION_MIN', DEFAULT_SLOT_DURATION_MIN);
  const startUtcH = seller.workStartHour - BRT_OFFSET;
  const endUtcH = seller.workEndHour - BRT_OFFSET;
  const slots: Array<{ startIso: string; endIso: string }> = [];

  let current = new Date(dayUtc);
  current.setUTCHours(startUtcH, 0, 0, 0);

  const dayEnd = new Date(dayUtc);
  dayEnd.setUTCHours(endUtcH, 0, 0, 0);

  while (current < dayEnd) {
    const slotEnd = new Date(current.getTime() + durationMin * 60 * 1000);
    if (slotEnd <= dayEnd && current.getTime() > Date.now() + 60 * 60 * 1000) {
      slots.push({ startIso: current.toISOString(), endIso: slotEnd.toISOString() });
    }
    current = slotEnd;
  }

  return slots;
}

function formatSlotLabel(startIso: string, sellerName?: string): string {
  const d = new Date(startIso);
  const brt = new Date(d.getTime() + BRT_OFFSET * 3600 * 1000);
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const dow = weekdays[brt.getUTCDay()];
  const day = brt.getUTCDate();
  const mon = months[brt.getUTCMonth()];
  const h = String(brt.getUTCHours()).padStart(2, '0');
  const m = String(brt.getUTCMinutes()).padStart(2, '0');
  const base = `${dow}, ${day} ${mon} as ${h}h${m === '00' ? '' : m}`;
  return sellerName ? `${base} com ${sellerName}` : base;
}

function overlapsBusy(slotStart: number, slotEnd: number, busy: Array<{ start?: string | null; end?: string | null }>): boolean {
  return busy.some(item => {
    if (!item.start || !item.end) return false;
    const busyStart = new Date(item.start).getTime();
    const busyEnd = new Date(item.end).getTime();
    return slotStart < busyEnd && slotEnd > busyStart;
  });
}

export async function getAvailableSlots(maxSlots = envInt('MEETING_MAX_SLOTS', DEFAULT_MAX_SLOTS)): Promise<MeetingSlot[]> {
  const auth = await getAuth();
  const cal = google.calendar({ version: 'v3', auth: auth as any });
  const sellers = await getSellerCalendars();
  const slotLimit = Math.max(1, maxSlots);
  const days = nextBusinessDays(Math.max(1, envInt('MEETING_DAYS_AHEAD', DEFAULT_DAYS_AHEAD)));

  const timeMin = days[0].toISOString();
  const timeMax = new Date(days[days.length - 1].getTime() + 24 * 60 * 60 * 1000).toISOString();

  const freebusyRes = await cal.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone: process.env.MEETING_TIMEZONE || DEFAULT_TIMEZONE,
      items: sellers.map(seller => ({ id: seller.calendarId })),
    },
  });

  const calendars = freebusyRes.data.calendars ?? {};
  const usableSellers = sellers.filter(seller => {
    const calendar = calendars[seller.calendarId];
    if ((calendar as any)?.errors?.length) {
      console.warn(`[scheduler] Calendar ignored (${seller.calendarId}):`, (calendar as any).errors);
      return false;
    }
    return true;
  });

  const available: MeetingSlot[] = [];
  const sellerCount = usableSellers.length;
  if (sellerCount === 0) return available;

  for (const day of days) {
    for (let offset = 0; offset < sellerCount; offset++) {
      const seller = usableSellers[(nextSellerIndex + offset) % sellerCount];
      const busy = calendars[seller.calendarId]?.busy ?? [];

      for (const slot of generateSlotsForDay(day, seller)) {
        const slotStart = new Date(slot.startIso).getTime();
        const slotEnd = new Date(slot.endIso).getTime();
        if (overlapsBusy(slotStart, slotEnd, busy)) continue;

        available.push({
          label: formatSlotLabel(slot.startIso, seller.name),
          startIso: slot.startIso,
          endIso: slot.endIso,
          closerEmail: seller.email,
          closerName: seller.name,
          calendarId: seller.calendarId,
        });

        nextSellerIndex = (nextSellerIndex + offset + 1) % sellerCount;
        break;
      }

      if (available.length >= slotLimit) return available;
    }
  }

  return available;
}

async function assertSlotStillAvailable(slot: MeetingSlot): Promise<void> {
  const auth = await getAuth();
  const cal = google.calendar({ version: 'v3', auth: auth as any });
  const freebusyRes = await cal.freebusy.query({
    requestBody: {
      timeMin: slot.startIso,
      timeMax: slot.endIso,
      timeZone: process.env.MEETING_TIMEZONE || DEFAULT_TIMEZONE,
      items: [{ id: slot.calendarId || slot.closerEmail }],
    },
  });

  const busy = freebusyRes.data.calendars?.[slot.calendarId || slot.closerEmail]?.busy ?? [];
  if (overlapsBusy(new Date(slot.startIso).getTime(), new Date(slot.endIso).getTime(), busy)) {
    throw new Error('Horario indisponivel');
  }
}

export async function bookMeeting(
  slot: MeetingSlot,
  lead: { name: string | null; email: string; phone?: string | null },
): Promise<BookedMeeting> {
  await assertSlotStillAvailable(slot);

  const auth = await getAuth();
  const cal = google.calendar({ version: 'v3', auth: auth as any });

  const summary = `Diagnostico AutoForce - ${lead.name ?? lead.phone ?? 'Lead'}`;
  const description = [
    'Reuniao de diagnostico agendada pela Lara (AutoForce).',
    `Lead: ${lead.name ?? '-'}`,
    `Contato: ${lead.email !== '' ? lead.email : (lead.phone ?? '-')}`,
    `Especialista: ${slot.closerName} <${slot.closerEmail}>`,
    '',
    'Google Meet gerado automaticamente.',
  ].join('\n');

  const event = await cal.events.insert({
    calendarId: slot.calendarId || slot.closerEmail,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary,
      description,
      start: { dateTime: slot.startIso, timeZone: process.env.MEETING_TIMEZONE || DEFAULT_TIMEZONE },
      end: { dateTime: slot.endIso, timeZone: process.env.MEETING_TIMEZONE || DEFAULT_TIMEZONE },
      attendees: [
        { email: slot.closerEmail },
        ...(lead.email && !lead.email.includes('@autoforce.internal') ? [{ email: lead.email }] : []),
      ],
      extendedProperties: {
        private: {
          source: 'autoforce-whatsapp-ai',
          leadEmail: lead.email,
          leadPhone: lead.phone ?? '',
          closerEmail: slot.closerEmail,
        },
      },
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  const currentLead = await prisma.lead.findUnique({
    where: { email: lead.email },
    select: { tags: true },
  });
  if (currentLead) {
    await prisma.lead.update({
      where: { email: lead.email },
      data: {
        status: LeadStatus.SCHEDULED,
        assignedTo: slot.closerEmail,
        tags: Array.from(new Set([...currentLead.tags, 'reuniao_agendada'])),
      },
    });
  }

  const meetLink = event.data.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri ?? null;
  return {
    eventId: event.data.id ?? '',
    meetLink,
    slot,
  };
}
