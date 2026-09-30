import type { ReactNode } from 'react';

const PILLARS = [
  { icon: 'videocam', title: 'Monitor', desc: '412 optical feeds with live computer-vision telemetry.' },
  { icon: 'psychology', title: 'Detect', desc: 'Behavioral AI flags collisions, surges and anomalies.' },
  { icon: 'notifications_active', title: 'Respond', desc: 'One-tap dispatch across EMS, police and transit.' },
];

export function AuthBrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-16 w-16 rounded-2xl' : 'h-10 w-10 rounded-xl';
  return (
    <div className={`flex ${box} items-center justify-center bg-gradient-to-br from-secondary to-blue-800 shadow-pop shrink-0`}>
      <span className={`material-symbols-outlined text-on-primary ${size === 'lg' ? 'text-3xl' : 'text-xl'}`}>visibility</span>
    </div>
  );
}

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col lg:flex-row">
        {/* Brand panel */}
        <div className="relative hidden overflow-hidden bg-primary-container lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:p-10">
          <div
            aria-hidden
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'linear-gradient(rgba(147,197,253,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(147,197,253,0.12) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
          <div aria-hidden className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-secondary/25 blur-3xl" />
          <div aria-hidden className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-blue-800/40 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <AuthBrandMark />
            <div>
              <p className="font-headline-md tracking-wide text-white">CIVICEYE</p>
              <p className="font-label-caps text-slate-400">PUBLIC SAFETY INTEL</p>
            </div>
          </div>
          <div className="relative">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 font-data-mono-sm text-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              SECURE OPERATOR CONSOLE
            </p>
            <h2 className="pt-4 font-headline-lg tracking-tight text-white">
              One console for every camera, incident and unit.
            </h2>
            <ul className="flex flex-col gap-4 pt-6">
              {PILLARS.map((p) => (
                <li key={p.title} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-200">
                    <span className="material-symbols-outlined text-[20px]">{p.icon}</span>
                  </span>
                  <span>
                    <span className="block font-data-mono-md font-semibold text-white">{p.title}</span>
                    <span className="block font-body-sm text-slate-400">{p.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="relative font-data-mono-sm text-slate-500">
            AES-256 SESSION · NYC-METRO-01 · CHAIN-OF-CUSTODY SEALED
          </p>
        </div>

        {/* Form side */}
        <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md anim-fade-up">{children}</div>
        </div>
      </div>
    </div>
  );
}
