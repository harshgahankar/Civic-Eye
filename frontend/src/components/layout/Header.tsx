import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import GlobalSearch from './GlobalSearch';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const ROUTES: { match: RegExp; title: string; crumb: string; icon: string }[] = [
  { match: /^\/command-center/, title: 'Command Center', crumb: 'City overview', icon: 'dashboard' },
  { match: /^\/(cameras|live-cameras)/, title: 'Live Cameras', crumb: 'CCTV wall · 24 feeds', icon: 'videocam' },
  { match: /^\/incidents\/.+/, title: 'Incident Dossier', crumb: 'Case file', icon: 'folder_open' },
  { match: /^\/analytics/, title: 'Analytics', crumb: 'Trends & KPIs', icon: 'query_stats' },
  { match: /^\/(emergency|alerts)/, title: 'Emergency', crumb: 'Dispatch ops', icon: 'notifications_active' },
  { match: /^\/tracking/, title: 'Multi-Camera Tracking', crumb: 'Subject trails', icon: 'route' },
  { match: /^\/settings/, title: 'Settings', crumb: 'Console prefs', icon: 'settings' },
];

function useRouteMeta() {
  const { pathname } = useLocation();
  return ROUTES.find((r) => r.match.test(pathname)) ?? { title: 'Console', crumb: 'CivicEye', icon: 'dashboard' };
}

interface Alert {
  id: string;
  title: string;
  meta: string;
  severity: 'critical' | 'high' | 'medium';
  time: string;
}

const INITIAL_ALERTS: Alert[] = [
  { id: 'ALR-8842', title: 'Multi-vehicle collision — Junction A', meta: 'CAM-07 · conf 94.2%', severity: 'critical', time: '2m' },
  { id: 'ALR-8841', title: 'Crowd surge — Metro Central', meta: 'CAM-04 · density +34%', severity: 'high', time: '7m' },
  { id: 'ALR-8839', title: 'Unattended bag — Station Gate 2', meta: 'CAM-12 · dwell 07:18', severity: 'medium', time: '12m' },
];

const sevDot: Record<Alert['severity'], string> = {
  critical: 'bg-error',
  high: 'bg-amber-500',
  medium: 'bg-secondary',
};

