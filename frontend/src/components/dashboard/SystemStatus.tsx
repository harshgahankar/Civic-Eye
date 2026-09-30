import { useEffect, useState } from 'react';
import { backend, type BackendSnapshot } from '../../services/backend';

export function SystemStatus() {
  const [snap, setSnap] = useState<BackendSnapshot | null>(null);

  useEffect(() => {
    let live = true;
    backend.snapshot().then((s) => { if (live) setSnap(s); }).catch(() => {});
    return () => { live = false; };
  }, []);

  const strip = snap
    ? [
        { k: 'INCIDENTS', v: `${snap.active_incidents} ACTIVE`, icon: 'sensors' },
        { k: 'SEVERITY', v: `${snap.critical_incidents} CRIT · ${snap.high_incidents} HIGH`, icon: 'psychology' },
        { k: 'CAMERAS', v: `${snap.cameras_online} UP · ${snap.cameras_offline} DOWN`, icon: 'speed' },
      ]
    : [
        { k: 'BACKEND', v: 'CONNECTING…', icon: 'sensors' },
      ];

  return (
    <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-primary-container px-5 py-3.5 font-data-mono-sm text-slate-300 shadow-card">
      <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
        <span className="relative flex h-2 w-2">
          <span className="absolute h-full w-full rounded-full bg-emerald-400 animate-ping opacity-60" />
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        {snap ? 'LIVE FROM BACKEND' : 'CONNECTING'}
      </span>
      {strip.map((s) => (
        <span key={s.k} className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-slate-400">{s.icon}</span>
          <span className="text-slate-400">{s.k}:</span> <strong className="text-white">{s.v}</strong>
        </span>
      ))}
      <span className="ml-auto hidden sm:inline text-slate-400">LIVE GRID</span>
    </footer>
  );
}

export default SystemStatus;
