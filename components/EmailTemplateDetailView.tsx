import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Edit3, Copy, Send, RefreshCw,
  CheckCircle, AlertCircle, Eye, Mail, MousePointerClick,
  TrendingUp, Package, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

type EmailStatus = 'draft' | 'sent' | 'scheduled' | 'automatic';
type SendStatus  = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';

interface TemplateStats {
  sent: number; delivered: number; opened: number;
  clicked: number; bounced: number;
  openRate: number; clickRate: number; bounceRate: number;
}

interface SendRecord {
  id: string;
  leadEmail: string;
  toEmail: string;
  status: SendStatus;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  sentAt: string;
}

interface EmailTemplate {
  id: string; name: string; subject: string; body: string;
  design: unknown | null; fromName: string | null; fromEmail: string | null;
  status: EmailStatus; scheduledAt: string | null;
  audienceType: string | null; audienceValue: string | null; audienceCount: number | null;
  isActive: boolean; createdAt: string; updatedAt: string;
  stats: TemplateStats;
  sends: SendRecord[];
}

const STATUS_CFG: Record<EmailStatus, { label: string; color: string; dot: string }> = {
  sent:      { label: 'Enviado',     color: '#059669', dot: '#10b981' },
  scheduled: { label: 'Agendado',   color: '#d97706', dot: '#f59e0b' },
  automatic: { label: 'Automático', color: '#2563eb', dot: '#3b82f6' },
  draft:     { label: 'Rascunho',   color: '#6b7280', dot: '#9ca3af' },
};

const SEND_STATUS_CFG: Record<SendStatus, { label: string; bg: string; color: string }> = {
  clicked:   { label: 'Clicado',    bg: '#d1fae5', color: '#059669' },
  opened:    { label: 'Aberto',     bg: '#dbeafe', color: '#2563eb' },
  delivered: { label: 'Entregue',   bg: '#f3f4f6', color: '#374151' },
  sent:      { label: 'Enviado',    bg: '#f3f4f6', color: '#6b7280' },
  bounced:   { label: 'Bounced',    bg: '#fee2e2', color: '#dc2626' },
  failed:    { label: 'Falhou',     bg: '#fee2e2', color: '#dc2626' },
};

const audienceLabel = (t: EmailTemplate) => {
  if (t.audienceType === 'trigger')  return 'Gatilho';
  if (t.audienceType === 'sequence') return 'Sequência';
  if (t.audienceCount) return `${t.audienceCount.toLocaleString('pt-BR')} leads`;
  return '—';
};
const audienceSub = (t: EmailTemplate) => t.audienceValue ?? (t.audienceType === 'all' ? 'Toda a base' : '');

const fmt = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  rate?: number | string;
  color: string;
  rateLabel?: string;
}> = ({ icon, label, value, rate, color, rateLabel }) => (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', top: 12, right: 14, opacity: 0.1, color }}>
      {icon}
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 4 }}>{label}</div>
    {rate !== undefined && (
      <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
        <TrendingUp size={11}/> {rate}% {rateLabel ?? 'taxa'}
      </div>
    )}
  </div>
);

