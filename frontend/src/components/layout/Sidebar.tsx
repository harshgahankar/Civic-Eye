import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/command-center', label: 'Command Center', icon: 'dashboard', desc: 'City overview' },
  { to: '/cameras', label: 'Live Cameras', icon: 'videocam', desc: '24 feeds' },
  { to: '/incidents', label: 'Incidents', icon: 'warning', desc: 'Active queue' },
  { to: '/map', label: 'City Map', icon: 'explore', desc: 'Geospatial' },
  { to: '/analytics', label: 'Analytics', icon: 'query_stats', desc: 'Trends & KPIs' },
  { to: '/emergency', label: 'Emergency', icon: 'notifications_active', desc: 'Dispatch' },
];

const TELEMETRY = ['VISION', 'TRACKING', 'ALERT', 'DATABASE'];

interface Props {
  mobileOpen?: boolean;
  onClose?: () => void;
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-secondary to-blue-800 shadow-pop shrink-0">
            <span className="material-symbols-outlined text-on-primary text-xl">visibility</span>
          </div>
          <div className="min-w-0">
            <h1 className="font-headline-md text-on-primary tracking-wide leading-none">CIVICEYE</h1>
            <p className="font-label-caps text-on-primary-container mt-1">PUBLIC SAFETY INTEL</p>
          </div>
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 font-data-mono-sm text-secondary-fixed">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          MONITOR · DETECT · RESPOND
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 font-label-caps text-on-primary-container">OPERATIONS</p>
        <ul className="flex flex-col gap-1">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all ${
                    isActive
                      ? 'bg-secondary text-on-primary shadow-pop'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 transition-colors ${
                        isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">{n.icon}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-data-mono-md font-semibold">{n.label}</span>
                      <span className={`block truncate font-data-mono-sm ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                        {n.desc}
                      </span>
                    </span>
                    {isActive && <span className="h-5 w-1 rounded-full bg-white/70" />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Telemetry */}
      <div className="px-3 pb-5">
        <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
          <div className="flex items-center justify-between pb-2">
            <p className="font-label-caps text-on-primary-container">SYSTEM STATUS</p>
            <span className="flex items-center gap-1 font-data-mono-sm text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {TELEMETRY.map((t) => (
              <li key={t} className="flex items-center justify-between font-data-mono-sm">
                <span className="text-slate-400">{t}</span>
                <span className="font-semibold text-slate-200">ONLINE</span>
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2.5 font-data-mono-sm text-slate-400">
            <span>18ms latency</span>
            <span>NYC-METRO-01</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ mobileOpen = false, onClose }: Props) {
  return (
    <>
      {/* Desktop */}
      <aside className="fixed left-0 top-0 hidden h-screen w-[280px] bg-primary-container z-50 lg:block shadow-pop">
        <SidebarBody />
      </aside>
      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-primary/60 backdrop-blur-sm anim-fade-up" onClick={onClose} />
          <aside className="absolute left-0 top-0 h-full w-[300px] bg-primary-container shadow-pop anim-scale-in">
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <SidebarBody onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
