import { PlatformConnectionService } from './platform-connection.service';

const CLARITY_API = 'https://clarity.microsoft.com/api/projects';

export interface ClarityProjectMetrics {
  totalSessions:     number;
  totalSessionTime:  number;
  pagesPerSession:   number;
  rageClicks:        number;
  deadClicks:        number;
  errorClicks:       number;
  quickBackClicks:   number;
  javaScriptErrors:  number;
  scrolledPercentage: number;
}

async function getCredentials(): Promise<{ projectId: string; apiKey: string }> {
  // Env vars take priority — always connected without manual UI config
  const envProjectId = process.env.CLARITY_PROJECT_ID?.trim();
  const envApiKey    = process.env.CLARITY_API_KEY?.trim();
  if (envProjectId && envApiKey) {
    return { projectId: envProjectId, apiKey: envApiKey };
  }

  // Fallback: credentials saved via UI
  const conn   = await PlatformConnectionService.getInternalConnection('CLARITY' as any);
  const meta   = (conn?.metadata ?? {}) as Record<string, unknown>;
  const projectId = typeof meta.projectId === 'string' ? meta.projectId.trim() : '';
  const tokens = await PlatformConnectionService.getTokens('CLARITY' as any);
  const apiKey = tokens?.accessToken ?? '';

  if (!projectId || !apiKey) {
    throw new Error('Clarity não configurado. Adicione CLARITY_PROJECT_ID e CLARITY_API_KEY no .env ou configure em Integrações.');
  }
  return { projectId, apiKey };
}

export async function testClarityConnection(): Promise<boolean> {
  const { projectId, apiKey } = await getCredentials();
  const res = await fetch(`${CLARITY_API}/${projectId}/metrics`, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
  return res.ok;
}

export async function getClarityMetrics(
  startDate?: string,
  endDate?: string,
): Promise<ClarityProjectMetrics> {
  const { projectId, apiKey } = await getCredentials();

  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate)   params.set('endDate',   endDate);
  const qs = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${CLARITY_API}/${projectId}/metrics${qs}`, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Clarity API ${res.status}: ${text}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();

  // Normalize response — field names may vary across Clarity API versions
  return {
    totalSessions:      data.totalSessions      ?? data.sessions      ?? 0,
    totalSessionTime:   data.totalSessionTime   ?? data.totalTime     ?? 0,
    pagesPerSession:    data.pagesPerSession     ?? data.pageViews     ?? 0,
    rageClicks:         data.rageClicks         ?? 0,
    deadClicks:         data.deadClicks         ?? 0,
    errorClicks:        data.errorClicks        ?? 0,
    quickBackClicks:    data.quickBackClicks     ?? 0,
    javaScriptErrors:   data.javaScriptErrors    ?? data.jsErrors      ?? 0,
    scrolledPercentage: data.scrolledPercentage  ?? data.scrollDepth   ?? 0,
  };
}
