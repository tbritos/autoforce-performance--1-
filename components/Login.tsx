import React, { useEffect, useRef, useState } from 'react';
import { User } from '../types';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

interface LoginProps {
  onLogin: (user: User, token?: string) => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const handleCredentialResponse = async (response: { credential?: string }) => {
    if (!response.credential) {
      setError('Falha ao autenticar. Tente novamente.');
      return;
    }

    setError('');
    try {
      const result = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      if (!result.ok) {
        const text = await result.text();
        throw new Error(text || 'Falha no login Google');
      }

      const data = await result.json();
      localStorage.setItem('autoforce_user', JSON.stringify(data.user));
      localStorage.removeItem('autoforce_token');
      onLogin(data.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Login error:', message);
      setError(message || 'Acesso restrito a contas @autoforce.com');
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Client ID nao configurado.');
      return;
    }

    const init = () => {
      if (initializedRef.current || !window.google?.accounts?.id || !googleButtonRef.current) return;
      initializedRef.current = true;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        ux_mode: 'redirect',
        login_uri: `${API_URL}/auth/google/redirect`,
      });

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 336,
      });
      setReady(true);
    };

    init();
    const interval = window.setInterval(init, 200);
    return () => window.clearInterval(interval);
  }, []);

  const handleDevLogin = async () => {
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
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] font-sans select-none">
      <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200/80">
        <img
          src="https://static.autodromo.com.br/uploads/1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.svg"
          alt="AutoForce"
          className="h-6 w-auto object-contain"
          draggable={false}
        />
        <nav className="flex items-center gap-1">
          {['Documentacao', 'Suporte'].map(label => (
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

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div
          className="w-full max-w-[400px] bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
          style={{ animation: 'fadeUp 0.4s ease both' }}
        >
          <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600" />

          <div className="px-8 py-10 flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold text-gray-900 leading-tight tracking-tight">
                Acesse a <span className="text-blue-600">AutoForce</span>.
              </h1>
              <p className="text-[13.5px] text-gray-500 leading-relaxed">
                Sistema central da operacao de marketing.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="min-h-[44px] w-full flex items-center justify-center">
                {!ready && (
                  <button
                    type="button"
                    disabled
                    className="w-full h-[44px] rounded border border-gray-200 bg-white text-[14px] font-medium text-gray-400 disabled:cursor-not-allowed"
                  >
                    Carregando Google...
                  </button>
                )}
                <div ref={googleButtonRef} className={ready ? 'block' : 'hidden'} />
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-100">
                  <span className="text-red-400 text-sm mt-px leading-none">&#9888;</span>
                  <span className="text-red-600 text-xs leading-relaxed">{error}</span>
                </div>
              )}

              <p className="text-xs text-gray-400 text-center pt-1">
                Use sua conta corporativa <span className="font-semibold text-gray-500">@autoforce.com</span>
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
                    className="w-full h-10 px-4 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all duration-150 font-mono"
                  >
                    Entrar sem Google (localhost)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="flex items-center justify-between px-8 py-4 text-[11px] text-gray-400">
        <span>(c) 2026 AutoForce - v2.0.0</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span>Todos os servicos operando</span>
          </div>
          {['Status', 'Termos', 'Privacidade'].map(link => (
            <React.Fragment key={link}>
              <span className="text-gray-200">-</span>
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
