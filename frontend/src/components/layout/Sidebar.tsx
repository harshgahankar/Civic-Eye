import { NavLink } from 'react-router-dom';

const BRAND_IMG =
  'https://lh3.googleusercontent.com/aida/AEtjO1VFD_4BV2xF-ScePrH6xlFr52SaHp5DmcI5DH0cmCAKCT9i0zZNZbZnYkh_9mlqJcfgFxnjLV_SbKgY8Z7LNm1eZ6tT1KiscSqgvjrS-v5I9AscZKZlWaaloMvLfwInEtJqFBENgUsqDLnTYtps8T-o3VMoGuZAPBum6uwhAq6lpaM2ZBkbIDdYknIqa0ywq4C5j9fRymHOFd80SFsOkkoEwZBqzfh0Y6DSC9B2FSxJNNS3deNWc07_mBY';

const NAV = [
  { to: '/command-center', label: 'Command Center', icon: 'dashboard' },
  { to: '/cameras', label: 'Live Cameras', icon: 'videocam' },
  { to: '/incidents', label: 'Incidents', icon: 'warning' },
  { to: '/map', label: 'City Map', icon: 'explore' },
  { to: '/analytics', label: 'Analytics', icon: 'query_stats' },
  { to: '/emergency', label: 'Emergency', icon: 'notifications_active' },
];

const TELEMETRY = ['VISION', 'TRACKING', 'ALERT', 'DATABASE'];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 w-[280px] h-screen bg-primary-container z-50 flex flex-col justify-between border-r border-outline/20">
      <div>
        <div className="flex items-center gap-space-sm px-space-lg pt-space-lg pb-space-md">
          <img src={BRAND_IMG} alt="CivicEye mark" className="w-10 h-10 rounded-sm object-cover" />
          <div>
            <h1 className="font-headline-md text-on-primary tracking-wide">CIVICEYE</h1>
            <p className="font-label-caps text-secondary-fixed-dim">
              AI-POWERED PUBLIC SAFETY INTELLIGENCE
            </p>
          </div>
        </div>
        <p className="px-space-lg font-data-mono-sm text-on-primary-container">
          MONITOR · DETECT · RESPOND
        </p>
        <nav className="mt-space-lg px-space-sm">
          <p className="px-space-sm pb-space-sm font-label-caps text-on-primary-container">
            Tactical Routing
          </p>
          <ul className="flex flex-col gap-1">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  className={({ isActive }) =>
                    `flex items-center gap-space-sm px-space-sm py-space-sm font-data-mono-md border-l-2 transition-colors ${
                      isActive
                        ? 'bg-secondary text-on-primary border-secondary-fixed font-semibold'
                        : 'text-on-primary-container border-transparent hover:bg-secondary/40'
                    }`
                  }
                >
                  <span className="material-symbols-outlined text-lg">{n.icon}</span>
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="px-space-lg pb-space-lg">
        <p className="font-label-caps text-on-primary-container pb-space-sm">SYSTEM STATUS</p>
        <ul className="flex flex-col gap-1">
          {TELEMETRY.map((t) => (
            <li
              key={t}
              className="flex items-center justify-between font-data-mono-sm text-secondary-fixed"
            >
              <span>{t}</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                ONLINE
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-space-md flex items-center justify-between border-t border-outline/20 pt-space-sm font-data-mono-sm text-on-primary-container">
          <span>LATENCY 18ms</span>
          <span>CLUSTER NYC-METRO-01</span>
        </div>
      </div>
    </aside>
  );
}
