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
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 320,
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
    <div className="min-h-screen flex items-center justify-center bg-[#00020A] relative overflow-hidden font-sans">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-autoforce-blue/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-autoforce-secondary/10 rounded-full blur-[100px]"></div>
        <div className="absolute top-[50%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
      </div>

      <div className="z-10 w-full max-w-[420px] p-1">
        <div className="bg-autoforce-darkest/40 backdrop-blur-2xl border border-white/5 rounded-3xl shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

          <div className="p-10 flex flex-col items-center min-h-[480px] transition-all duration-500">
            <div className="mb-12 flex flex-col items-center animate-fade-in-down">
              <img
                src="https://static.autodromo.com.br/uploads/1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.svg"
                alt="AutoForce"
                className="h-12 w-auto mb-4 object-contain"
              />
              <p className="text-autoforce-lightGrey text-xs tracking-[0.2em] mt-1 uppercase">Intelligence System</p>
            </div>

            <div className="w-full flex flex-col items-center animate-fade-in-up space-y-8">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-white">Bem-vindo de volta</h2>
                <p className="text-sm text-autoforce-lightGrey/70">Acesse com sua conta institucional</p>
              </div>

              <div className="w-full flex flex-col items-center gap-4">
                <div ref={buttonRef} className="w-full flex justify-center" />
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-autoforce-lightGrey">
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

              <div className="flex items-center gap-2 text-autoforce-grey text-xs mt-8">
                <ShieldCheck size={12} />
                <span>Restrito a emails @autoforce.com</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 w-full p-4 bg-black/20 backdrop-blur-md border-t border-white/5 flex justify-between items-center text-[10px] text-autoforce-grey uppercase tracking-widest">
            <span>V. 2.5.0</span>
            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div> System Online</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
