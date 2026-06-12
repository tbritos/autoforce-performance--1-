import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Edit3, Copy, Send, RefreshCw,
  CheckCircle, AlertCircle, Eye,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

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

  const s = STATUS_CFG[template.status] ?? STATUS_CFG.draft;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      <button onClick={() => navigate('/emails')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
        <ArrowLeft size={14}/> Voltar para E-mails
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{template.name}</h2>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4 }}>{template.subject}</div>
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

      {/* Stats */}
      {template.stats.sent > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Enviados',  value: template.stats.sent,    color: '#6366f1' },
            { label: 'Abertos',   value: template.stats.opened,  color: '#10b981', rate: template.stats.openRate },
            { label: 'Clicados',  value: template.stats.clicked, color: '#f59e0b', rate: template.stats.clickRate },
            { label: 'Bounced',   value: template.stats.bounced, color: '#ef4444' },
          ].map(m => (
            <div key={m.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 2 }}>{m.label}</div>
              {m.rate !== undefined && <div style={{ fontSize: 11, color: m.color, marginTop: 4, fontWeight: 700 }}>{m.rate}% taxa</div>}
            </div>
          ))}
        </div>
      )}

      {/* Info card */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4 }}>STATUS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: s.color }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }}/>{s.label}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4 }}>PÚBLICO</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{audienceLabel(template)}</div>
            {audienceSub(template) && <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{audienceSub(template)}</div>}
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4 }}>REMETENTE</div>
            <div style={{ fontSize: 13 }}>{template.fromName || 'AutoForce'}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{template.fromEmail || 'padrão'}</div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => setShowPreview(p => !p)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
          <Eye size={13}/> {showPreview ? 'Ocultar preview' : 'Ver preview do email'}
        </button>
        {showPreview && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
            <iframe
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:24px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;}</style></head><body>${template.body}</body></html>`}
              style={{ width: '100%', minHeight: 400, border: 'none', display: 'block' }}
              title="Preview"
            />
          </div>
        )}
      </div>

      {/* Test send */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
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
