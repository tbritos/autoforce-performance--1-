import { Platform } from '@prisma/client';
import { PlatformConnectionService } from './platform-connection.service';

// Sync intervals in milliseconds — conservative to respect API rate limits
const ACTIVE_SYNC_PLATFORMS = [
  'META_ADS',
  'GOOGLE_ANALYTICS',
  'GOOGLE_ADS',
  'RD_STATION',
] as const satisfies readonly Platform[];

const MANUAL_SYNC_PLATFORMS = [
  ...ACTIVE_SYNC_PLATFORMS,
  'PIPEDRIVE',
] as const satisfies readonly Platform[];

type ActiveSyncPlatform = (typeof ACTIVE_SYNC_PLATFORMS)[number];
type ManualSyncPlatform = (typeof MANUAL_SYNC_PLATFORMS)[number];

const SYNC_INTERVALS_MS: Record<ActiveSyncPlatform, number> = {
  META_ADS:         15 * 60 * 1000,
  GOOGLE_ANALYTICS: 30 * 60 * 1000,
  GOOGLE_ADS:       30 * 60 * 1000,
  RD_STATION:       15 * 60 * 1000,
};

export interface SyncResult {
  platform: Platform;
  synced: number;
  errors: number;
}

const timers = new Map<ActiveSyncPlatform, ReturnType<typeof setInterval>>();

async function isConnected(platform: Platform): Promise<boolean> {
  try {
    const conn = await PlatformConnectionService.getConnection(platform);
    return conn?.status === 'CONNECTED';
  } catch {
    return false;
  }
}

async function syncMetaAds(): Promise<SyncResult> {
  const { fetchMetaCampaigns } = await import('./metaAds.service');
  const campaigns = await fetchMetaCampaigns();
  return { platform: 'META_ADS', synced: campaigns.length, errors: 0 };
}

async function syncGoogleAnalytics(): Promise<SyncResult> {
  const { syncLandingPagesFromGA4 } = await import('./googleAnalytics.service');
  const pages = await syncLandingPagesFromGA4();
  return { platform: 'GOOGLE_ANALYTICS', synced: pages.length, errors: 0 };
}

async function syncGoogleAds(): Promise<SyncResult> {
  const { syncGoogleAdsCampaignMetrics } = await import('./google-ads.service');
  const { synced, errors } = await syncGoogleAdsCampaignMetrics();
  return { platform: 'GOOGLE_ADS', synced, errors };
}

async function syncRdStation(): Promise<SyncResult> {
  const { EmailService } = await import('./email.service');
  await Promise.all([
    EmailService.syncRdCampaigns(),
    EmailService.syncWorkflowStats(),
  ]);
  return { platform: 'RD_STATION', synced: 1, errors: 0 };
}

async function syncPipedriveDeals(): Promise<SyncResult> {
  const { syncPipedrive } = await import('./pipedrive.service');
  const { synced, errors } = await syncPipedrive();
  return { platform: 'PIPEDRIVE', synced, errors };
}

const SYNC_FNS: Record<ActiveSyncPlatform, () => Promise<SyncResult>> = {
  META_ADS: syncMetaAds,
  GOOGLE_ANALYTICS: syncGoogleAnalytics,
  GOOGLE_ADS: syncGoogleAds,
  RD_STATION: syncRdStation,
};

const MANUAL_SYNC_FNS: Record<ManualSyncPlatform, () => Promise<SyncResult>> = {
  ...SYNC_FNS,
  PIPEDRIVE: syncPipedriveDeals,
};

const SYNC_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos por plataforma

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Sync timeout (${ms / 1000}s): ${label}`)), ms)
    ),
  ]);
}

async function runSync(platform: ActiveSyncPlatform): Promise<void> {
  const connected = await isConnected(platform);
  if (!connected) return;

  try {
    const result = await withTimeout(SYNC_FNS[platform](), SYNC_TIMEOUT_MS, platform);
    await PlatformConnectionService.recordSyncSuccess(platform);
    console.log(`[sync] ${platform}: synced=${result.synced} errors=${result.errors}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await PlatformConnectionService.markError(platform, msg);
    console.error(`[sync] ${platform} error:`, msg);
  }
}

