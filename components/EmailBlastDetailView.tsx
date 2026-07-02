import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Send, Package, Mail, MousePointerClick, X,
  TrendingUp, ChevronDown, ChevronUp, Tag, Layers, Users,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

type BlastStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
type SendStatus  = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
type AudienceType = 'tag' | 'segment' | 'individual';

interface BlastStats {
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
  clickedUrl: string | null;
  bouncedAt: string | null;
  sentAt: string;
  lead: { name: string | null } | null;
}

interface EmailBlast {
  id: string;
  name: string;
  templateId: string;
  template: { name: string; subject: string; fromName: string | null; fromEmail: string | null };
  audienceType: AudienceType;
  audienceValue: string;
  audienceCount: number;
  status: BlastStatus;
  scheduledAt: string | null;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
  createdAt: string;
  stats: BlastStats;
  sends: SendRecord[];
}

const STATUS_CFG: Record<BlastStatus, { label: string; color: string; dot: string }> = {
  draft:     { label: 'Rascunho', color: '#6b7280', dot: '#9ca3af' },
  scheduled: { label: 'Agendado', color: '#d97706', dot: '#f59e0b' },
  sending:   { label: 'Enviando', color: '#2563eb', dot: '#3b82f6' },
  sent:      { label: 'Enviado',  color: '#059669', dot: '#10b981' },
  failed:    { label: 'Falhou',   color: '#dc2626', dot: '#ef4444' },
};

const SEND_STATUS_CFG: Record<SendStatus, { label: string; bg: string; color: string }> = {
  clicked:   { label: 'Clicado',  bg: '#d1fae5', color: '#059669' },
  opened:    { label: 'Aberto',   bg: '#dbeafe', color: '#2563eb' },
  delivered: { label: 'Entregue', bg: '#f3f4f6', color: '#374151' },
  sent:      { label: 'Enviado',  bg: '#f3f4f6', color: '#6b7280' },
  bounced:   { label: 'Bounced',  bg: '#fee2e2', color: '#dc2626' },
  failed:    { label: 'Falhou',   bg: '#fee2e2', color: '#dc2626' },
};

const AUDIENCE_ICON: Record<AudienceType, React.ElementType> = { tag: Tag, segment: Layers, individual: Users };
const AUDIENCE_LABEL: Record<AudienceType, string> = { tag: 'Tag', segment: 'Segmento', individual: 'Individual' };

const fmt = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number; rate?: number; color: string; rateLabel?: string }> =
  ({ icon, label, value, rate, color, rateLabel }) => (
  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 12, right: 14, opacity: 0.1, color }}>{icon}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 4 }}>{label}</div>
    {rate !== undefined && (
      <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
        <TrendingUp size={11} /> {rate}% {rateLabel ?? 'taxa'}
      </div>
    )}
  </div>
);

const EmailBlastDetailView: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [blast, setBlast]     = useState<EmailBlast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [showSends, setShowSends] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiClient.get<EmailBlast>(`/email-blasts/${id}`);
      setBlast(data);
    } catch {
      setError('Erro ao carregar disparo');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Atualiza sozinho enquanto o disparo estiver em andamento
  useEffect(() => {
    if (blast?.status !== 'sending') return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [blast?.status, load]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 10, color: 'var(--fg-muted)' }}>
        <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> Carregando...
      </div>
    );
  }

  if (error || !blast) {
    return (
      <div style={{ padding: '40px 32px' }}>
        <button onClick={() => navigate('/disparos')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
          <ArrowLeft size={14} /> Voltar para Disparos
        </button>
        <div style={{ color: '#dc2626', fontSize: 14 }}>{error ?? 'Disparo não encontrado'}</div>
      </div>
    );
  }

  const s  = STATUS_CFG[blast.status] ?? STATUS_CFG.draft;
  const st = blast.stats;
  const hasSends = blast.sends && blast.sends.length > 0;
  const deliveryRate = st.sent > 0 ? Number((st.delivered / st.sent * 100).toFixed(1)) : 0;
  const AudienceIcon = AUDIENCE_ICON[blast.audienceType];

  const audienceDetail = blast.audienceType === 'tag' ? `Tag: ${blast.audienceValue}`
    : blast.audienceType === 'segment' ? 'Segmento configurado'
    : (() => { try { return `${(JSON.parse(blast.audienceValue) as string[]).length} leads selecionados manualmente`; } catch { return 'Individual'; } })();

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <button onClick={() => navigate('/disparos')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Voltar para Disparos
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{blast.name}</h2>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${s.dot}22`, color: s.color }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, display: 'inline-block' }} />
              {s.label}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{blast.template.subject}</div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard icon={<Send size={32} />}              label="Enviados"  value={st.sent}      color="#6366f1" />
        <StatCard icon={<Package size={32} />}           label="Entregues" value={st.delivered} color="#0ea5e9" rate={deliveryRate} rateLabel="entrega" />
        <StatCard icon={<Mail size={32} />}              label="Abertos"   value={st.opened}    color="#10b981" rate={st.openRate}  rateLabel="abertura" />
        <StatCard icon={<MousePointerClick size={32} />} label="Clicados"  value={st.clicked}   color="#f59e0b" rate={st.clickRate} rateLabel="clique" />
        <StatCard icon={<X size={32} />}                 label="Bounced"   value={st.bounced}   color="#ef4444" rate={st.bounceRate} rateLabel="bounce" />
      </div>

      {/* Info card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Audiência</div>
            <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><AudienceIcon size={12} />{AUDIENCE_LABEL[blast.audienceType]}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{audienceDetail} · {blast.audienceCount.toLocaleString('pt-BR')} leads</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remetente</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{blast.template.fromName || 'AutoForce'}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{blast.template.fromEmail || 'padrão'}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {blast.status === 'scheduled' ? 'Agendado para' : 'Enviado em'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(blast.status === 'scheduled' ? blast.scheduledAt : blast.sentAt)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Criado em</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(blast.createdAt)}</div>
          </div>
        </div>
      </div>

      {/* Sends history */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
        <button onClick={() => setShowSends(p => !p)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            Leads que receberam
            {hasSends && (
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--fg-muted)' }}>
                ({blast.sends.length} registro{blast.sends.length !== 1 ? 's' : ''})
              </span>
            )}
          </span>
          {showSends ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showSends && (
          hasSends ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                    {['Lead', 'Status', 'Enviado em', 'Aberto em', 'Clicado em', 'Onde clicou'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {blast.sends.map((send, i) => {
                    const sc = SEND_STATUS_CFG[send.status] ?? SEND_STATUS_CFG.sent;
                    return (
                      <tr key={send.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-base)' }}>
                        <td style={{ padding: '10px 16px', color: 'var(--fg-base)', fontWeight: 500 }}>
                          {send.lead?.name || send.leadEmail}
                          {send.lead?.name && <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{send.leadEmail}</div>}
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
                        <td style={{ padding: '10px 16px', color: 'var(--fg-secondary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={send.clickedUrl ?? undefined}>
                          {send.clickedUrl ?? '—'}
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
    </div>
  );
};

export default EmailBlastDetailView;
