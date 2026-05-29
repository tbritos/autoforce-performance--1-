import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  BarChart3,
  Mail,
  RefreshCw,
  Plug,
  PlugZap,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Eye,
  Wifi,
} from 'lucide-react';
import { PlatformConnection, ConnectionStatus, ConnectionRequirement } from '../types';
import { DataService } from '../services/dataService';

// ─── Platform metadata ───────────────────────────────────────────────────────

interface PlatformMeta {
  id: string;
  label: string;
  description: string;
  Icon: React.ElementType;
  accentColor: string;
  accentBg: string;
  disabled?: boolean;
}

const PLATFORMS: PlatformMeta[] = [
  { id: 'META_ADS',         label: 'Meta Ads',           description: 'Facebook e Instagram Ads',             Icon: Megaphone, accentColor: '#60a5fa', accentBg: 'rgba(96,165,250,0.12)' },
  { id: 'GOOGLE_ADS',       label: 'Google Ads',         description: 'Campanhas de pesquisa e display',      Icon: Megaphone, accentColor: '#facc15', accentBg: 'rgba(250,204,21,0.12)' },
  { id: 'GOOGLE_ANALYTICS', label: 'Google Analytics',   description: 'GA4 — Landing pages e comportamento',  Icon: BarChart3, accentColor: '#fb923c', accentBg: 'rgba(251,146,60,0.12)' },
  { id: 'RD_STATION',       label: 'RD Station',         description: 'CRM, e-mails e automações',            Icon: Mail,      accentColor: '#a78bfa', accentBg: 'rgba(167,139,250,0.12)' },
  { id: 'PIPEDRIVE',        label: 'Pipedrive',          description: 'CRM — Negócios, contatos e pipeline',  Icon: PlugZap,   accentColor: '#34d399', accentBg: 'rgba(52,211,153,0.12)' },
  { id: 'CLARITY',          label: 'Microsoft Clarity',  description: 'Heatmaps, rage clicks e comportamento', Icon: Eye,      accentColor: '#38bdf8', accentBg: 'rgba(56,189,248,0.12)', disabled: true },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return 'Nunca';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'Agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

// ─── Disabled Platform Card ───────────────────────────────────────────────────

const DisabledCard: React.FC<{ meta: PlatformMeta }> = ({ meta }) => {
  const { Icon, accentColor, accentBg } = meta;
  return (
    <div className="ds-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, opacity: 0.55, borderColor: 'var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, filter: 'grayscale(0.4)' }}>
            <Icon size={18} style={{ color: accentColor }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)', margin: 0, lineHeight: 1.3 }}>{meta.label}</p>
            <p style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2, marginBottom: 0 }}>{meta.description}</p>
          </div>
        </div>
        <span className="ds-badge" style={{ fontSize: 10, padding: '2px 8px', height: 'auto' }}>Desativado</span>
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

function isExpiringSoon(iso: string): boolean {
  const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  return days <= 14;
}

function hasConnectionData(connection: PlatformConnection | undefined): boolean {
  return Boolean(
    connection?.accountId ||
    connection?.accountName ||
    connection?.lastSyncAt ||
    connection?.tokenExpiry ||
    connection?.metadata
  );
}

const StatusBadge: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
  const map: Record<ConnectionStatus, { label: string; badgeClass: string; dotColor: string }> = {
    CONNECTED:    { label: 'Conectado',    badgeClass: 'success', dotColor: 'var(--green-500)' },
    DISCONNECTED: { label: 'Desconectado', badgeClass: '',        dotColor: 'var(--fg-subtle)' },
    ERROR:        { label: 'Erro',         badgeClass: 'danger',  dotColor: 'var(--red-500)' },
    EXPIRED:      { label: 'Expirado',     badgeClass: 'danger',  dotColor: 'var(--yellow-500)' },
  };
  const { label, badgeClass, dotColor } = map[status];
  return (
    <span className={`ds-badge ${badgeClass}`}>
      <span className="dot" style={{ background: dotColor }} />
      {label}
    </span>
  );
};

// ─── Platform Card ────────────────────────────────────────────────────────────

