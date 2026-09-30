import { useEffect, useState } from 'react';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Header({ onMenu }: { onMenu?: () => void }) {
  const now = useClock();
  const utc = now.toISOString().substring(11, 19);
  const est = new Date(now.getTime() - 5 * 3600 * 1000).toISOString().substring(11, 19);

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[280px] h-16 bg-surface-container-lowest/85 backdrop-blur-md border-b border-outline-variant z-40">
      <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onMenu}
            aria-label="Open menu"
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low lg:hidden"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-headline-md text-on-surface tracking-tight">City Safety</h2>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-label-caps text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
              </span>
            </div>
            <p className="hidden md:block truncate font-body-sm text-on-surface-variant">Real-time public safety intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <label className="relative hidden md:block">
            <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">search</span>
            <input
              aria-label="Search"
              placeholder="Search sector, camera, unit…"
              className="w-56 lg:w-64 rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-9 pr-3 font-body-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-secondary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary/20 transition"
            />
          </label>
          <div className="hidden xl:flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-1.5 font-data-mono-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-secondary text-[18px]">schedule</span>
            <span><strong className="text-on-surface">UTC</strong> {utc}</span>
            <span className="text-outline">|</span>
            <span><strong className="text-on-surface">EST</strong> {est}</span>
          </div>
          <button aria-label="Notifications" className="relative rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="absolute h-full w-full rounded-full bg-error animate-ping opacity-60" />
              <span className="h-2 w-2 rounded-full bg-error ring-2 ring-white" />
            </span>
          </button>
          <div className="hidden sm:flex items-center gap-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest py-1 pl-3 pr-1.5">
            <div className="text-right leading-tight">
              <p className="font-data-mono-sm font-bold text-on-surface">DIR. M. VANCE</p>
              <p className="font-label-caps text-on-surface-variant">WATCH CMDR</p>
            </div>
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-blue-800 font-data-mono-sm font-bold text-white">MV</div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
