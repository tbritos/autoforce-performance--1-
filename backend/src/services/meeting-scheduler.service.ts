import { google } from 'googleapis';
import { randomUUID } from 'crypto';

const BRT_OFFSET = -3; // America/Fortaleza (BRT = UTC-3, sem horario de verao)
const WORK_START_H = 9;
const WORK_END_H   = 18;
const SLOT_DURATION_MIN = 30;
const DAYS_AHEAD = 5;

export interface MeetingSlot {
  label: string;        // "Quinta, 19 jun às 14h00"
  startIso: string;     // ISO 8601 UTC
  endIso: string;
  closerEmail: string;
}

export interface BookedMeeting {
  eventId: string;
  meetLink: string | null;
  slot: MeetingSlot;
}

function getCloserEmails(): string[] {
  const env = process.env.CLOSER_EMAILS ?? '';
  const list = env.split(',').map(e => e.trim()).filter(Boolean);
  return list.length > 0 ? list : ['tallys.brito@autoforce.com'];
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
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credJson),
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    return auth;
  }
}

function nextBusinessDays(n: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  // Start from tomorrow
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  while (days.length < n) {
    const brtDay = new Date(cursor.getTime() + BRT_OFFSET * 3600 * 1000);
    const dow = brtDay.getUTCDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function generateSlotsForDay(dayUtc: Date): { startIso: string; endIso: string }[] {
  const slots: { startIso: string; endIso: string }[] = [];
  // Work hours in BRT → convert to UTC
  const startUtcH = WORK_START_H - BRT_OFFSET; // 9 - (-3) = 12 UTC
  const endUtcH   = WORK_END_H   - BRT_OFFSET; // 18 - (-3) = 21 UTC

  let current = new Date(dayUtc);
  current.setUTCHours(startUtcH, 0, 0, 0);

  const dayEnd = new Date(dayUtc);
  dayEnd.setUTCHours(endUtcH, 0, 0, 0);

  while (current < dayEnd) {
    const slotEnd = new Date(current.getTime() + SLOT_DURATION_MIN * 60 * 1000);
    if (slotEnd <= dayEnd) {
      slots.push({ startIso: current.toISOString(), endIso: slotEnd.toISOString() });
    }
    current = slotEnd;
  }
  return slots;
}

function formatSlotLabel(startIso: string): string {
  const d = new Date(startIso);
  const brt = new Date(d.getTime() + BRT_OFFSET * 3600 * 1000);
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const months   = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const dow = weekdays[brt.getUTCDay()];
  const day = brt.getUTCDate();
  const mon = months[brt.getUTCMonth()];
  const h   = String(brt.getUTCHours()).padStart(2, '0');
  const m   = String(brt.getUTCMinutes()).padStart(2, '0');
  return `${dow}, ${day} ${mon} às ${h}h${m === '00' ? '' : m}`;
}

export async function getAvailableSlots(): Promise<MeetingSlot[]> {
  const auth = await getAuth();
  const cal  = google.calendar({ version: 'v3', auth: auth as any });
  const closers = getCloserEmails();

  const days = nextBusinessDays(DAYS_AHEAD);
  const timeMin = days[0].toISOString();
  const lastDay = new Date(days[days.length - 1]);
  lastDay.setUTCDate(lastDay.getUTCDate() + 1);
  const timeMax = lastDay.toISOString();

  // Query free/busy for all closers
  const freebusyRes = await cal.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone: 'America/Fortaleza',
      items: closers.map(email => ({ id: email })),
    },
  });

  const busyByCloser: Record<string, { start: string; end: string }[]> = {};
  for (const email of closers) {
    busyByCloser[email] = (freebusyRes.data.calendars?.[email]?.busy ?? []) as { start: string; end: string }[];
  }

  const available: MeetingSlot[] = [];

  // Round-robin index persisted across calls via simple modulo
  let closerIdx = 0;

  for (const day of days) {
    const daySlots = generateSlotsForDay(day);

    for (const slot of daySlots) {
      const slotStart = new Date(slot.startIso).getTime();
      const slotEnd   = new Date(slot.endIso).getTime();

      // Try to find a free closer (round-robin)
      for (let i = 0; i < closers.length; i++) {
        const email = closers[(closerIdx + i) % closers.length];
        const busy  = busyByCloser[email] ?? [];
        const isBusy = busy.some(b => {
          const bs = new Date(b.start).getTime();
          const be = new Date(b.end).getTime();
          return slotStart < be && slotEnd > bs;
        });

        if (!isBusy) {
          available.push({
            label: formatSlotLabel(slot.startIso),
            startIso: slot.startIso,
            endIso: slot.endIso,
            closerEmail: email,
          });
          closerIdx = (closerIdx + i + 1) % closers.length;
          break;
        }
      }

      if (available.length >= 6) break;
    }
    if (available.length >= 6) break;
  }

  return available;
}

export async function bookMeeting(
  slot: MeetingSlot,
  lead: { name: string | null; email: string; phone?: string | null },
): Promise<BookedMeeting> {
  const auth = await getAuth();
  const cal  = google.calendar({ version: 'v3', auth: auth as any });

  const summary = `Diagnóstico AutoForce — ${lead.name ?? lead.phone ?? 'Lead'}`;
  const description = [
    `Reunião de diagnóstico agendada pela Lara (AutoForce).`,
    `Lead: ${lead.name ?? '—'}`,
    `Contato: ${lead.email !== '' ? lead.email : (lead.phone ?? '—')}`,
    ``,
    `Este é um Google Meet gerado automaticamente.`,
  ].join('\n');

  const event = await cal.events.insert({
    calendarId: slot.closerEmail,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary,
      description,
      start: { dateTime: slot.startIso, timeZone: 'America/Fortaleza' },
      end:   { dateTime: slot.endIso,   timeZone: 'America/Fortaleza' },
      attendees: [
        { email: slot.closerEmail },
        ...(lead.email && !lead.email.includes('@autoforce.internal') ? [{ email: lead.email }] : []),
      ],
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });

  const meetLink = event.data.conferenceData?.entryPoints?.find(ep => ep.entryPointType === 'video')?.uri ?? null;

  return {
    eventId: event.data.id ?? '',
    meetLink,
    slot,
  };
}
