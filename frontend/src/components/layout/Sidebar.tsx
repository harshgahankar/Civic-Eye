import { NavLink } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  desc: string;
  badge?: string;
  alert?: boolean;
}

const OPERATIONS: NavItem[] = [
  { to: '/command-center', label: 'Command Center', icon: 'dashboard', desc: 'City overview' },
  { to: '/cameras', label: 'Live Cameras', icon: 'videocam', desc: '24 feeds' },
  { to: '/analytics', label: 'Analytics', icon: 'query_stats', desc: 'Trends & KPIs' },
  { to: '/emergency', label: 'Emergency', icon: 'notifications_active', desc: 'Dispatch', badge: '1', alert: true },
];

interface Props {
  mobileOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

function NavGroup({
  title,
  items,
  collapsed,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div>
      {!collapsed && <p className="px-3 pb-1.5 pt-3 font-label-caps text-on-primary-container first:pt-0">{title}</p>}
      {collapsed && <div className="mx-3 mb-1.5 border-t border-white/10 first:hidden" />}
      <ul className="flex flex-col gap-1">
        {items.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              onClick={onNavigate}
              title={collapsed ? n.label : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl transition-all ${
                  collapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-2'
                } ${
                  isActive
                    ? 'bg-secondary text-on-primary shadow-pop'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`relative flex h-9 w-9 items-center justify-center rounded-lg shrink-0 transition-colors ${
                      isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{n.icon}</span>
                    {collapsed && n.badge && (
                      <span
                        className={`absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 font-data-mono-sm font-bold ${
                          n.alert ? 'bg-error text-white' : 'bg-secondary-fixed text-on-secondary-fixed'
                        }`}
                      >
                        {n.badge}
                      </span>
                    )}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-data-mono-md font-semibold">{n.label}</span>
                        <span className={`block truncate font-data-mono-sm ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                          {n.desc}
                        </span>
                      </span>
                      {n.badge && (
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 font-data-mono-sm font-bold ${
                            n.alert ? 'bg-error text-white' : isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-200'
                          }`}
                        >
                          {n.badge}
                        </span>
                      )}
                      {isActive && !n.badge && <span className="h-5 w-1 shrink-0 rounded-full bg-white/70" />}
                    </>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidebarBody({
  collapsed,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={`border-b border-white/10 pb-4 pt-5 ${collapsed ? 'px-0' : 'px-4'}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-secondary to-blue-800 shadow-pop shrink-0">
            <span className="material-symbols-outlined text-on-primary text-xl">visibility</span>
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <h1 className="font-headline-md text-on-primary tracking-wide leading-none">CIVICEYE</h1>
              <p className="font-label-caps text-on-primary-container mt-1">PUBLIC SAFETY INTEL</p>
            </div>
          )}
          {!collapsed && onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse sidebar"
              className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition lg:block"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
          )}
        </div>
        {collapsed && onToggle && (
          <div className="hidden justify-center pt-3 lg:flex">
            <button
              type="button"
              onClick={onToggle}
              aria-label="Expand sidebar"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        )}
        {!collapsed && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-2.5 py-1 font-data-mono-sm text-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            MONITOR · DETECT · RESPOND
          </p>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto py-3 ${collapsed ? 'px-2' : 'px-3'} pb-2`} aria-label="Primary">
        <NavGroup title="OPERATIONS" items={OPERATIONS} collapsed={collapsed} onNavigate={onNavigate} />
      </nav>

      {/* Bottom: settings */}
      <div className={collapsed ? 'px-2 pb-4' : 'px-3 pb-4'}>
        <div className="border-t border-white/10 pt-3">
          <NavLink
            to="/settings"
            onClick={onNavigate}
            title={collapsed ? 'Settings' : undefined}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-xl transition-all ${
                collapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-2'
              } ${
                isActive
                  ? 'bg-secondary text-on-primary shadow-pop'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 transition-colors ${
                    isActive ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">settings</span>
                </span>
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-data-mono-md font-semibold">Settings</span>
                      <span className={`block truncate font-data-mono-sm ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                        Console prefs
                      </span>
                    </span>
                    {isActive && <span className="h-5 w-1 shrink-0 rounded-full bg-white/70" />}
                  </>
                )}
              </>
            )}
          </NavLink>
          {!collapsed && (
            <p className="pt-3 text-center font-data-mono-sm text-slate-500">CIVICEYE v4.2 · BUILD 90218</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ mobileOpen = false, onClose, collapsed = false, onToggle }: Props) {
  return (
    <>
      {/* Desktop */}
      <aside
        className={`fixed left-0 top-0 hidden h-screen bg-primary-container z-50 lg:block shadow-pop transition-[width] duration-300 ${
          collapsed ? 'w-[84px]' : 'w-[280px]'
        }`}
      >
        <SidebarBody collapsed={collapsed} onToggle={onToggle} />
      </aside>
      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-primary/60 backdrop-blur-sm anim-fade-up" onClick={onClose} />
          <aside className="absolute left-0 top-0 h-full w-[300px] bg-primary-container shadow-pop anim-scale-in overflow-y-auto">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <SidebarBody collapsed={false} onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