export function startSyncScheduler(): void {
  for (const platform of ACTIVE_SYNC_PLATFORMS) {
    runSync(platform);
    const timer = setInterval(() => runSync(platform), SYNC_INTERVALS_MS[platform]);
    timers.set(platform, timer);
  }

  // Resume waiting automation executions every 60 seconds
  setInterval(() => {
    import('./automation-engine.service').then(({ resumeWaitingExecutions }) => {
      resumeWaitingExecutions().catch(err => console.error('[automation] resume error:', err));
    }).catch(() => {});
  }, 60_000);

  // Dispara disparos de email agendados (EmailBlast) cujo horario ja chegou
  setInterval(() => {
    import('../routes/email-blasts.routes').then(({ processDueScheduledBlasts }) => {
      processDueScheduledBlasts().catch(err => console.error('[email-blasts] scheduler error:', err));
    }).catch(() => {});
  }, 60_000);

  // Retoma disparos de email travados em "sending" sem progresso ha alguns minutos
  // (hang de rede, nao so reinicio do processo)
  setInterval(() => {
    import('../routes/email-blasts.routes').then(({ recoverStaleBlasts }) => {
      recoverStaleBlasts().catch(err => console.error('[email-blasts] watchdog error:', err));
    }).catch(() => {});
  }, 90_000);

  // Dispara disparos de WhatsApp agendados (WhatsAppBlast) cujo horario ja chegou
  setInterval(() => {
    import('../routes/whatsapp-blasts.routes').then(({ processDueWhatsAppBlasts }) => {
      processDueWhatsAppBlasts().catch(err => console.error('[whatsapp-blasts] scheduler error:', err));
    }).catch(() => {});
  }, 60_000);

  // Retoma disparos de WhatsApp travados em "sending" sem progresso ha alguns minutos
  setInterval(() => {
    import('../routes/whatsapp-blasts.routes').then(({ recoverStaleWhatsAppBlasts }) => {
      recoverStaleWhatsAppBlasts().catch(err => console.error('[whatsapp-blasts] watchdog error:', err));
    }).catch(() => {});
  }, 90_000);

  // Avalia gatilhos de automacao do tipo "Entrou em segmento" (segmentos sao dinamicos,
  // nao tem evento nativo — precisa comparar quem bate nas regras periodicamente)
  setInterval(() => {
    import('./segment-trigger.service').then(({ evaluateSegmentTriggers }) => {
      evaluateSegmentTriggers().catch(err => console.error('[segment-trigger] scheduler error:', err));
    }).catch(() => {});
  }, 120_000);

  // Detect Google Appointment Schedule bookings created after the WhatsApp AI sends the booking link.
  const bookingSyncMs = Number.parseInt(process.env.MEETING_BOOKING_SYNC_INTERVAL_MS ?? '', 10) || 5 * 60 * 1000;
  setInterval(() => {
    import('./meeting-scheduler.service').then(({ syncAppointmentScheduleBookings }) => {
      syncAppointmentScheduleBookings()
        .then(result => {
          if (result.synced > 0) {
            console.log(`[scheduler] appointment bookings synced=${result.synced} checked=${result.checkedEvents}`);
          }
        })
        .catch(err => console.error('[scheduler] appointment booking sync error:', err));
    }).catch(() => {});
  }, bookingSyncMs);

  // Follow-up automatico do agente de WhatsApp: reengaja leads em silencio ha
  // mais tempo que o configurado no agente ativo (ver ai-followup.service.ts).
  const followUpMs = Number.parseInt(process.env.FOLLOWUP_CHECK_INTERVAL_MS ?? '', 10) || 30 * 60 * 1000;
  setInterval(() => {
    import('./ai-followup.service').then(({ sendFollowUpsForSilentLeads }) => {
      sendFollowUpsForSilentLeads()
        .then(result => {
          if (result.sent > 0) {
            console.log(`[ai-followup] sent=${result.sent} evaluated=${result.evaluated}`);
          }
        })
        .catch(err => console.error('[ai-followup] scheduler error:', err));
    }).catch(() => {});
  }, followUpMs);

  // WhatsApp webhook health check every 30 minutes — catches Meta silently
  // dropping/changing the webhook subscription (no data sync, so it's not in ACTIVE_SYNC_PLATFORMS)
  import('./whatsapp-webhook-health.service').then(({ runWhatsAppWebhookHealthCheck }) => {
    runWhatsAppWebhookHealthCheck().catch(err => console.error('[whatsapp-health] check error:', err));
    setInterval(() => {
      runWhatsAppWebhookHealthCheck().catch(err => console.error('[whatsapp-health] check error:', err));
    }, 30 * 60 * 1000);
  }).catch(() => {});

  console.log('[sync] Scheduler started for:', Object.keys(SYNC_INTERVALS_MS).join(', '), '+ whatsapp-health');
}

export function stopSyncScheduler(): void {
  for (const [platform, timer] of timers) {
    clearInterval(timer);
    timers.delete(platform);
  }
}

export async function triggerSync(platform: Platform): Promise<SyncResult> {
  try {
    if (!MANUAL_SYNC_PLATFORMS.includes(platform as ManualSyncPlatform)) {
      throw new Error(`Sync nao suportado para ${platform}`);
    }
    const activePlatform = platform as ManualSyncPlatform;
    const result = await MANUAL_SYNC_FNS[activePlatform]();
    await PlatformConnectionService.recordSyncSuccess(activePlatform);
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await PlatformConnectionService.markError(platform, msg);
    throw err;
  }
}
