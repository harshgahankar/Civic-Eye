import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function AppLayout() {
  return (
    <div>
      <Sidebar />
      <div className="pl-[280px]">
        <Header />
        <main className="relative w-full pt-16 bg-surface min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
