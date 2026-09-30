import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthBrandMark } from './AuthShell';
import { loadConsoleSettings } from '../../utils/settings';
import { useAuthStore } from '../../store/authStore';

export function SplashPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const id = setTimeout(() => {
      navigate(user ? loadConsoleSettings().landing : '/login', { replace: true });
    }, 1900);
    return () => clearTimeout(id);
  }, [navigate, user]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-primary-container px-6 text-center">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(147,197,253,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(147,197,253,0.12) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
      <div aria-hidden className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-secondary/25 blur-3xl" />
      <div className="relative flex flex-col items-center anim-fade-up">
        <AuthBrandMark size="lg" />
        <h1 className="pt-5 font-headline-xl tracking-wide text-white">CIVICEYE</h1>
        <p className="pt-2 font-label-caps text-slate-400">AI-POWERED PUBLIC SAFETY INTELLIGENCE</p>
        <p className="pt-3 font-data-mono-md tracking-widest text-blue-300">MONITOR · DETECT · RESPOND</p>
        <div className="mt-8 h-1 w-56 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Loading console">
          <div className="loading-bar-fill h-full w-2/5 rounded-full bg-gradient-to-r from-secondary to-blue-300" />
        </div>
        <p className="pt-4 font-data-mono-sm text-slate-500">INITIALIZING SECURE SESSION…</p>
      </div>
      <p className="absolute bottom-6 font-data-mono-sm text-slate-600">CIVICEYE CONSOLE v4.2 · BUILD 90218</p>
    </div>
  );
}

export default SplashPage;
