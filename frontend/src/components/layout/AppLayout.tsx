import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Toaster from '../common/Toaster';
import LiveAlertPopups from '../common/LiveAlertPopups';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />
      <div className={`transition-[padding] duration-300 ${collapsed ? 'lg:pl-[84px]' : 'lg:pl-[280px]'}`}>
        <Header onMenu={() => setMobileOpen(true)} sidebarCollapsed={collapsed} />
        <main className="relative w-full pt-16 min-h-screen">
          <div className="page">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster />
      <LiveAlertPopups />
    </div>
  );
}
