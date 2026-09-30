import { useEffect, useState } from 'react';

const AVATAR_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBvYQwD7m2K9x4pL0nN8sT1cR5eW7qZ3hJ6kF9dG2aS5fH8jK1lZ4xC7vB0nM3qW6eR9tY2uI5oP8aS1dF4gH7jK0l';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Header() {
  const now = useClock();
  const utc = now.toISOString().substring(11, 19);
  const est = new Date(now.getTime() - 5 * 3600 * 1000).toISOString().substring(11, 19);

  return (
    <header className="fixed top-0 left-[280px] right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-md border-b border-outline-variant z-40 flex items-center justify-between px-space-lg">
      <div className="flex items-center gap-space-md">
        <h2 className="font-headline-md text-on-surface">CITY SAFETY</h2>
        <span className="font-body-md italic text-on-surface-variant">// Real-Time Intelligence</span>
        <span className="font-label-caps bg-secondary text-on-primary px-space-sm py-1 rounded-full">
          ARCHIVAL ACTIVE
        </span>
      </div>
      <div className="flex items-center gap-space-md">
        <input
          aria-label="LOC_QUERY"
          placeholder="LOC_QUERY — search sector / camera / unit…"
          className="w-64 px-space-sm py-1.5 font-data-mono-sm bg-surface-container border border-outline-variant rounded-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-secondary"
        />
        <div className="font-data-mono-sm text-on-surface-variant text-right leading-tight">
          <div>UTC {utc}</div>
          <div>EST {est}</div>
        </div>
        <button aria-label="notifications" className="relative p-2 rounded-full hover:bg-surface-container">
          <span className="material-symbols-outlined text-on-surface">notifications</span>
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-error" />
        </button>
        <div className="flex items-center gap-space-sm">
          <div className="text-right leading-tight">
            <p className="font-data-mono-md text-on-surface">DIR. M. VANCE</p>
            <p className="font-label-caps text-on-surface-variant">WATCH COMMANDER</p>
          </div>
          <img src={AVATAR_IMG} alt="Watch commander avatar" className="w-9 h-9 rounded-full object-cover border border-outline-variant" />
        </div>
      </div>
    </header>
  );
}
