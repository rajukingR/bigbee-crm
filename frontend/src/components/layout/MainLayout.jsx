import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MasterSidebar from './MasterSidebar';
import Header from './Header';

/** App shell: dark sidebar + white header, matching the Bigbee reference design. */
export default function MainLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isMaster = location.pathname.startsWith('/masters');
  const SideNav = isMaster ? MasterSidebar : Sidebar;

  return (
    <div className="flex h-screen overflow-hidden bg-page">
      <SideNav open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenu={() => setOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className={isMaster ? 'p-4 sm:p-4' : 'p-4 sm:p-7 lg:p-10'}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
