import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCameras } from '../../hooks/useCameras';
import { useIncidents } from '../../hooks/useIncidents';
import { useUiStore } from '../../store/uiStore';

interface Hit {
  key: string;
  group: string;
  icon: string;
  title: string;
  sub: string;
  run: () => void;
}

const PAGES = [
  { title: 'Command Center', sub: 'City overview', icon: 'dashboard', to: '/command-center' },
  { title: 'Live Cameras', sub: 'CCTV wall', icon: 'videocam', to: '/cameras' },
  { title: 'Emergency Alerts', sub: 'Dispatch queue', icon: 'notifications_active', to: '/emergency' },
  { title: 'Analytics', sub: 'Performance ledger', icon: 'query_stats', to: '/analytics' },
  { title: 'Settings', sub: 'Console preferences', icon: 'settings', to: '/settings' },
];

const GROUP_ORDER = ['CAMERAS', 'INCIDENTS', 'PAGES'];

interface Props {
  id?: string;
  autoFocus?: boolean;
  showHint?: boolean;
  onNavigate?: () => void;
}

export default function GlobalSearch({ id, autoFocus = false, showHint = false, onNavigate }: Props) {
  const navigate = useNavigate();
  const query = useUiStore((s) => s.searchQuery);
  const setQuery = useUiStore((s) => s.setSearchQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const { cameras } = useCameras();
  const { incidents } = useIncidents();

  const go = (to: string) => {
    navigate(to);
    setOpen(false);
    onNavigate?.();
  };

  const hits: Hit[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (s: string) => s.toLowerCase().includes(q);
    if (!q) {
      return PAGES.map((p) => ({
        key: `page-${p.to}`,
        group: 'QUICK LINKS',
        icon: p.icon,
        title: p.title,
        sub: p.sub,
        run: () => go(p.to),
      }));
    }
    const out: Hit[] = [];
    cameras
      .filter((c) => match(`${c.id} ${c.name} ${c.location} ${c.area}`))
      .slice(0, 4)
      .forEach((c) =>
        out.push({
          key: `cam-${c.id}`,
          group: 'CAMERAS',
          icon: 'videocam',
          title: `${c.id} · ${c.name}`,
          sub: `${c.location} · ${c.area}`,
          run: () => {
            setQuery(c.id);
            go('/cameras');
          },
        }),
      );
    incidents
      .filter((i) => match(`${i.id} ${i.title}`))
      .slice(0, 4)
      .forEach((i) =>
        out.push({
          key: `inc-${i.id}`,
          group: 'INCIDENTS',
          icon: 'warning',
          title: `${i.id} · ${i.title}`,
          sub: `Severity ${i.severity.toUpperCase()}`,
          run: () => go(`/incidents/${i.id}`),
        }),
      );
    PAGES.filter((p) => match(`${p.title} ${p.sub}`)).forEach((p) =>
      out.push({
        key: `page-${p.to}`,
        group: 'PAGES',
        icon: p.icon,
        title: p.title,
        sub: p.sub,
        run: () => go(p.to),
      }),
    );
    return out;
  }, [query, navigate, setQuery, cameras, incidents]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open ]);

  const flat = hits;
  const choose = (index: number) => {
    const h = flat[index];
    if (h) h.run();
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <label className="relative block">
        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
          search
        </span>
        <input
          id={id}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={open}
          aria-controls={id ? `${id}-results` : undefined}
          aria-activedescendant={flat[active] ? `${flat[active].key}-opt` : undefined}
          aria-label="Search cameras, incidents, pages"
          placeholder="Search cameras, incidents…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => (flat.length === 0 ? 0 : (a + 1) % flat.length));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (flat.length === 0 ? 0 : (a - 1 + flat.length) % flat.length));
            } else if (e.key === 'Enter') {
              if (open && flat[active]) {
                e.preventDefault();
                choose(active);
              } else {
                navigate('/cameras');
                onNavigate?.();
              }
            } else if (e.key === 'Escape') {
              setQuery('');
              setOpen(false);
              e.currentTarget.blur();
            }
          }}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-low py-2 pl-10 pr-14 font-body-sm text-on-surface placeholder:text-on-surface-variant/60 transition focus:border-secondary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary/20"
        />
        {showHint && (
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-outline-variant bg-surface-container-lowest px-1.5 py-0.5 font-data-mono-sm text-on-surface-variant">
            ⌘K
          </kbd>
        )}
      </label>

      {open && (
        <div
          id={id ? `${id}-results` : undefined}
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-pop anim-scale-in"
        >
          {flat.length === 0 ? (
            <p className="px-4 py-5 text-center font-body-sm text-on-surface-variant">
              No matches for “{query.trim()}”. Try a camera ID or incident ID.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1.5">
              {GROUP_ORDER.concat('QUICK LINKS')
                .filter((g) => flat.some((h) => h.group === g))
                .map((g) => (
                  <div key={g}>
                    <p className="px-4 pb-1 pt-2 font-label-caps text-on-surface-variant">{g}</p>
                    <ul>
                      {flat.map((h, i) =>
                        h.group === g ? (
                          <li key={h.key}>
                            <button
                              type="button"
                              id={`${h.key}-opt`}
                              role="option"
                              aria-selected={i === active}
                              onMouseEnter={() => setActive(i)}
                              onClick={() => choose(i)}
                              className={`flex w-full items-center gap-2.5 px-4 py-2 text-left transition ${
                                i === active ? 'bg-blue-50' : ''
                              }`}
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-secondary">
                                <span className="material-symbols-outlined text-[18px]">{h.icon}</span>
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-body-sm font-semibold text-on-surface">{h.title}</span>
                                <span className="block truncate font-data-mono-sm text-on-surface-variant">{h.sub}</span>
                              </span>
                              {i === active && <span className="ml-auto font-data-mono-sm text-secondary">↵</span>}
                            </button>
                          </li>
                        ) : null,
                      )}
                    </ul>
                  </div>
                ))}
            </div>
          )}
          <p className="border-t border-outline-variant bg-surface-container-low/60 px-4 py-1.5 font-data-mono-sm text-on-surface-variant">
            ↑↓ NAVIGATE · ↵ OPEN · ESC CLEAR
          </p>
        </div>
      )}
    </div>
  );
}
