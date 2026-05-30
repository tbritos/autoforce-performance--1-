import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { LeadStatus } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipedrivePerson {
  value: number;
  email?: PipedriveEmail[];
}

interface PipedriveEmail {
  value: string;
  primary: boolean;
}

interface PipedriveDealPayload {
  id: number;
  title?: string;
  status?: 'open' | 'won' | 'lost' | 'deleted';
  stage_id?: number;
  value?: number;
  currency?: string;
  person_id?: PipedrivePerson | null;
  person_email?: PipedriveEmail[];
  update_time?: string;
  add_time?: string;
  won_time?: string;
  lost_time?: string;
}

interface PipedriveWebhookBody {
  event: string; // e.g. 'updated.deal', 'added.deal'
  current: PipedriveDealPayload;
  previous?: Partial<PipedriveDealPayload> | null;
  meta?: {
    timestamp?: number;
    host?: string;
  };
}

// ─── Stage name cache (in-memory, resets on restart) ─────────────────────────

const stageNameCache = new Map<number, string>();

async function resolveStageNames(
  stageIds: (number | undefined | null)[],
  token: string,
  domain: string,
  authType: 'api_token' | 'oauth'
): Promise<void> {
  const missing = [...new Set(stageIds.filter((id): id is number => id != null && !stageNameCache.has(id)))];
  if (missing.length === 0) return;

  await Promise.allSettled(
    missing.map(async (id) => {
      try {
        const url = new URL(`https://${domain}.pipedrive.com/api/v1/stages/${id}`);
        if (authType === 'api_token') url.searchParams.set('api_token', token);
        const res = await fetch(url.toString(), {
          headers: authType === 'oauth' ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) {
          const json = await res.json() as { success: boolean; data?: { name: string } };
          if (json.success && json.data?.name) {
            stageNameCache.set(id, json.data.name);
          }
        }
      } catch {
        // Non-fatal: stage name stays undefined
      }
    })
  );
}

// ─── Deal status → Lead status ────────────────────────────────────────────────

const DEAL_STATUS_TO_LEAD: Record<string, LeadStatus> = {
  open: 'OPPORTUNITY',
  won:  'CLIENT',
  lost: 'LOST',
};

// ─── Primary email helper ─────────────────────────────────────────────────────

function primaryEmail(emails: PipedriveEmail[] = []): string | null {
  return emails.find(e => e.primary)?.value || emails[0]?.value || null;
}

// ─── Controller ───────────────────────────────────────────────────────────────

export class PipedriveWebhookController {

  static async handle(req: Request, res: Response): Promise<void> {
    // 1. Validate credentials — supports Basic Auth (Pipedrive webhook form) and query token (fallback)
    const secret = process.env.PIPEDRIVE_WEBHOOK_SECRET;
    if (secret) {
      let authorized = false;

      // Check HTTP Basic Auth: Authorization: Basic base64(user:password)
      const authHeader = req.headers.authorization ?? '';
      if (authHeader.startsWith('Basic ')) {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
        const password = decoded.split(':').slice(1).join(':'); // everything after first ":"
        if (password === secret) authorized = true;
      }

      // Fallback: query token (for testing via curl / direct URL)
      if (!authorized && req.query.token === secret) authorized = true;

      if (!authorized) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    const body = req.body as PipedriveWebhookBody;
    const { event, current, previous } = body;

    // Only handle deal events
    if (!event || !current?.id || (!event.includes('deal'))) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    // 2. Find matching lead — email can be in person_email or nested in person_id.email
    const email = primaryEmail(current.person_email ?? current.person_id?.email ?? []);
    const personId = current.person_id?.value ? String(current.person_id.value) : null;

    let lead = email
      ? await prisma.lead.findUnique({ where: { email: email.toLowerCase().trim() } })
      : null;

    if (!lead && personId) {
      lead = await prisma.lead.findFirst({ where: { pipedrivePersonId: personId } });
    }

    // No matching lead — acknowledge and skip silently
    if (!lead) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    const dealId        = String(current.id);
    const dealTitle     = current.title ?? null;
    const dealStatus    = current.status ?? 'open';
    const currentStage  = current.stage_id ?? null;
    const previousStage = previous?.stage_id ?? null;
    const currentValue  = current.value ?? null;
    const previousValue = previous?.value ?? null;
    const occurredAt    = current.update_time
      ? new Date(current.update_time)
      : new Date();

    // 3. Resolve stage names (best-effort, requires Pipedrive credentials)
    try {
      const { PlatformConnectionService } = await import('../services/platform-connection.service');
      const tokens = await PlatformConnectionService.getTokens('PIPEDRIVE');
      const conn   = await PlatformConnectionService.getConnection('PIPEDRIVE');
      const meta   = (conn?.metadata ?? {}) as Record<string, unknown>;
      const domain = (meta.domain as string) || process.env.PIPEDRIVE_DOMAIN || '';
      const authType: 'api_token' | 'oauth' = meta.authType === 'api_token' ? 'api_token' : 'oauth';
      const token  = tokens?.accessToken ?? process.env.PIPEDRIVE_API_TOKEN ?? '';

      if (token && domain) {
        await resolveStageNames([currentStage, previousStage], token, domain, authType);
      }
    } catch {
      // Non-fatal
    }

    // 4. Build events to create
    const eventsToCreate: Array<Parameters<typeof prisma.pipedriveDealEvent.create>[0]['data']> = [];
    const isAdded = event === 'added.deal';

    if (isAdded) {
      eventsToCreate.push({
        id:           `${dealId}-created-${occurredAt.getTime()}`,
        dealId,
        leadEmail:    lead.email,
        eventType:    'created',
        toStageId:    currentStage,
        toStageName:  currentStage != null ? (stageNameCache.get(currentStage) ?? null) : null,
        toValue:      currentValue,
        dealTitle,
        dealStatus,
        occurredAt,
        source:       'webhook',
      });
    } else {
      // Stage changed?
      if (currentStage != null && previousStage != null && currentStage !== previousStage) {
        eventsToCreate.push({
          id:           `${dealId}-stage-${occurredAt.getTime()}`,
          dealId,
          leadEmail:    lead.email,
          eventType:    'stage_changed',
          fromStageId:  previousStage,
          fromStageName: stageNameCache.get(previousStage) ?? null,
          toStageId:    currentStage,
          toStageName:  stageNameCache.get(currentStage) ?? null,
          dealTitle,
          dealStatus,
          occurredAt,
          source:       'webhook',
        });
      }

      // Status changed (won/lost/reopened)?
      const prevStatus = previous?.status;
      if (prevStatus !== undefined && prevStatus !== dealStatus) {
        const eventType =
          dealStatus === 'won'  ? 'won'  :
          dealStatus === 'lost' ? 'lost' : 'reopened';
        eventsToCreate.push({
          id:         `${dealId}-status-${occurredAt.getTime()}`,
          dealId,
          leadEmail:  lead.email,
          eventType,
          toValue:    currentValue,
          dealTitle,
          dealStatus,
          occurredAt,
          source:     'webhook',
        });
      }

      // Value changed?
      if (currentValue != null && previousValue != null && currentValue !== previousValue) {
        eventsToCreate.push({
          id:         `${dealId}-value-${occurredAt.getTime()}`,
          dealId,
          leadEmail:  lead.email,
          eventType:  'value_changed',
          fromValue:  previousValue,
          toValue:    currentValue,
          dealTitle,
          dealStatus,
          occurredAt,
          source:     'webhook',
        });
      }
    }

    if (eventsToCreate.length === 0) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    // 5. Persist events + update lead atomically
    const newLeadStatus = DEAL_STATUS_TO_LEAD[dealStatus] ?? 'OPPORTUNITY';

    await prisma.$transaction(async (tx) => {
      for (const data of eventsToCreate) {
        await tx.pipedriveDealEvent.upsert({
          where: { id: data.id as string },
          update: {},
          create: data,
        });
      }

      const prevStatus = lead.status;
      await tx.lead.update({
        where: { email: lead.email },
        data: {
          pipedriveDealId:   dealId,
          pipedrivePersonId: personId ?? undefined,
          status:            newLeadStatus,
          lastSeenAt:        new Date(),
          ...(newLeadStatus === 'CLIENT' && !lead.convertedAt ? { convertedAt: new Date() } : {}),
        },
      });

      if (prevStatus !== newLeadStatus) {
        await tx.leadStatusHistory.create({
          data: {
            leadEmail:  lead.email,
            fromStatus: prevStatus,
            toStatus:   newLeadStatus,
            changedBy:  null,
            reason:     `Pipedrive deal #${dealId} — ${dealStatus} (webhook)`,
          },
        });
      }
    });

    res.status(200).json({ ok: true, events: eventsToCreate.length });
  }
}