export default function Header({ onMenu, sidebarCollapsed = false }: { onMenu?: () => void; sidebarCollapsed?: boolean }) {
  const now = useClock();
  const meta = useRouteMeta();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const authUser = useAuthStore((s) => s.user);
  const displayName = (authUser?.name ?? 'DIR. M. VANCE').toUpperCase();
  const displayRole = (authUser?.role ?? 'WATCH COMMANDER').toUpperCase();
  const initials = displayName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000).toISOString().substring(11, 19);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const [scrolled, setScrolled] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const alertsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!alertsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) setAlertsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAlertsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [alertsOpen]);

  const unread = alerts.filter((a) => !readIds.has(a.id)).length;

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-40 border-b border-outline-variant bg-surface-container-lowest/85 backdrop-blur-md transition-[left,box-shadow] duration-300 ${
        sidebarCollapsed ? 'lg:left-[84px]' : 'lg:left-[280px]'
      } ${scrolled ? 'shadow-card' : ''}`}
    >
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        {/* Left: menu + route identity */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open menu"
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition lg:hidden"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="hidden h-9 w-9 items-center justify-center rounded-xl bg-primary-container text-blue-200 sm:flex shrink-0">
            <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-label-caps text-on-surface-variant">
              CONSOLE <span className="text-outline">/</span> {meta.crumb.toUpperCase()}
            </p>
            <h1 className="truncate font-headline-md text-[19px] text-on-surface tracking-tight">{meta.title}</h1>
          </div>
          <span className="ml-1 hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-label-caps text-emerald-700 md:inline-flex shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
          </span>
        </div>

        {/* Center: search */}
        <div className="hidden min-w-0 flex-1 max-w-md md:block">
          <GlobalSearch id="global-search" showHint />
        </div>

        {/* Right cluster */}
        <div className="flex flex-1 items-center justify-end gap-1 sm:gap-2 md:flex-none">
          <button
            type="button"
            aria-label="Search"
            onClick={() => setMobileSearch((v) => !v)}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition md:hidden"
          >
            <span className="material-symbols-outlined">search</span>
          </button>
          <div className="hidden items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-data-mono-sm tabular-nums text-on-surface-variant xl:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute h-full w-full rounded-full bg-emerald-500 animate-ping opacity-60" />
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span><strong className="font-semibold text-on-surface">IST</strong> {ist}</span>
          </div>

          {/* Notifications */}
          <div ref={alertsRef} className="relative">
            <button
              type="button"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              aria-expanded={alertsOpen}
              onClick={() => setAlertsOpen((v) => !v)}
              className={`relative rounded-xl p-2 transition ${
                alertsOpen ? 'bg-blue-50 text-secondary' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined">notifications</span>
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 font-data-mono-sm font-bold text-white ring-2 ring-surface-container-lowest">
                  {unread}
                </span>
              )}
            </button>
            {alertsOpen && (
              <div className="absolute right-0 top-full mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-pop anim-scale-in">
                <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
                  <p className="font-data-mono-md font-semibold text-on-surface">Notifications</p>
                  <button
                    type="button"
                    onClick={() => setReadIds(new Set(alerts.map((a) => a.id)))}
                    className="font-label-caps text-secondary hover:text-blue-800 transition"
                  >
                    MARK ALL READ
                  </button>
                </div>
                <ul className="max-h-80 overflow-y-auto">
                  {alerts.map((a) => {
                    const read = readIds.has(a.id);
                    return (
                      <li key={a.id}>
                        <Link
                          to="/emergency"
                          onClick={() => {
                            setReadIds((p) => new Set(p).add(a.id));
                            setAlertsOpen(false);
                          }}
                          className={`flex gap-3 px-4 py-3 transition hover:bg-surface-container-low ${read ? 'opacity-60' : ''}`}
                        >
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sevDot[a.severity]}`} />
                          <span className="min-w-0">
                            <span className="block truncate font-body-md font-semibold text-on-surface">{a.title}</span>
                            <span className="block truncate font-data-mono-sm text-on-surface-variant">{a.meta}</span>
                          </span>
                          <span className="ml-auto shrink-0 font-data-mono-sm text-on-surface-variant">{a.time}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                <Link
                  to="/emergency"
                  onClick={() => setAlertsOpen(false)}
                  className="block border-t border-outline-variant bg-surface-container-low/60 px-4 py-2.5 text-center font-label-caps text-secondary hover:bg-surface-container-low transition"
                >
                  VIEW ALL ALERTS →
                </Link>
              </div>
            )}
          </div>

          <span className="mx-1 hidden h-8 w-px bg-outline-variant sm:block" />

          {/* User */}
          <button type="button" className="hidden items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition hover:bg-surface-container-low sm:flex" aria-label={`Account: ${displayName}, ${displayRole}`}>
            <span className="relative">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-blue-800 font-data-mono-sm font-bold text-white">{initials}</span>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-surface-container-lowest" />
            </span>
            <span className="hidden text-left leading-tight lg:block">
              <span className="block max-w-[140px] truncate font-data-mono-sm font-bold text-on-surface">{displayName}</span>
              <span className="block max-w-[140px] truncate font-label-caps text-on-surface-variant">{displayRole}</span>
            </span>
          </button>
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
            className="rounded-xl p-2 text-on-surface-variant hover:bg-red-50 hover:text-error transition"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </div>

      {/* Mobile search row */}
      {mobileSearch && (
        <div className="border-t border-outline-variant px-3 py-2 anim-fade-up md:hidden">
          <GlobalSearch autoFocus onNavigate={() => setMobileSearch(false)} />
        </div>
      )}
    </header>
  );
}
