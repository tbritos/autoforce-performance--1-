import { Platform } from '@prisma/client';
import { PlatformConnectionService } from './platform-connection.service';

// Sync intervals in milliseconds — conservative to respect API rate limits
const ACTIVE_SYNC_PLATFORMS = [
  'META_ADS',
  'GOOGLE_ANALYTICS',
  'GOOGLE_ADS',
  'RD_STATION',
  'PIPEDRIVE',
] as const satisfies readonly Platform[];

type ActiveSyncPlatform = (typeof ACTIVE_SYNC_PLATFORMS)[number];

const SYNC_INTERVALS_MS: Record<ActiveSyncPlatform, number> = {
  META_ADS:         15 * 60 * 1000,
  GOOGLE_ANALYTICS: 30 * 60 * 1000,
  GOOGLE_ADS:       30 * 60 * 1000,
  RD_STATION:       15 * 60 * 1000,
  PIPEDRIVE:        15 * 60 * 1000,
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

  console.log('[sync] Scheduler started for:', Object.keys(SYNC_INTERVALS_MS).join(', '));
}

export function stopSyncScheduler(): void {
  for (const [platform, timer] of timers) {
    clearInterval(timer);
    timers.delete(platform);
  }
}

export async function triggerSync(platform: Platform): Promise<SyncResult> {
  try {
    if (!ACTIVE_SYNC_PLATFORMS.includes(platform as ActiveSyncPlatform)) {
      throw new Error(`Sync nao suportado para ${platform}`);
    }
    const activePlatform = platform as ActiveSyncPlatform;
    const result = await SYNC_FNS[activePlatform]();
    await PlatformConnectionService.recordSyncSuccess(activePlatform);
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await PlatformConnectionService.markError(platform, msg);
    throw err;
  }
}
