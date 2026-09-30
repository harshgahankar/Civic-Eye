import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="lg:pl-[280px]">
        <Header onMenu={() => setMobileOpen(true)} />
        <main className="relative w-full pt-16 min-h-screen">
          <div className="page">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
