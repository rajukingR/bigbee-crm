import { NavLink, useNavigate } from 'react-router-dom';
import { LuLogIn, LuSettings, LuLogOut, LuX } from 'react-icons/lu';
import { MASTER_MENU } from '../../config/menu';
import { useAuth } from '../../context/AuthContext';

const itemBase = 'flex items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] font-medium transition-colors';

export default function MasterSidebar({ open, onClose }) {
  const { can, logout } = useAuth();
  const navigate = useNavigate();
  const items = MASTER_MENU.filter((m) => can(m.module));

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col bg-sidebar transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 pb-5 pt-7">
          <span className="text-[22px] font-bold tracking-wide text-white">BIGBEE</span>
          <button className="text-white lg:hidden" onClick={onClose} aria-label="Close menu">
            <LuX size={20} />
          </button>
        </div>

        <div className="px-4 pb-4">
          <button type="button" onClick={() => navigate('/dashboard')} className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-[13.5px] font-medium text-white hover:bg-brand-600">
            <LuLogIn size={16} className="rotate-180" />
            Exit Master
          </button>
        </div>

        <div className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Masters</div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          {items.map((m) => {
            const Icon = m.icon;
            return (
              <NavLink
                key={m.path}
                to={m.path}
                onClick={onClose}
                className={({ isActive }) => `${itemBase} ${isActive ? 'bg-brand text-white' : 'text-white hover:bg-white/5'}`}
              >
                <Icon size={18} className="shrink-0" />
                <span>{m.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="space-y-1 px-4 pb-6 pt-2">
          <NavLink to="/masters" end className={`${itemBase} text-white hover:bg-white/5`}>
            <LuSettings size={18} />
            <span>Masters</span>
          </NavLink>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className={`${itemBase} w-full text-white hover:bg-white/5`}
          >
            <LuLogOut size={18} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
