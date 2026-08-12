import React, { useEffect, useMemo, useState } from 'react';
import { Check, MailX, RefreshCw, ShieldCheck } from 'lucide-react';

type PageState = 'loading' | 'ready' | 'submitting' | 'success' | 'already' | 'error';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

const EmailUnsubscribeView: React.FC = () => {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') ?? '', []);
  const [state, setState] = useState<PageState>('loading');
  const [emailMasked, setEmailMasked] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('Newsletter');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setMessage('O link de desinscrição está incompleto.');
      setState('error');
      return;
    }

    const controller = new AbortController();
    fetch(`${API_URL}/email-unsubscribe/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as { emailMasked?: string; categoryLabel?: string; unsubscribed?: boolean; error?: string };
        if (!response.ok) throw new Error(data.error || 'Não foi possível validar este link.');
        setEmailMasked(data.emailMasked ?? '');
        setCategoryLabel(data.categoryLabel ?? 'Newsletter');
        setState(data.unsubscribed ? 'already' : 'ready');
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setMessage(error instanceof Error ? error.message : 'Não foi possível validar este link.');
        setState('error');
      });

    return () => controller.abort();
  }, [token]);

  const confirmUnsubscribe = async () => {
    setState('submitting');
    try {
      const response = await fetch(`${API_URL}/email-unsubscribe/${encodeURIComponent(token)}`, { method: 'POST' });
      const data = await response.json().catch(() => ({})) as { emailMasked?: string; categoryLabel?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a desinscrição.');
      setEmailMasked(data.emailMasked ?? emailMasked);
      setCategoryLabel(data.categoryLabel ?? categoryLabel);
      setState('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a desinscrição.');
      setState('error');
    }
  };

  const completed = state === 'success' || state === 'already';

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(145deg, #f7f9ff 0%, #eef2ff 52%, #f8fafc 100%)', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', color: '#111827' }}>
      <section style={{ width: '100%', maxWidth: 510, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 22, boxShadow: '0 24px 70px rgba(39, 56, 130, 0.13)', overflow: 'hidden' }}>
        <div style={{ height: 6, background: 'linear-gradient(90deg, #374fe2, #6892f2)' }} />
        <div style={{ padding: '38px 36px 34px', textAlign: 'center' }}>
          <img
            src="/autoforce-logo-white.svg"
            alt="AutoForce"
            style={{ width: 174, height: 'auto', margin: '0 auto 34px', filter: 'brightness(0) saturate(100%) invert(28%) sepia(91%) saturate(2818%) hue-rotate(226deg) brightness(91%) contrast(95%)' }}
          />

          <div style={{ margin: '0 auto 20px', width: 58, height: 58, borderRadius: 18, display: 'grid', placeItems: 'center', background: completed ? '#ecfdf5' : state === 'error' ? '#fef2f2' : '#eef2ff', color: completed ? '#059669' : state === 'error' ? '#dc2626' : '#4057df' }}>
            {state === 'loading' || state === 'submitting'
              ? <RefreshCw size={27} style={{ animation: 'spin 1s linear infinite' }} />
              : completed ? <Check size={28} /> : <MailX size={27} />}
          </div>

          {state === 'loading' && <><h1 style={titleStyle}>Validando seu link</h1><p style={textStyle}>Aguarde só um instante.</p></>}

          {(state === 'ready' || state === 'submitting') && (
            <>
              <h1 style={titleStyle}>Cancelar recebimento</h1>
              <p style={textStyle}>Você deixará de receber e-mails da categoria <strong>{categoryLabel}</strong> enviados para:</p>
              <div style={{ margin: '18px 0 24px', padding: '11px 16px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb', fontSize: 14, fontWeight: 700, color: '#374151' }}>{emailMasked}</div>
              <button type="button" onClick={confirmUnsubscribe} disabled={state === 'submitting'} style={{ width: '100%', padding: '13px 20px', border: 0, borderRadius: 10, background: '#374fe2', color: '#fff', fontSize: 15, fontWeight: 750, cursor: state === 'submitting' ? 'wait' : 'pointer', opacity: state === 'submitting' ? 0.7 : 1 }}>
                {state === 'submitting' ? 'Confirmando...' : 'Confirmar desinscrição'}
              </button>
              <p style={{ margin: '15px 0 0', fontSize: 12, lineHeight: 1.55, color: '#9ca3af' }}>Nenhuma alteração é feita até você confirmar.</p>
            </>
          )}

          {state === 'success' && <><h1 style={titleStyle}>Desinscrição confirmada</h1><p style={textStyle}>O endereço <strong>{emailMasked}</strong> não receberá mais e-mails da categoria <strong>{categoryLabel}</strong>.</p></>}
          {state === 'already' && <><h1 style={titleStyle}>Você já está desinscrito</h1><p style={textStyle}>O endereço <strong>{emailMasked}</strong> já não recebe e-mails da categoria <strong>{categoryLabel}</strong>.</p></>}
          {state === 'error' && <><h1 style={titleStyle}>Não foi possível continuar</h1><p style={textStyle}>{message}</p></>}

          <div style={{ marginTop: 30, paddingTop: 20, borderTop: '1px solid #f0f1f4', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, color: '#9ca3af', fontSize: 12 }}>
            <ShieldCheck size={14} /> Sua preferência é registrada com segurança.
          </div>
        </div>
      </section>
    </main>
  );
};

const titleStyle: React.CSSProperties = { margin: '0 0 12px', fontSize: 25, lineHeight: 1.2, letterSpacing: '-0.025em', fontWeight: 800 };
const textStyle: React.CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.65, color: '#667085' };

export default EmailUnsubscribeView;
