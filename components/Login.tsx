import React, { useState } from 'react';
import { User } from '../types';
import { ChevronRight, User as UserIcon, Plus, ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [step, setStep] = useState<'welcome' | 'account-selection' | 'manual-input'>('welcome');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  // Mock de contas salvas (simulando o cookie do navegador)
  const savedAccounts = [
    { name: 'Marketing AutoForce', email: 'marketing@autoforce.com', avatar: 'https://ui-avatars.com/api/?name=Marketing&background=1440FF&color=fff' },
    { name: 'Diretoria Comercial', email: 'diretoria@autoforce.com', avatar: 'https://ui-avatars.com/api/?name=Diretoria&background=FFA814&color=000' }
  ];

  const performLogin = (emailToLogin: string) => {
    setLoading(true);
    setError('');

    setTimeout(() => {
      if (emailToLogin.endsWith('@autoforce.com') || emailToLogin.endsWith('@autoforce.com.br')) {
        onLogin({
          email: emailToLogin,
          name: emailToLogin.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          avatar: `https://ui-avatars.com/api/?name=${emailToLogin}&background=1440FF&color=fff`,
          role: 'AutoForce Member'
        });
      } else {
        setError('Acesso permitido apenas para contas @autoforce.com');
        setLoading(false);
        setSelectedAccount(null);
      }
    }, 1500);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(email);
  };

  const handleAccountClick = (accEmail: string) => {
    setSelectedAccount(accEmail);
    performLogin(accEmail);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#00020A] relative overflow-hidden font-sans">
      
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-autoforce-blue/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-autoforce-secondary/10 rounded-full blur-[100px]"></div>
        <div className="absolute top-[50%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
      </div>

      <div className="z-10 w-full max-w-[420px] p-1">
        
        {/* Main Card */}
        <div className="bg-autoforce-darkest/40 backdrop-blur-2xl border border-white/5 rounded-3xl shadow-2xl overflow-hidden relative">
            
            {/* Top Gloss Line */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

            <div className="p-10 flex flex-col items-center min-h-[500px] transition-all duration-500">
                
                {/* Logo Section */}
                <div className="mb-12 flex flex-col items-center animate-fade-in-down">
                    <img 
                      src="https://static.autodromo.com.br/uploads/1dc32f4d-ab47-428d-91dd-756266d45b47_LOGOTIPO-AUTOFORCE-HORIZONTAL.svg" 
                      alt="AutoForce" 
                      className="h-12 w-auto mb-4 object-contain"
                    />
                    <p className="text-autoforce-lightGrey text-xs tracking-[0.2em] mt-1 uppercase">Intelligence System</p>
                </div>

                {/* STEP 1: WELCOME SCREEN */}
                {step === 'welcome' && (
                    <div className="w-full flex flex-col items-center animate-fade-in-up space-y-8">
                        <div className="text-center space-y-2">
                            <h2 className="text-xl font-semibold text-white">Bem-vindo de volta</h2>
                            <p className="text-sm text-autoforce-lightGrey/70">Acesse o painel de alta performance</p>
                        </div>

                        <button 
                            onClick={() => setStep('account-selection')}
                            className="group relative w-full bg-white text-autoforce-darkest font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                        >
                             {/* Google "G" Icon SVG */}
                             <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            <span className="tracking-wide">Entrar com Google</span>
                            <ChevronRight size={16} className="absolute right-4 opacity-0 group-hover:opacity-50 group-hover:translate-x-1 transition-all" />
                        </button>

                        <div className="flex items-center gap-2 text-autoforce-grey text-xs mt-8">
                            <ShieldCheck size={12} />
                            <span>Ambiente Seguro AutoForce</span>
                        </div>
                    </div>
                )}

                {/* STEP 2: ACCOUNT SELECTION */}
                {step === 'account-selection' && (
                    <div className="w-full animate-fade-in-right">
                         <div className="flex items-center mb-6">
                            <button onClick={() => setStep('welcome')} className="p-2 -ml-2 text-autoforce-lightGrey hover:text-white transition rounded-full hover:bg-white/5">
                                <ArrowLeft size={18} />
                            </button>
                            <h2 className="text-lg font-semibold text-white ml-2">Escolha uma conta</h2>
                        </div>

                        <div className="space-y-3">
                            {savedAccounts.map((acc, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleAccountClick(acc.email)}
                                    disabled={loading}
                                    className="w-full flex items-center gap-4 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-autoforce-blue/50 transition-all text-left group"
                                >
                                    <div className="relative">
                                        <img src={acc.avatar} alt={acc.name} className="w-10 h-10 rounded-full" />
                                        {loading && selectedAccount === acc.email && (
                                            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                                <Loader2 size={16} className="animate-spin text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-white group-hover:text-autoforce-blue transition-colors">{acc.name}</p>
                                        <p className="text-xs text-autoforce-lightGrey">{acc.email}</p>
                                    </div>
                                </button>
                            ))}

                            <button
                                onClick={() => setStep('manual-input')}
                                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all text-left group text-autoforce-lightGrey"
                            >
                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                    <UserIcon size={18} />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-white">Usar outra conta</p>
                                </div>
                            </button>
                        </div>

                        {error && (
                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-xs text-center animate-shake">
                                {error}
                            </div>
                        )}
                    </div>
                )}

                 {/* STEP 3: MANUAL INPUT */}
                 {step === 'manual-input' && (
                    <div className="w-full animate-fade-in-right">
                         <div className="flex items-center mb-6">
                            <button onClick={() => setStep('account-selection')} className="p-2 -ml-2 text-autoforce-lightGrey hover:text-white transition rounded-full hover:bg-white/5">
                                <ArrowLeft size={18} />
                            </button>
                            <h2 className="text-lg font-semibold text-white ml-2">Entrar com e-mail</h2>
                        </div>

                        <form onSubmit={handleManualSubmit} className="space-y-6">
                            <div>
                                <div className={`relative group transition-all duration-300 ${email ? 'scale-100' : 'scale-100'}`}>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-[#00020A] border border-autoforce-grey/50 focus:border-autoforce-blue rounded-xl px-4 pt-5 pb-2 text-white outline-none transition-all peer placeholder-transparent"
                                        placeholder="Seu e-mail corporativo"
                                        id="emailInput"
                                        required
                                        autoFocus
                                    />
                                    <label 
                                        htmlFor="emailInput"
                                        className="absolute left-4 top-1 text-[10px] text-autoforce-blue font-bold uppercase tracking-wider transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-autoforce-grey peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-focus:top-1 peer-focus:text-[10px] peer-focus:text-autoforce-blue peer-focus:font-bold peer-focus:uppercase"
                                    >
                                        E-mail Corporativo
                                    </label>
                                </div>
                                <p className="text-[10px] text-autoforce-grey mt-2 pl-1">
                                    Utilize seu domínio @autoforce.com
                                </p>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-xs flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={loading || !email}
                                    className="bg-autoforce-blue hover:bg-autoforce-secondary disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-autoforce-blue/30 flex items-center gap-2"
                                >
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'Próxima'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

            </div>
            
            {/* Bottom Tech Bar */}
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