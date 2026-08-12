import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  ShieldOff,
  UserX,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

interface EmailSuppressionItem {
  id: string;
  email: string;
  reason: string;
  scope: string;
  source: string | null;
  unsubscribedAt: string;
  leadId: string | null;
  leadName: string | null;
  company: string | null;
}

interface EmailSuppressionResult {
  items: EmailSuppressionItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: {
    total: number;
    unsubscribe: number;
    complaint: number;
    last30Days: number;
  };
  sources: Array<{ value: string; count: number }>;
  scopes: Array<{ value: string; label: string; count: number }>;
}

const EMPTY_RESULT: EmailSuppressionResult = {
  items: [],
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  summary: { total: 0, unsubscribe: 0, complaint: 0, last30Days: 0 },
  sources: [], scopes: [],
};

const SOURCE_LABELS: Record<string, string> = {
  'confirmation-page': 'Página de confirmação',
  'one-click-header': 'Descadastro pelo provedor',
  'resend-webhook': 'Webhook do Resend',
  unknown: 'Origem não informada',
};

const sourceLabel = (source: string | null) => SOURCE_LABELS[source ?? 'unknown'] ?? source ?? 'Origem não informada';
const reasonLabel = (reason: string) => reason === 'complaint' ? 'Denúncia de spam' : reason === 'unsubscribe' ? 'Desinscrição' : reason;
const scopeLabel = (scope: string) => scope === 'newsletter' ? 'Newsletter' : scope === 'marketing' ? 'Marketing e nutrição' : scope === 'all' ? 'Todos os e-mails' : scope;
const formatDate = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const EmailSuppressionsView: React.FC = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState<EmailSuppressionResult>(EMPTY_RESULT);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [source, setSource] = useState('all');
  const [scope, setScope] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => setPage(1), [debouncedSearch, source, scope]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (source !== 'all') params.set('source', source);
      if (scope !== 'all') params.set('scope', scope);
      const data = await apiClient.get<EmailSuppressionResult>(`/emails/suppressions?${params.toString()}`);
      setResult(data);
    } catch {
      setError('Não foi possível carregar os descadastros.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, source, scope]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (source !== 'all') params.set('source', source);
      if (scope !== 'all') params.set('scope', scope);
      const query = params.toString();
      const data = await apiClient.get<{ filename: string; count: number; csv: string }>(`/emails/suppressions/export${query ? `?${query}` : ''}`);
      const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = data.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Não foi possível exportar os descadastros.');
    } finally {
      setExporting(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    padding: '16px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  };

  return (
    <div style={{ padding: '28px 32px 64px', maxWidth: 1480, margin: '0 auto' }} className="animate-fade-in-up">
      <button
        type="button"
        onClick={() => navigate('/emails')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', padding: 0, marginBottom: 18, color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 13 }}
      >
        <ArrowLeft size={14} /> Voltar para E-mails
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--fg-primary)' }}>Descadastros de e-mail</h1>
          <p style={{ margin: '5px 0 0', fontSize: 14, color: 'var(--fg-muted)' }}>
            Preferências aplicadas automaticamente conforme a categoria de cada disparo ou fluxo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void exportCsv()}
          disabled={exporting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 15px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg-primary)', fontSize: 13, fontWeight: 700, cursor: exporting ? 'wait' : 'pointer', opacity: exporting ? .65 : 1 }}
        >
          {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
          Exportar CSV
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.09)', color: 'var(--red-500)', fontSize: 13, marginBottom: 16 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: 18 }}>
        <div className="ds-card" style={cardStyle}>
          <ShieldOff size={18} style={{ color: 'var(--accent)' }} />
          <div><div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Total bloqueado</div><strong style={{ fontSize: 21 }}>{result.summary.total.toLocaleString('pt-BR')}</strong></div>
        </div>
        <div className="ds-card" style={cardStyle}>
          <UserX size={18} style={{ color: 'var(--yellow-600)' }} />
          <div><div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Desinscrições</div><strong style={{ fontSize: 21 }}>{result.summary.unsubscribe.toLocaleString('pt-BR')}</strong></div>
        </div>
        <div className="ds-card" style={cardStyle}>
          <AlertCircle size={18} style={{ color: 'var(--red-500)' }} />
          <div><div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Denúncias de spam</div><strong style={{ fontSize: 21 }}>{result.summary.complaint.toLocaleString('pt-BR')}</strong></div>
        </div>
        <div className="ds-card" style={cardStyle}>
          <RefreshCw size={18} style={{ color: 'var(--green-600)' }} />
          <div><div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Últimos 30 dias</div><strong style={{ fontSize: 21 }}>{result.summary.last30Days.toLocaleString('pt-BR')}</strong></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ position: 'relative', width: 330, maxWidth: '100%' }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar por nome, e-mail ou empresa..."
            className="ds-input"
            style={{ width: '100%', height: 38, paddingLeft: 33 }}
          />
        </div>
        <select
          value={scope}
          onChange={event => setScope(event.target.value)}
          aria-label="Filtrar por categoria"
          className="ds-input"
          style={{ width: 210, height: 38 }}
        >
          <option value="all">Todas as categorias</option>
          {result.scopes.map(item => <option key={item.value} value={item.value}>{item.label} ({item.count})</option>)}
        </select>
        <select
          value={source}
          onChange={event => setSource(event.target.value)}
          aria-label="Filtrar por origem"
          className="ds-input"
          style={{ width: 230, height: 38 }}
        >
          <option value="all">Todas as origens</option>
          {result.sources.map(item => <option key={item.value} value={item.value}>{sourceLabel(item.value)} ({item.count})</option>)}
        </select>
        <button type="button" onClick={() => void load()} disabled={loading} title="Atualizar" aria-label="Atualizar descadastros" style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg-muted)', cursor: loading ? 'wait' : 'pointer' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1040 }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
                {['Nome do lead', 'E-mail', 'Empresa', 'Categoria', 'Data da desinscrição', 'Origem', 'Motivo'].map(label => (
                  <th key={label} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10.5, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 44, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}><RefreshCw size={17} className="animate-spin" style={{ display: 'inline', marginRight: 7 }} />Carregando descadastros...</td></tr>
              ) : result.items.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 54, textAlign: 'center', color: 'var(--fg-muted)' }}><ShieldOff size={28} style={{ opacity: .35, margin: '0 auto 10px' }} /><strong style={{ display: 'block', color: 'var(--fg-primary)', marginBottom: 4 }}>Nenhum descadastro encontrado</strong><span style={{ fontSize: 13 }}>Quando alguém confirmar a desinscrição, aparecerá aqui.</span></td></tr>
              ) : result.items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '13px 16px', fontSize: 13 }}>
                    {item.leadId ? <button type="button" onClick={() => navigate(`/leads/${item.leadId}`)} style={{ padding: 0, border: 'none', background: 'none', color: 'var(--accent)', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>{item.leadName || 'Abrir lead'}</button> : <span style={{ color: 'var(--fg-muted)' }}>{item.leadName || 'Não encontrado na base'}</span>}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-primary)', fontWeight: 600 }}>{item.email}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-muted)' }}>{item.company || '—'}</td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--fg-muted)' }}>{scopeLabel(item.scope)}</td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>{formatDate(item.unsubscribedAt)}</td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: 'var(--fg-muted)' }}>{sourceLabel(item.source)}</td>
                  <td style={{ padding: '13px 16px', fontSize: 12 }}><span style={{ padding: '3px 8px', borderRadius: 999, background: item.reason === 'complaint' ? 'rgba(239,68,68,.09)' : 'var(--accent-soft)', color: item.reason === 'complaint' ? 'var(--red-500)' : 'var(--accent)', fontWeight: 700 }}>{reasonLabel(item.reason)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && result.total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--fg-muted)' }}>
            <span>{result.total.toLocaleString('pt-BR')} {result.total === 1 ? 'registro' : 'registros'} encontrado{result.total === 1 ? '' : 's'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={() => setPage(previous => Math.max(1, previous - 1))} disabled={page <= 1} aria-label="Página anterior" style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg-muted)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? .45 : 1 }}><ChevronLeft size={14} /></button>
              <span>Página {result.page} de {result.totalPages}</span>
              <button type="button" onClick={() => setPage(previous => Math.min(result.totalPages, previous + 1))} disabled={page >= result.totalPages} aria-label="Próxima página" style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg-muted)', cursor: page >= result.totalPages ? 'not-allowed' : 'pointer', opacity: page >= result.totalPages ? .45 : 1 }}><ChevronRight size={14} /></button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 9, background: 'var(--bg-muted)', color: 'var(--fg-muted)', fontSize: 12.5, lineHeight: 1.5 }}>
        A preferência fica separada do cadastro do lead. Mesmo que ele seja excluído e importado novamente, o descadastro da categoria continuará ativo.
      </div>
    </div>
  );
};

export default EmailSuppressionsView;
