const STRIP = [
  { k: 'INGEST', v: '24 STREAMS · 30FPS', icon: 'sensors' },
  { k: 'INFERENCE', v: 'YOLOv8 + TRACKER', icon: 'psychology' },
  { k: 'THROUGHPUT', v: '1.2 GB/S', icon: 'speed' },
  { k: 'UPTIME', v: '99.98%', icon: 'verified' },
];

export function SystemStatus() {
  return (
    <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-primary-container px-5 py-3.5 font-data-mono-sm text-slate-300 shadow-card">
      <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
        <span className="relative flex h-2 w-2">
          <span className="absolute h-full w-full rounded-full bg-emerald-400 animate-ping opacity-60" />
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        ALL SYSTEMS NOMINAL
      </span>
      {STRIP.map((s) => (
        <span key={s.k} className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-slate-400">{s.icon}</span>
          <span className="text-slate-400">{s.k}:</span> <strong className="text-white">{s.v}</strong>
        </span>
      ))}
      <span className="ml-auto hidden sm:inline text-slate-400">NYC-METRO-01</span>
    </footer>
  );
}

export default SystemStatus;