interface CardProps {
  meta: PlatformMeta;
  connection: PlatformConnection | undefined;
  requirement: ConnectionRequirement | undefined;
  onConnect: (platform: string) => Promise<void>;
  onDisconnect: (platform: string) => Promise<void>;
  onSync: (platform: string) => Promise<void>;
  onTest: (platform: string) => Promise<{ ok: boolean; message: string }>;
}

const PlatformCard: React.FC<CardProps> = ({ meta, connection, requirement, onConnect, onDisconnect, onSync, onTest }) => {
  const [loadingAction, setLoadingAction] = useState<'connect' | 'disconnect' | 'sync' | 'test' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const status: ConnectionStatus = connection?.status ?? 'DISCONNECTED';
  const hasSavedConnection = hasConnectionData(connection);
  const canManageConnection = status === 'CONNECTED' || (status === 'ERROR' && hasSavedConnection);
  const { Icon, accentColor, accentBg } = meta;
  const missingEnv = requirement?.missingEnv || [];
  const canOAuthConnect = requirement?.readyForOAuth ?? true;

  const run = async (action: 'connect' | 'disconnect' | 'sync' | 'test', fn: () => Promise<void>) => {
    setLoadingAction(action);
    setFeedback(null);
    try {
      await fn();
      if (action === 'sync') setFeedback({ type: 'ok', msg: 'Sync concluído!' });
      if (action === 'disconnect') setFeedback({ type: 'ok', msg: 'Desconectado.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado';
      setFeedback({ type: 'err', msg });
    } finally {
      setLoadingAction(null);
    }
  };

  const borderColor = status === 'CONNECTED' ? `${accentColor}40` : status === 'ERROR' ? 'rgba(239,68,68,0.3)' : 'var(--border)';

  return (
    <div className="ds-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, borderColor, transition: 'all .2s' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={18} style={{ color: accentColor }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-primary)', margin: 0, lineHeight: 1.3 }}>{meta.label}</p>
            <p style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2, marginBottom: 0 }}>{meta.description}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Account info */}
      {connection?.accountName && (
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--fg-subtle)' }}>Conta:</span> {connection.accountName}
          </p>
          {connection.lastSyncAt && (
            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} />
              Último sync: {relativeTime(connection.lastSyncAt)}
              {connection.syncCount > 0 && <span style={{ color: 'var(--fg-subtle)', marginLeft: 4 }}>({connection.syncCount}x)</span>}
            </p>
          )}
          {connection.tokenExpiry && (
            <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 4, color: isExpiringSoon(connection.tokenExpiry) ? 'var(--yellow-700)' : 'var(--fg-muted)' }}>
              <Clock size={10} />
              Token expira em: {formatDate(connection.tokenExpiry)}
            </p>
          )}
        </div>
      )}

      {/* Error message */}
      {status !== 'CONNECTED' && !canOAuthConnect && (
        <p style={{ fontSize: 11, color: 'var(--yellow-700)', background: 'var(--yellow-50)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 'var(--r-md)', padding: '7px 10px', margin: 0, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
          Configure no .env: {missingEnv.join(', ')}
        </p>
      )}
      {status === 'ERROR' && connection?.lastSyncError && canOAuthConnect && (
        <p style={{ fontSize: 11, color: 'var(--red-600)', background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 'var(--r-md)', padding: '7px 10px', margin: 0, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <AlertCircle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
          {connection.lastSyncError}
        </p>
      )}

      {/* Feedback */}
      {feedback && (
        <p style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 'var(--r-md)', padding: '7px 10px', margin: 0, color: feedback.type === 'ok' ? 'var(--green-700)' : 'var(--red-700)', background: feedback.type === 'ok' ? 'var(--green-50)' : 'var(--red-50)', border: `1px solid ${feedback.type === 'ok' ? 'var(--green-100)' : 'var(--red-100)'}` }}>
          {feedback.type === 'ok' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
          {feedback.msg}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
        {canManageConnection ? (
          <>
            <button
              type="button"
              disabled={loadingAction !== null}
              onClick={() => run('test', () => onTest(meta.id).then(r => { setFeedback({ type: r.ok ? 'ok' : 'err', msg: r.message }); }))}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 600, background: 'var(--bg-subtle)', color: 'var(--fg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', opacity: loadingAction !== null ? 0.4 : 1, transition: 'all .15s' }}
            >
              {loadingAction === 'test' ? <Loader2 size={11} className="animate-spin" /> : <Wifi size={11} />}
              Testar
            </button>
            <button
              type="button"
              disabled={loadingAction !== null}
              onClick={() => run('sync', () => onSync(meta.id))}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 600, background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border)', cursor: 'pointer', opacity: loadingAction !== null ? 0.4 : 1, transition: 'all .15s' }}
            >
              {loadingAction === 'sync' ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              Sincronizar
            </button>
            <button
              type="button"
              disabled={loadingAction !== null}
              onClick={() => run('disconnect', () => onDisconnect(meta.id))}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 600, background: 'var(--red-50)', color: 'var(--red-700)', border: '1px solid var(--red-100)', cursor: 'pointer', opacity: loadingAction !== null ? 0.4 : 1, transition: 'all .15s' }}
            >
              {loadingAction === 'disconnect' ? <Loader2 size={11} className="animate-spin" /> : <Plug size={11} />}
              Desconectar
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={loadingAction !== null || !canOAuthConnect}
            onClick={() => run('connect', () => onConnect(meta.id))}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 'var(--r-md)', fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', cursor: canOAuthConnect ? 'pointer' : 'not-allowed', opacity: loadingAction !== null || !canOAuthConnect ? 0.4 : 1, transition: 'all .15s' }}
          >
            {loadingAction === 'connect' ? <Loader2 size={11} className="animate-spin" /> : <PlugZap size={11} />}
            Conectar
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

const ConnectionsView: React.FC = () => {
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [requirements, setRequirements] = useState<ConnectionRequirement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const [data, requirementData] = await Promise.all([
        DataService.listConnections(),
        DataService.listConnectionRequirements(),
      ]);
      setConnections(Array.isArray(data) ? data : []);
      setRequirements(Array.isArray(requirementData) ? requirementData : []);
    } catch (err) {
      console.error('Erro ao carregar conexões:', err);
      setConnections([]);
      setRequirements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'oauth_success' || event.data?.type === 'oauth_error') {
        loadConnections();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadConnections]);

  const handleConnect = useCallback(async (platform: string) => {
    const { url } = await DataService.getConnectionAuthUrl(platform);
    const w = 620, h = 720;
    const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
    window.open(url, 'oauth_popup', `width=${w},height=${h},left=${left},top=${top},resizable=yes`);
  }, []);

  const handleDisconnect = useCallback(async (platform: string) => {
    await DataService.disconnectPlatform(platform);
    await loadConnections();
  }, [loadConnections]);

  const handleSync = useCallback(async (platform: string) => {
    await DataService.triggerPlatformSync(platform);
    await loadConnections();
  }, [loadConnections]);

  const handleTest = useCallback(async (platform: string) => {
    const result = await DataService.testPlatformConnection(platform);
    await loadConnections(); // refresh status badge from DB after test
    return result;
  }, [loadConnections]);

  const connectionMap = new Map(connections.map(c => [c.platform, c]));
  const requirementMap = new Map(requirements.map(item => [item.platform, item]));


  const connectedCount = connections.filter(c => c.status === 'CONNECTED' || (c.status === 'ERROR' && hasConnectionData(c))).length;

  return (
    <div style={{ padding: '24px 28px 64px', maxWidth: 1480, margin: '0 auto' }} className="space-y-8 animate-fade-in-up">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>Integrações</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4, marginBottom: 0 }}>Conecte suas plataformas para sincronizar dados automaticamente.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="ds-badge" style={{ padding: '4px 12px', height: 'auto', fontSize: 12 }}>
            {connectedCount}/{PLATFORMS.length} conectadas
          </span>
          <button type="button" onClick={loadConnections} disabled={loading}
            style={{ padding: 8, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'transparent', cursor: 'pointer', opacity: loading ? 0.4 : 1 }}
            aria-label="Recarregar">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {PLATFORMS.map(meta => (
          loading
            ? <div key={meta.id} className="ds-card animate-pulse" style={{ height: 144 }} />
            : meta.disabled
              ? <DisabledCard key={meta.id} meta={meta} />
              : <PlatformCard
                  key={meta.id}
                  meta={meta}
                  connection={connectionMap.get(meta.id)}
                  requirement={requirementMap.get(meta.id)}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  onSync={handleSync}
                  onTest={handleTest}
                />
        ))}
      </div>
    </div>
  );
};

export default ConnectionsView;
