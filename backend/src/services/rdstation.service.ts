type RdTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

type RdEmailRow = Record<string, any>;
type RdWorkflowEmailRow = Record<string, any>;

const RD_API_BASE = 'https://api.rd.services/platform';

export const getRdAccessToken = async (): Promise<string> => {
  const token = process.env.RD_STATION_ACCESS_TOKEN;
  if (token) return token;

  const clientId = process.env.RD_STATION_CLIENT_ID;
  const clientSecret = process.env.RD_STATION_CLIENT_SECRET;
  const refreshToken = process.env.RD_STATION_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('RD Station credentials not configured');
  }

  const response = await fetch('https://api.rd.services/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RD token error: ${text}`);
  }

  const data = (await response.json()) as RdTokenResponse;
  if (!data.access_token) {
    throw new Error('RD token response missing access_token');
  }

  return data.access_token;
};

const extractMetric = (row: RdEmailRow, keys: string[]): number => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) {
      const num = Number(value);
      return Number.isNaN(num) ? 0 : num;
    }
  }
  return 0;
};

const extractDate = (row: RdEmailRow, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.length > 0) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  return new Date().toISOString().split('T')[0];
};

const normalizeDate = (value?: string, fallback?: string): string => {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  return fallback || new Date().toISOString().split('T')[0];
};

const extractName = (row: RdEmailRow): string => {
  return (
    row.name ||
    row.title ||
    row.subject ||
    row.email_name ||
    `Email ${row.id || ''}`.trim()
  );
};

const fetchRdEmailsWindow = async (
  accessToken: string,
  workspaceId: string | undefined,
  startParam: string,
  endParam: string,
  pageSize: number
) => {
  const allRows: RdEmailRow[] = [];
  const maxPages = 10;

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(`${RD_API_BASE}/analytics/emails`);
    url.searchParams.set('start_date', startParam);
    url.searchParams.set('end_date', endParam);
    url.searchParams.set('page', String(page));
    url.searchParams.set('page_size', String(pageSize));
    if (workspaceId) {
      url.searchParams.set('workspace_id', workspaceId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(workspaceId ? { 'X-RD-Station-Workspace-Id': workspaceId } : {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`RD emails error: ${text}`);
    }

    const data = (await response.json()) as any;
    const rows: RdEmailRow[] = Array.isArray(data) ? data : data.emails || data.items || data.results || [];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }
  }

  return allRows;
};

export const fetchRdEmails = async (
  startDate?: string,
  endDate?: string,
  pageSize = 200
) => {
  const accessToken = await getRdAccessToken();
  const workspaceId = process.env.RD_STATION_WORKSPACE_ID;
  const maxLookbackMs = 44 * 24 * 60 * 60 * 1000;
  const defaultEnd = new Date().toISOString().split('T')[0];
  const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const start = normalizeDate(startDate, defaultStart);
  const end = normalizeDate(endDate, defaultEnd);
  let startDateObj = new Date(start);
  let endDateObj = new Date(end);
  if (!Number.isNaN(endDateObj.getTime())) {
    const minStart = new Date(endDateObj.getTime() - maxLookbackMs);
    if (Number.isNaN(startDateObj.getTime()) || startDateObj < minStart) {
      startDateObj = minStart;
    }
    if (startDateObj > endDateObj) {
      startDateObj = new Date(endDateObj.getTime());
    }
  }
  const maxRangeMs = 40 * 24 * 60 * 60 * 1000;
  const allRows: RdEmailRow[] = [];

  if (!Number.isNaN(startDateObj.getTime()) && !Number.isNaN(endDateObj.getTime())) {
    let windowStart = new Date(startDateObj.getTime());
    while (windowStart.getTime() <= endDateObj.getTime()) {
      const windowEnd = new Date(Math.min(windowStart.getTime() + maxRangeMs, endDateObj.getTime()));
      const startParam = windowStart.toISOString().split('T')[0];
      const endParam = windowEnd.toISOString().split('T')[0];
      const rows = await fetchRdEmailsWindow(accessToken, workspaceId, startParam, endParam, pageSize);
      allRows.push(...rows);
      windowStart = new Date(windowEnd.getTime() + 24 * 60 * 60 * 1000);
    }
  } else {
    const rows = await fetchRdEmailsWindow(accessToken, workspaceId, start, end, pageSize);
    allRows.push(...rows);
  }

  return allRows.map((row) => ({
    id: String(row.campaign_id || row.id || row.uuid || row.email_id || row.unique_id || Math.random()),
    name: row.campaign_name || extractName(row),
    date: extractDate(row, ['send_at', 'created_at', 'sent_at', 'updated_at', 'scheduled_at']),
    sends: extractMetric(row, ['contacts_count', 'email_delivered_count', 'sends', 'deliveries', 'sent', 'emails_sent']),
    opens: extractMetric(row, ['email_opened_count', 'opens', 'unique_opens', 'opened']),
    clicks: extractMetric(row, ['email_clicked_count', 'clicks', 'unique_clicks']),
    conversions: extractMetric(row, ['conversions', 'leads', 'results']),
    bounce: extractMetric(row, ['email_bounced_count', 'email_dropped_count', 'bounce', 'bounces', 'hard_bounce', 'soft_bounce']),
  }));
};