const EmailTemplateDetailView: React.FC = () => {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();

  const [template, setTemplate]   = useState<EmailTemplate | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testDone, setTestDone]   = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSends, setShowSends]     = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiClient.get<EmailTemplate>(`/email-templates/${id}`);
      setTemplate(data);
    } catch {
      setError('Erro ao carregar template');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDuplicate = async () => {
    if (!template) return;
    try {
      await apiClient.post('/email-templates', {
        name: `${template.name} (cópia)`, subject: template.subject,
        body: template.body, design: template.design,
        fromName: template.fromName, fromEmail: template.fromEmail, status: 'draft',
      });
      navigate('/emails');
    } catch { setError('Erro ao duplicar'); }
  };

  const handleTest = async () => {
    if (!template || !testEmail.trim()) return;
    setTestSending(true); setTestDone(false); setTestError(null);
    try {
      await apiClient.post(`/email-templates/${template.id}/test`, { toEmail: testEmail.trim() });
      setTestDone(true);
      setTimeout(() => setTestDone(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar teste';
      setTestError(msg);
    } finally {
      setTestSending(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 10, color: 'var(--fg-muted)' }}>
        <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }}/> Carregando...
      </div>
    );
  }

  if (error || !template) {
    return (
      <div style={{ padding: '40px 32px' }}>
        <button onClick={() => navigate('/emails')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
          <ArrowLeft size={14}/> Voltar para E-mails
        </button>
        <div style={{ color: '#dc2626', fontSize: 14 }}>{error ?? 'Template não encontrado'}</div>
      </div>
    );
  }

  const s    = STATUS_CFG[template.status] ?? STATUS_CFG.draft;
  const st   = template.stats;
  const hasSends = template.sends && template.sends.length > 0;
  const deliveryRate = st.sent > 0 ? Number((st.delivered / st.sent * 100).toFixed(1)) : 0;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <button onClick={() => navigate('/emails')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
        <ArrowLeft size={14}/> Voltar para E-mails
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{template.name}</h2>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: `${s.dot}22`, color: s.color,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }}/>
              {s.label}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
            {template.subject}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => navigate(`/emails/${template.id}/edit`)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-secondary)', fontSize: 13, cursor: 'pointer' }}>
            <Edit3 size={13}/> Editar
          </button>
          <button onClick={handleDuplicate}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-secondary)', fontSize: 13, cursor: 'pointer' }}>
            <Copy size={13}/> Duplicar
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard icon={<Send size={32}/>}              label="Enviados"  value={st.sent}      color="#6366f1" />
        <StatCard icon={<Package size={32}/>}           label="Entregues" value={st.delivered} color="#0ea5e9" rate={deliveryRate}     rateLabel="entrega" />
        <StatCard icon={<Mail size={32}/>}              label="Abertos"   value={st.opened}    color="#10b981" rate={st.openRate}      rateLabel="abertura" />
        <StatCard icon={<MousePointerClick size={32}/>} label="Clicados"  value={st.clicked}   color="#f59e0b" rate={st.clickRate}     rateLabel="clique" />
        <StatCard icon={<X size={32}/>}                 label="Bounced"   value={st.bounced}   color="#ef4444" rate={st.bounceRate}    rateLabel="bounce" />
      </div>

      {/* Info card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Público</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{audienceLabel(template)}</div>
            {audienceSub(template) && <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{audienceSub(template)}</div>}
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remetente</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{template.fromName || 'AutoForce'}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{template.fromEmail || 'padrão'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Criado em</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(template.createdAt)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Atualizado</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(template.updatedAt)}</div>
          </div>
        </div>
      </div>

      {/* Sends history */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
        <button
          onClick={() => setShowSends(p => !p)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            Histórico de envios
            {hasSends && (
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--fg-muted)' }}>
                ({template.sends.length} registro{template.sends.length !== 1 ? 's' : ''})
              </span>
            )}
          </span>
          {showSends ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </button>

        {showSends && (
          hasSends ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                    {['Lead', 'Status', 'Enviado em', 'Aberto em', 'Clicado em'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {template.sends.map((send, i) => {
                    const sc = SEND_STATUS_CFG[send.status] ?? SEND_STATUS_CFG.sent;
                    return (
                      <tr key={send.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-base)' }}>
                        <td style={{ padding: '10px 16px', color: 'var(--fg-base)', fontWeight: 500 }}>
                          {send.leadEmail}
                          {send.toEmail !== send.leadEmail && (
                            <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{send.toEmail}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>
                            {sc.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', color: 'var(--fg-secondary)', whiteSpace: 'nowrap' }}>{fmt(send.sentAt)}</td>
                        <td style={{ padding: '10px 16px', color: send.openedAt ? '#10b981' : 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                          {send.openedAt ? fmt(send.openedAt) : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', color: send.clickedAt ? '#f59e0b' : 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                          {send.clickedAt ? fmt(send.clickedAt) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
              Nenhum envio registrado ainda.
            </div>
          )
        )}
      </div>

      {/* Preview */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setShowPreview(p => !p)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
          <Eye size={13}/> {showPreview ? 'Ocultar preview' : 'Ver preview do e-mail'}
        </button>
        {showPreview && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            <iframe
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;}</style></head><body>${template.body}</body></html>`}
              style={{ width: '100%', minHeight: 400, border: 'none', display: 'block' }}
              title="Preview"
            />
          </div>
        )}
      </div>

      {/* Test send */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Enviar e-mail de teste</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={testEmail} onChange={e => setTestEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTest()}
            placeholder="email@exemplo.com"
            style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--fg)', fontSize: 13, outline: 'none' }}/>
          <button onClick={handleTest} disabled={testSending || !testEmail.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 7, border: 'none', background: testDone ? '#10b981' : 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: testSending ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            {testDone
              ? <><CheckCircle size={13}/> Enviado!</>
              : testSending
                ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }}/> Enviando...</>
                : <><Send size={13}/> Enviar Teste</>
            }
          </button>
        </div>
        {testError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: '#dc2626' }}>
            <AlertCircle size={12}/>{testError}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailTemplateDetailView;
