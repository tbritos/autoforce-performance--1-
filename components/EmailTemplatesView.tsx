import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Mail, Trash2, Edit3, RefreshCw,
  AlertCircle, X, LayoutGrid, List,
  Clock, Zap, Copy, ChevronRight,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

type EmailStatus = 'draft' | 'sent' | 'scheduled' | 'automatic';

interface TemplateStats {
  sent: number; delivered: number; opened: number;
  clicked: number; bounced: number; openRate: number; clickRate: number;
}

interface EmailTemplate {
  id: string; name: string; subject: string; body: string;
  design: unknown | null; fromName: string | null; fromEmail: string | null;
  status: EmailStatus; scheduledAt: string | null;
  audienceType: string | null; audienceValue: string | null; audienceCount: number | null;
  isActive: boolean; createdAt: string; updatedAt: string;
  stats: TemplateStats;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<EmailStatus, { label: string; color: string; dot: string }> = {
  sent:      { label: 'Enviado',    color: '#059669', dot: '#10b981' },
  scheduled: { label: 'Agendado',  color: '#d97706', dot: '#f59e0b' },
  automatic: { label: 'Automático',color: '#2563eb', dot: '#3b82f6' },
  draft:     { label: 'Rascunho',  color: '#6b7280', dot: '#9ca3af' },
};

const audienceLabel = (t: EmailTemplate) => {
  if (t.audienceType === 'trigger')  return 'Gatilho';
  if (t.audienceType === 'sequence') return 'Sequência';
  if (t.audienceCount) return `${t.audienceCount.toLocaleString('pt-BR')} leads`;
  return '—';
};
const audienceSub = (t: EmailTemplate) => t.audienceValue ?? (t.audienceType === 'all' ? 'Toda a base' : '');

const ProgressBar = ({ value, color }: { value: number; color: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <div style={{ flex: 1, height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: color, borderRadius: 3 }}/>
    </div>
    <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 34, textAlign: 'right' }}>{value}%</span>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

const EmailTemplatesView: React.FC = () => {
  const navigate = useNavigate();
  const [emails, setEmails]             = useState<EmailTemplate[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode]         = useState<'list' | 'grid'>('list');
  const [error, setError]               = useState<string | null>(null);

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<EmailTemplate[]>('/email-templates');
      setEmails(data);
    } catch {
      setError('Erro ao carregar e-mails');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmails(); }, [loadEmails]);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Excluir "${name}"?`)) return;
    try {
      await apiClient.delete(`/email-templates/${id}`);
      await loadEmails();
    } catch { setError('Erro ao excluir'); }
  };

  const handleDuplicate = async (t: EmailTemplate) => {
    try {
      await apiClient.post('/email-templates', {
        name: `${t.name} (cópia)`, subject: t.subject, body: t.body, design: t.design,
        fromName: t.fromName, fromEmail: t.fromEmail, status: 'draft',
      });
      await loadEmails();
    } catch { setError('Erro ao duplicar'); }
  };

  // ── Filters ──
  const counts = {
    all: emails.length,
    sent: emails.filter(e => e.status === 'sent').length,
    scheduled: emails.filter(e => e.status === 'scheduled').length,
    automatic: emails.filter(e => e.status === 'automatic').length,
    draft: emails.filter(e => e.status === 'draft').length,
  };

  const filtered = emails.filter(e => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.subject.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── List / Grid view ──
  return (
    <div style={{ padding: '28px 32px' }}>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
          <AlertCircle size={14}/>{error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><X size={14}/></button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>E-mails</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--fg-muted)' }}>Crie, dispare e acompanhe os e-mails enviados aos seus leads.</p>
        </div>
        <button onClick={() => navigate('/emails/new')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(69,108,236,0.3)' }}>
          <Plus size={15}/> Novo e-mail
        </button>
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 280px' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou assunto..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg)', fontSize: 13, outline: 'none' }}/>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { key: 'all', label: 'Todos', count: counts.all },
            { key: 'sent', label: 'Enviados', count: counts.sent },
            { key: 'scheduled', label: 'Agendados', count: counts.scheduled },
            { key: 'automatic', label: 'Automáticos', count: counts.automatic },
            { key: 'draft', label: 'Rascunhos', count: counts.draft },
          ] as { key: string; label: string; count: number }[]).map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, border: `1px solid ${filterStatus === f.key ? 'var(--accent)' : 'var(--border)'}`, background: filterStatus === f.key ? 'var(--accent-soft)' : 'var(--bg-card)', color: filterStatus === f.key ? 'var(--accent)' : 'var(--fg-secondary)', fontSize: 13, fontWeight: filterStatus === f.key ? 700 : 400, cursor: 'pointer' }}>
              {f.label}
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 5px', borderRadius: 10, background: filterStatus === f.key ? 'var(--accent)' : 'var(--bg-muted)', color: filterStatus === f.key ? '#fff' : 'var(--fg-muted)' }}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button onClick={() => setViewMode('list')} style={{ padding: '6px 8px', borderRadius: 7, border: `1px solid ${viewMode === 'list' ? 'var(--accent)' : 'var(--border)'}`, background: viewMode === 'list' ? 'var(--accent-soft)' : 'transparent', color: viewMode === 'list' ? 'var(--accent)' : 'var(--fg-muted)', cursor: 'pointer' }}>
            <List size={14}/>
          </button>
          <button onClick={() => setViewMode('grid')} style={{ padding: '6px 8px', borderRadius: 7, border: `1px solid ${viewMode === 'grid' ? 'var(--accent)' : 'var(--border)'}`, background: viewMode === 'grid' ? 'var(--accent-soft)' : 'transparent', color: viewMode === 'grid' ? 'var(--accent)' : 'var(--fg-muted)', cursor: 'pointer' }}>
            <LayoutGrid size={14}/>
          </button>
        </div>
      </div>

      {/* LIST */}
      {viewMode === 'list' && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 180px 200px 100px', padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
            {['E-MAIL', 'STATUS', 'PÚBLICO', 'DESEMPENHO', 'AÇÕES'].map((h, i) => (
              <div key={h} style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-muted)', letterSpacing: '.05em', textAlign: i === 4 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }}/>
              Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 56, textAlign: 'center', color: 'var(--fg-muted)' }}>
              <Mail size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }}/>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Nenhum e-mail encontrado</div>
              <div style={{ fontSize: 13 }}>Crie seu primeiro e-mail clicando em "Novo e-mail"</div>
            </div>
          ) : filtered.map((email, idx) => {
            const s = STATUS_CFG[email.status];
            return (
              <div key={email.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 140px 180px 200px 100px', padding: '14px 20px', borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => navigate(`/emails/${email.id}`)}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {email.name}<ChevronRight size={12} style={{ color: 'var(--fg-muted)', flexShrink: 0 }}/>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email.subject || <em style={{ opacity: 0.6 }}>(sem assunto)</em>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0 }}/>
                  <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.label}</span>
                </div>

                <div onClick={e => e.stopPropagation()}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {email.audienceType === 'trigger' ? <><Zap size={12} style={{ verticalAlign: 'middle', color: '#3b82f6' }}/> Gatilho</> :
                     email.audienceType === 'sequence' ? <><Clock size={12} style={{ verticalAlign: 'middle', color: '#8b5cf6' }}/> Sequência</> :
                     email.audienceCount ? `${email.audienceCount.toLocaleString('pt-BR')} leads` : '—'}
                  </div>
                </div>

                <div onClick={e => e.stopPropagation()}>
                  {email.stats.sent > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--fg-muted)', width: 50 }}>Abertura</span>
                        <ProgressBar value={email.stats.openRate} color="#10b981"/>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--fg-muted)', width: 50 }}>Clique</span>
                        <ProgressBar value={email.stats.clickRate} color="#3b82f6"/>
                      </div>
                    </div>
                  ) : <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>não enviado</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => navigate(`/emails/${email.id}/edit`)} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg-muted)' }} title="Editar"><Edit3 size={13}/></button>
                  <button onClick={() => handleDuplicate(email)} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg-muted)' }} title="Duplicar"><Copy size={13}/></button>
                  <button onClick={() => handleDelete(email.id, email.name)} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }} title="Excluir"><Trash2 size={13}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GRID */}
      {viewMode === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(email => {
            const s = STATUS_CFG[email.status];
            return (
              <div key={email.id} onClick={() => navigate(`/emails/${email.id}`)}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: s.color }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot }}/>{s.label}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => navigate(`/emails/${email.id}/edit`)} style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg-muted)' }}><Edit3 size={12}/></button>
                    <button onClick={() => handleDelete(email.id, email.name)} style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12}/></button>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{email.name}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject}</div>
                {email.stats.sent > 0 && (
                  <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>↗ {email.stats.openRate}% abertura</span>
                    <span style={{ color: '#3b82f6', fontWeight: 700 }}>↗ {email.stats.clickRate}% clique</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--fg-muted)' }}>
          Mostrando {filtered.length} de {emails.length} e-mails
        </div>
      )}
    </div>
  );
};

export default EmailTemplatesView;