export const fetchRdWorkflowEmails = async (
  startDate?: string,
  endDate?: string,
  pageSize = 200
) => {
  const accessToken = await getRdAccessToken();
  const workspaceId = process.env.RD_STATION_WORKSPACE_ID;
  const maxLookbackMs = 44 * 24 * 60 * 60 * 1000;
  const defaultEnd = new Date().toISOString().split('T')[0];
  const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const start = normalizeDate(startDate, defaultStart);
  const end = normalizeDate(endDate, defaultEnd);

  let startDateObj = new Date(start);
  const endDateObj = new Date(end);
  if (!Number.isNaN(endDateObj.getTime())) {
    const minStart = new Date(endDateObj.getTime() - maxLookbackMs);
    if (Number.isNaN(startDateObj.getTime()) || startDateObj < minStart) {
      startDateObj = minStart;
    }
    if (startDateObj > endDateObj) {
      startDateObj = new Date(endDateObj.getTime());
    }
  }
  const maxRangeMs = 40 * 24 * 60 * 60 * 1000;
  let startParam = start;
  let endParam = end;
  if (!Number.isNaN(startDateObj.getTime()) && !Number.isNaN(endDateObj.getTime())) {
    startParam = startDateObj.toISOString().split('T')[0];
    endParam = endDateObj.toISOString().split('T')[0];
    const diff = endDateObj.getTime() - startDateObj.getTime();
    if (diff > maxRangeMs) {
      const clamped = new Date(endDateObj.getTime() - maxRangeMs);
      startParam = clamped.toISOString().split('T')[0];
      endParam = end;
    }
  }

  const allRows: RdWorkflowEmailRow[] = [];
  const maxPages = 10;

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(`${RD_API_BASE}/analytics/workflow_emails`);
    url.searchParams.set('start_date', startParam);
    url.searchParams.set('end_date', endParam);
    url.searchParams.set('page', String(page));
    url.searchParams.set('page_size', String(pageSize));
    if (workspaceId) {
      url.searchParams.set('workspace_id', workspaceId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(workspaceId ? { 'X-RD-Station-Workspace-Id': workspaceId } : {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`RD workflow emails error: ${text}`);
    }

    const data = (await response.json()) as any;
    const rows: RdWorkflowEmailRow[] = Array.isArray(data)
      ? data
      : data.workflow_email_statistics || data.items || data.results || [];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }
  }

  return allRows.map((row) => ({
    id: String(row.workflow_action_id || row.workflow_id || row.id || Math.random()),
    workflowId: row.workflow_id || row.workflow_uuid,
    workflowName: row.workflow_name || row.workflow || 'Workflow',
    emailName: row.email_name || row.name || 'Email',
    delivered: extractMetric(row, ['email_delivered_count', 'delivered_count']),
    opened: extractMetric(row, ['email_opened_unique_count', 'opened_unique_count']),
    clicked: extractMetric(row, ['email_clicked_unique_count', 'clicked_unique_count']),
    bounced: extractMetric(row, ['email_bounced_unique_count', 'email_bounced_count']),
    unsubscribed: extractMetric(row, ['email_unsubscribed_count']),
    deliveredRate: extractMetric(row, ['email_delivered_rate']),
    openedRate: extractMetric(row, ['email_opened_rate']),
    clickedRate: extractMetric(row, ['email_clicked_rate']),
    spamRate: extractMetric(row, ['email_spam_reported_rate']),
    date: extractDate(row, ['workflow_updated_at', 'workflow_created_at', 'created_at']),
  }));
};
