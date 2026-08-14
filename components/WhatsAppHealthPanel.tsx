import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  MessageSquareWarning,
  RefreshCw,
  Send,
  Smartphone,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DataService } from '../services/dataService';
import type { WhatsAppNumberEntry, WhatsAppNumberHealth } from '../types';

interface Props {
  numbers: WhatsAppNumberEntry[];
}

const QUALITY_META: Record<string, { label: string; color: string; bg: string }> = {
  GREEN: { label: 'Alta', color: '#15803d', bg: '#dcfce7' },
  YELLOW: { label: 'Média', color: '#b45309', bg: '#fef3c7' },
  RED: { label: 'Baixa', color: '#dc2626', bg: '#fee2e2' },
  UNKNOWN: { label: 'Não informada', color: '#64748b', bg: '#f1f5f9' },
};

const percent = (value: number) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: value > 0 && value < 10 ? 1 : 0, maximumFractionDigits: 2 })}%`;
const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const shortDate = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

function phoneLabel(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  if (digits.length === 12 && digits.startsWith('55')) return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  return value;
}

function MetricCard({ icon: Icon, label, value, detail, color = 'var(--accent)' }: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="ds-card" style={{ padding: '16px 17px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: `${color}16`, color, display: 'grid', placeItems: 'center' }}><Icon size={15} /></span>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, color: 'var(--fg-primary)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginTop: 6, lineHeight: 1.4 }}>{detail}</div>
    </div>
  );
}

export default function WhatsAppHealthPanel({ numbers }: Props) {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [data, setData] = useState<WhatsAppNumberHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!phoneNumberId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setData(await DataService.getWhatsAppNumberHealth(days, phoneNumberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a saúde do WhatsApp.');
    } finally {
      setLoading(false);
    }
  }, [days, phoneNumberId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (numbers.length === 0) {
      setPhoneNumberId('');
      return;
    }
    if (!numbers.some(number => number.id === phoneNumberId)) {
      setPhoneNumberId(numbers[0].id);
    }
  }, [numbers, phoneNumberId]);

  const selectedNumber = numbers.find(number => number.id === phoneNumberId);
  const quality = QUALITY_META[selectedNumber?.quality_rating ?? 'UNKNOWN'] ?? QUALITY_META.UNKNOWN;
  const metrics = data?.metrics;
  const delta = data?.comparison.errorRateDelta ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="ds-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--fg-primary)' }}>Saúde do número</div>
          <div style={{ marginTop: 3, fontSize: 12, color: 'var(--fg-muted)' }}>Todas as métricas consideram somente o número selecionado.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select aria-label="Número do WhatsApp" value={phoneNumberId} onChange={event => setPhoneNumberId(event.target.value)} className="ds-input" style={{ minWidth: 220, height: 38 }}>
            {numbers.map(number => <option key={number.id} value={number.id}>{number.label || number.verified_name || number.display_phone_number} — {number.display_phone_number}</option>)}
          </select>
          <select aria-label="Período da saúde" value={days} onChange={event => setDays(Number(event.target.value))} className="ds-input" style={{ height: 38 }}>
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <button type="button" onClick={() => void load()} disabled={loading} aria-label="Atualizar saúde" title="Atualizar" style={{ width: 38, height: 38, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--fg-muted)', display: 'grid', placeItems: 'center', cursor: loading ? 'wait' : 'pointer' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && <div style={{ padding: '11px 14px', borderRadius: 9, background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><AlertCircle size={15} />{error}</div>}

      {loading && !data ? (
        <div className="ds-card" style={{ minHeight: 260, display: 'grid', placeItems: 'center', color: 'var(--fg-muted)' }}><span><RefreshCw size={18} className="animate-spin" style={{ display: 'inline', marginRight: 8 }} />Calculando métricas...</span></div>
      ) : numbers.length === 0 ? (
        <div className="ds-card" style={{ minHeight: 220, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', color: 'var(--fg-muted)' }}><div><Smartphone size={24} style={{ margin: '0 auto 8px' }} /><strong style={{ display: 'block', color: 'var(--fg-primary)', marginBottom: 4 }}>Nenhum número disponível</strong>Cadastre ou conecte um número do WhatsApp para acompanhar sua saúde.</div></div>
      ) : data && metrics ? <>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <MetricCard
            icon={Smartphone}
            label="Qualidade Meta"
            value={quality.label}
            color={quality.color}
            detail={selectedNumber?.quality_rating === 'UNKNOWN'
              ? 'A Meta ainda não informou a qualidade deste número.'
              : 'Saúde oficial do número informada diretamente pela Meta.'}
          />
          <MetricCard icon={Send} label="Templates enviados" value={metrics.totalTemplates.toLocaleString('pt-BR')} detail={`${metrics.uniqueRecipients.toLocaleString('pt-BR')} destinatários únicos`} />
          <MetricCard
            icon={MessageSquareWarning}
            label="Erros"
            value={`${metrics.failed.toLocaleString('pt-BR')} · ${percent(metrics.errorRate)}`}
            color={metrics.errorRate > 5 ? '#dc2626' : metrics.errorRate > 2 ? '#d97706' : '#16a34a'}
            detail={delta === 0 ? 'Sem mudança contra o período anterior' : <span style={{ color: delta > 0 ? '#dc2626' : '#15803d' }}>{delta > 0 ? '▲' : '▼'} {percent(Math.abs(delta))} contra o período anterior</span>}
          />
          <MetricCard icon={CheckCircle2} label="Taxa de entrega" value={percent(metrics.deliveryRate)} color="#16a34a" detail={`${metrics.delivered.toLocaleString('pt-BR')} entregues de ${metrics.accepted.toLocaleString('pt-BR')} aceitos pela Meta`} />
          <MetricCard icon={Activity} label="Taxa de leitura" value={percent(metrics.readRate)} color="#7c3aed" detail={`${metrics.read.toLocaleString('pt-BR')} lidos entre os entregues`} />
        </div>

        <div className="ds-card" style={{ padding: '18px 18px 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--fg-primary)' }}>Evolução dos envios</div>
              <div style={{ marginTop: 3, fontSize: 12, color: 'var(--fg-muted)' }}>Tentativas, entregas, leituras e falhas por dia.</div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><Clock3 size={13} />Atualizado agora</div>
          </div>
          <div style={{ width: '100%', height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.daily} margin={{ top: 8, right: 14, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: 'var(--fg-muted)' }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--fg-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={shortDate} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 9, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line type="monotone" dataKey="total" name="Tentativas" stroke="#456cec" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="delivered" name="Entregues" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="read" name="Lidas" stroke="#7c3aed" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="failed" name="Falhas" stroke="#dc2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--fg-primary)' }}>Quais erros estão acontecendo</div>
            <div style={{ marginTop: 3, fontSize: 12, color: 'var(--fg-muted)' }}>Agrupados pelo código retornado pela Meta.</div>
          </div>
          {data.errors.length === 0 ? (
            <div style={{ padding: '38px 20px', textAlign: 'center', color: 'var(--fg-muted)' }}><CheckCircle2 size={24} color="#16a34a" style={{ margin: '0 auto 8px' }} /><strong style={{ display: 'block', color: 'var(--fg-primary)', marginBottom: 3 }}>Nenhum erro no período</strong><span style={{ fontSize: 12.5 }}>Todos os templates registrados foram aceitos pela Meta.</span></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 850 }}>
                <thead><tr style={{ background: 'var(--bg-muted)' }}>{['Código', 'Erro informado pela Meta', 'Tipo', 'Ocorrências', '% dos erros', 'Última ocorrência'].map(label => <th key={label} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</th>)}</tr></thead>
                <tbody>{data.errors.map((item, index) => (
                  <tr key={`${item.code ?? 'sem-codigo'}-${index}`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 750, color: 'var(--fg-primary)', whiteSpace: 'nowrap' }}>{item.code ?? 'Sem código'}</td>
                    <td style={{ padding: '12px 14px', maxWidth: 390 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-primary)' }}>{item.title}</div><div title={item.message} style={{ marginTop: 3, fontSize: 11.5, color: 'var(--fg-muted)', lineHeight: 1.4 }}>{item.message}</div></td>
                    <td style={{ padding: '12px 14px' }}><span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: item.classification === 'permanent' ? '#fee2e2' : '#fef3c7', color: item.classification === 'permanent' ? '#b91c1c' : '#a16207' }}>{item.classification === 'permanent' ? 'Número/destinatário' : 'Temporário/configuração'}</span></td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 750 }}>{item.count.toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12 }}>{percent(item.percentage)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11.5, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>{dateTime(item.lastOccurredAt)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '15px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 750, color: 'var(--fg-primary)' }}>Falhas recentes</div>
            <div style={{ marginTop: 3, fontSize: 12, color: 'var(--fg-muted)' }}>Últimas 30 tentativas com erro, para facilitar a correção.</div>
          </div>
          {data.recentFailures.length === 0 ? <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 12.5 }}>Nenhuma falha recente.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 950 }}>
            <thead><tr style={{ background: 'var(--bg-muted)' }}>{['Data', 'Lead/destinatário', 'Template', 'Origem', 'Erro'].map(label => <th key={label} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>{label}</th>)}</tr></thead>
            <tbody>{data.recentFailures.map(failure => <tr key={failure.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '12px 14px', fontSize: 11.5, color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>{dateTime(failure.occurredAt)}</td>
              <td style={{ padding: '12px 14px' }}>{failure.leadId ? <button type="button" onClick={() => navigate(`/leads/${failure.leadId}`)} style={{ display: 'block', padding: 0, border: 0, background: 'none', color: 'var(--accent)', fontSize: 12.5, fontWeight: 750, cursor: 'pointer' }}>{failure.leadName || failure.leadEmail || phoneLabel(failure.phone)}</button> : <div style={{ fontSize: 12.5, fontWeight: 700 }}>{failure.leadName || failure.leadEmail || phoneLabel(failure.phone)}</div>}<div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--fg-muted)' }}>{failure.company || phoneLabel(failure.phone)}</div></td>
              <td style={{ padding: '12px 14px', fontSize: 12 }}>{failure.templateName || '—'}</td>
              <td style={{ padding: '12px 14px', fontSize: 11.5 }}>{failure.origin}</td>
              <td style={{ padding: '12px 14px', maxWidth: 380 }}><div style={{ fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>{failure.errorCode ? `${failure.errorCode} · ` : ''}{failure.errorTitle || 'Falha no envio'}</div><div title={failure.errorMessage || ''} style={{ marginTop: 3, fontSize: 11, color: 'var(--fg-muted)' }}>{failure.errorMessage || 'Sem detalhes retornados pela Meta'}</div></td>
            </tr>)}</tbody>
          </table></div>}
        </div>

        <div style={{ padding: '12px 14px', borderRadius: 9, background: 'var(--bg-muted)', color: 'var(--fg-muted)', fontSize: 12, lineHeight: 1.5, display: 'flex', gap: 8 }}>
          <Smartphone size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          A classificação “Número/destinatário” indica falhas que normalmente exigem corrigir o telefone do lead. “Temporário/configuração” inclui limites, credenciais, parâmetros do template e instabilidades que devem ser analisados pela mensagem retornada pela Meta.
        </div>
      </> : null}
    </div>
  );
}
