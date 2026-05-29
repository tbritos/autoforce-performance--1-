import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { User } from '../types';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface LoginProps {
  onLogin: (user: User, token: string) => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const hiddenButtonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const handleCredentialResponse = async (response: { credential?: string }) => {
    if (!response.credential) { setError('Falha ao autenticar. Tente novamente.'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      if (!result.ok) { const t = await result.text(); throw new Error(t || 'Falha'); }
      const data = await result.json();
      const sessionToken = data.token || response.credential;
      localStorage.setItem('autoforce_token', sessionToken);
      localStorage.setItem('autoforce_user', JSON.stringify(data.user));
      onLogin(data.user, sessionToken);
    } catch (err) {
      console.error(err);
      setError('Acesso restrito a contas @autoforce.com');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) { setError('Google Client ID não configurado.'); return; }
    const init = () => {
      if (!window.google?.accounts?.id || !hiddenButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.renderButton(hiddenButtonRef.current, { theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', width: 300 });
      setReady(true);
    };
    if (window.google?.accounts?.id) { init(); return; }
    const t = setInterval(() => { if (window.google?.accounts?.id) { clearInterval(t); init(); } }, 200);
    return () => clearInterval(t);
  }, []);

  const handleGoogleClick = () => {
    const btn = hiddenButtonRef.current?.querySelector<HTMLElement>('div[role="button"]');
    btn?.click();
  };

  const handleDevLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await fetch(`${API_URL}/auth/dev-login`, { method: 'POST' });
      if (!result.ok) throw new Error('Dev login failed');
      const data = await result.json();
      const devToken = 'dev-local-bypass';
      localStorage.setItem('autoforce_token', devToken);
      localStorage.setItem('autoforce_user', JSON.stringify(data.user));
      onLogin(data.user, devToken);
    } catch {
      setError('Falha no login dev. Backend rodando?');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] font-sans select-none">

      {/* Hidden Google SDK button */}
      <div ref={hiddenButtonRef} className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden" />

      {/* ── Top nav ──────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200/80">
        <img
          src="https://static.autodromo.com.br/uploads/1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.svg"
          alt="AutoForce"
          className="h-6 w-auto object-contain"
          draggable={false}
        />
        <nav className="flex items-center gap-1">
          {['Documentação', 'Suporte'].map(label => (
            <a
              key={label}
              href={label.startsWith('Document') ? '/docs' : '#'}
              className="px-3 py-1.5 text-sm text-gray-500 rounded-md hover:bg-gray-100 hover:text-gray-800 transition-all duration-150"
            >
              {label}
            </a>
          ))}
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <span className="px-3 py-1.5 text-sm text-gray-400">PT-BR</span>
        </nav>
      </header>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div
          className="w-full max-w-[400px] bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
          style={{ animation: 'fadeUp 0.4s ease both' }}
        >
          {/* Blue accent bar */}
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600" />

          <div className="px-8 py-10 flex flex-col gap-8">

            {/* Headline */}
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold text-gray-900 leading-tight tracking-tight">
                Acesse a{' '}
                <span className="text-blue-600">AutoForce</span>
                .
              </h1>
              <p className="text-[13.5px] text-gray-500 leading-relaxed">
                Sistema central da operação de marketing.
              </p>
            </div>

            {/* Button area */}
            <div className="flex flex-col gap-3">

              {/* Custom Google button */}
              <button
                type="button"
                onClick={handleGoogleClick}
                disabled={!ready || loading}
                className="
                  group relative w-full flex items-center justify-center gap-3
                  h-[46px] px-5 rounded-xl
                  bg-white border border-gray-200
                  text-[14px] font-medium text-gray-700
                  shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]
                  hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)]
                  hover:border-gray-300
                  hover:-translate-y-px
                  active:translate-y-0 active:shadow-sm
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200 ease-out
                "
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-gray-400" />
                    <span className="text-gray-500">Autenticando...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    <span>Continuar com Google</span>
                  </>
                )}
              </button>

              {error && (
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-100">
                  <span className="text-red-400 text-sm mt-px leading-none">&#9888;</span>
                  <span className="text-red-600 text-xs leading-relaxed">{error}</span>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center pt-1">
                Use sua conta corporativa{' '}
                <span className="font-semibold text-gray-500">@autoforce.com</span>
              </p>

              {import.meta.env.DEV && (
                <>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-[10px] font-mono text-gray-300 uppercase tracking-widest">dev</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <button
                    type="button"
                    onClick={handleDevLogin}
                    disabled={loading}
                    className="w-full h-10 px-4 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-all duration-150 font-mono"
                  >
                    ⚡ Entrar sem Google (localhost)
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="flex items-center justify-between px-8 py-4 text-[11px] text-gray-400">
        <span>© 2026 AutoForce · v2.0.0</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span>Todos os serviços operando</span>
          </div>
          {['Status', 'Termos', 'Privacidade'].map(link => (
            <React.Fragment key={link}>
              <span className="text-gray-200">·</span>
              <a href="#" className="hover:text-gray-700 transition-colors">{link}</a>
            </React.Fragment>
          ))}
        </div>
      </footer>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Login;
