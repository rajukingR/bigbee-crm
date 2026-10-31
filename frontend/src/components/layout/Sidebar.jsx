import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LuChevronRight, LuChevronDown, LuSettings, LuLogOut, LuX } from 'react-icons/lu';
import { MAIN_MENU } from '../../config/menu';
import { useAuth } from '../../context/AuthContext';

const itemBase = 'flex items-center gap-3 rounded-md px-3 py-2.5 text-[13.5px] font-medium transition-colors';
const itemIdle = 'text-white hover:bg-white/5';
const itemActive = 'bg-brand text-white';

function allowed(can, module) {
  if (!module) return true;
  return Array.isArray(module) ? module.some((m) => can(m)) : can(module);
}

export default function Sidebar({ open, onClose }) {
  const { can, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState({});

  const menu = MAIN_MENU.map((m) => (m.children ? { ...m, children: m.children.filter((c) => allowed(can, c.module)) } : m)).filter(
    (m) => (m.children ? m.children.length > 0 : allowed(can, m.module))
  );

  // Auto-expand the group that contains the current page
  useEffect(() => {
    menu.forEach((m) => {
      if (m.children && m.children.some((c) => location.pathname.startsWith(c.path))) {
        setExpanded((e) => ({ ...e, [m.label]: true }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const isChildActive = (path) => {
    // exact section match so /vendors does not light up /vendors/bills
    const others = menu.flatMap((m) => (m.children ? m.children.map((c) => c.path) : [m.path]));
    const longer = others.filter((p) => p !== path && p.startsWith(path) && location.pathname.startsWith(p));
    return location.pathname.startsWith(path) && longer.length === 0;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col bg-sidebar transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 pb-6 pt-7">
          <span className="text-[22px] font-bold tracking-wide text-white">BIGBEE</span>
          <button className="text-white lg:hidden" onClick={onClose} aria-label="Close menu">
            <LuX size={20} />
          </button>
        </div>

        <div className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Main CRM Modules</div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          {menu.map((m) => {
            const Icon = m.icon;
            if (!m.children) {
              return (
                <NavLink key={m.path} to={m.path} onClick={onClose} className={({ isActive }) => `${itemBase} ${isActive ? itemActive : itemIdle}`}>
                  <Icon size={18} className="shrink-0" />
                  <span>{m.label}</span>
                </NavLink>
              );
            }
            const groupActive = m.children.some((c) => location.pathname.startsWith(c.path));
            const isOpen = expanded[m.label];
            return (
              <div key={m.label}>
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [m.label]: !e[m.label] }))}
                  className={`${itemBase} w-full text-left ${groupActive && !isOpen ? itemActive : itemIdle}`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="flex-1 leading-tight">{m.label}</span>
                  {isOpen ? <LuChevronDown size={15} /> : <LuChevronRight size={15} />}
                </button>
                {isOpen && (
                  <div className="ml-[22px] mt-1 space-y-0.5 border-l border-white/10 pl-3">
                    {m.children.map((c) => (
                      <NavLink
                        key={c.path}
                        to={c.path}
                        onClick={onClose}
                        className={`block rounded-md px-3 py-2 text-[13px] font-medium ${
                          isChildActive(c.path) ? 'bg-brand text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        {c.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="space-y-1 px-4 pb-6 pt-2">
          {['employees', 'roles', 'permissions', 'departments', 'masters'].some((m) => can(m)) && (
            <NavLink to="/masters" onClick={onClose} className={({ isActive }) => `${itemBase} ${isActive ? itemActive : itemIdle}`}>
              <LuSettings size={18} />
              <span>Masters</span>
            </NavLink>
          )}
          <button type="button" onClick={handleLogout} className={`${itemBase} ${itemIdle} w-full`}>
            <LuLogOut size={18} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
