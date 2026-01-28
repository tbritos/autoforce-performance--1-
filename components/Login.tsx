import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { User } from '../types';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: Record<string, any>) => void;
          renderButton: (element: HTMLElement, options: Record<string, any>) => void;
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

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCredentialResponse = async (response: { credential?: string }) => {
    if (!response.credential) {
      setError('Falha ao autenticar. Tente novamente.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      if (!result.ok) {
        const text = await result.text();
        throw new Error(text || 'Falha ao autenticar');
      }

      const data = await result.json();
      localStorage.setItem('autoforce_token', response.credential);
      localStorage.setItem('autoforce_user', JSON.stringify(data.user));
      onLogin(data.user, response.credential);
    } catch (err) {
      console.error(err);
      setError('Acesso permitido apenas para contas @autoforce.com');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Client ID nao configurado.');
      return;
    }

    const initGoogle = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        ux_mode: 'popup',
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 340,
      });
      window.google.accounts.id.prompt();
    };

    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval);
        initGoogle();
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05060C] relative overflow-hidden font-sans">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(20,64,255,0.18),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(0,39,212,0.2),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,2,10,0.9),rgba(0,2,10,0.98))]" />
      </div>

      <div className="z-10 w-full max-w-[420px] px-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_60px_-30px_rgba(0,0,0,0.75)] overflow-hidden">
          <div className="px-8 pt-10 pb-8 flex flex-col items-center">
            <div className="mb-10 flex flex-col items-center animate-fade-in-down">
              <img
                src="https://static.autodromo.com.br/uploads/1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.svg"
                alt="AutoForce"
                className="h-10 w-auto mb-4 object-contain opacity-90"
              />
            </div>

            <div className="w-full flex flex-col items-center animate-fade-in-up space-y-7">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold text-white font-display tracking-tight">
                  Bem-vindo de volta
                </h2>
                <p className="text-sm text-autoforce-lightGrey/70">
                  Acesse com sua conta institucional
                </p>
              </div>

              <div className="w-full flex flex-col items-center gap-4">
                <div className="w-full flex justify-center">
                  <div
                    ref={buttonRef}
                    className="w-[340px] h-[44px] flex items-center justify-center rounded-full overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-14px_rgba(20,64,255,0.9)] mt-1"
                  />
                </div>
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-autoforce-lightGrey/80">
                    <Loader2 size={14} className="animate-spin" />
                    Autenticando...
                  </div>
                )}
              </div>

              {error && (
                <div className="w-full p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-xs text-center animate-shake">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-2 text-white text-xs mt-2">
                <ShieldCheck size={12} />
                <span>Restrito a emails @autoforce.com</span>
              </div>
            </div>
          </div>

          <div className="px-8 py-4 border-t border-white/10 flex justify-between items-center text-[10px] text-autoforce-grey uppercase tracking-widest bg-white/[0.02]">
            <span>V. 1.0.0</span>
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              Online
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
