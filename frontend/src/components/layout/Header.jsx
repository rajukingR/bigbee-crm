import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LuSearch, LuBell, LuMenu, LuUser, LuLogOut, LuCheckCheck } from 'react-icons/lu';
import api, { fileUrl } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { PAGE_TITLES } from '../../config/menu';
import { fmtDateTime, initials } from '../../utils/format';

function useOutside(ref, cb) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && cb();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

export default function Header({ onMenu, title }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [notifs, setNotifs] = useState({ data: [], unread: 0 });
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  useOutside(searchRef, () => setShowResults(false));
  useOutside(notifRef, () => setShowNotifs(false));
  useOutside(profileRef, () => setShowProfile(false));

  const pageTitle = title || (PAGE_TITLES.find(([p]) => location.pathname.startsWith(p)) || [null, 'Dashboard'])[1];
  const firstName = (user?.full_name || '').split(' ')[0];

  const loadNotifs = () =>
    api
      .get('/notifications', { params: { limit: 15 } })
      .then((r) => setNotifs(r.data))
      .catch(() => {});

  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const t = setTimeout(() => {
      api
        .get('/search', { params: { q } })
        .then((r) => {
          setResults(r.data);
          setShowResults(true);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const openNotif = async (n) => {
    if (!n.is_read) await api.put(`/notifications/${n.id}/read`).catch(() => {});
    setShowNotifs(false);
    loadNotifs();
    if (n.link) navigate(n.link);
  };

  return (
    <header className="sticky top-0 z-20 flex h-[74px] items-center gap-3 border-b border-line bg-white px-4 sm:px-7">
      <button className="text-slate-600 lg:hidden" onClick={onMenu} aria-label="Open menu">
        <LuMenu size={22} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-bold leading-tight text-ink">{pageTitle}</h1>
        <p className="truncate text-[13px] text-slate-500">
          Hello {firstName}, welcome back! ({user?.role_name || (user?.is_super_admin ? 'Admin' : 'User')})
        </p>
      </div>

      {/* Global search */}
      <div ref={searchRef} className="relative hidden md:block">
        <LuSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setShowResults(true)}
          placeholder="Search anything"
          className="w-56 rounded-md border border-line bg-slate-50 py-2 pl-9 pr-3 text-[13px] placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none lg:w-60"
        />
        {showResults && (
          <div className="absolute right-0 mt-2 max-h-96 w-96 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lg">
            {results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">No matches</div>
            ) : (
              results.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => {
                    setShowResults(false);
                    setQ('');
                    navigate(r.link);
                  }}
                  className="flex w-full items-start gap-3 px-4 py-2 text-left hover:bg-slate-50"
                >
                  <span className="mt-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand">{r.type}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{r.title}</span>
                    {r.subtitle && <span className="block truncate text-xs text-slate-500">{r.subtitle}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Notifications */}
      <div ref={notifRef} className="relative">
        <button className="relative rounded-md p-2 text-slate-700 hover:bg-slate-50" onClick={() => setShowNotifs((s) => !s)} aria-label="Notifications">
          <LuBell size={20} />
          {notifs.unread > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {notifs.unread > 99 ? '99+' : notifs.unread}
            </span>
          )}
        </button>
        {showNotifs && (
          <div className="absolute right-0 mt-2 w-[340px] rounded-lg border border-line bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              <button
                className="flex items-center gap-1 text-xs text-brand"
                onClick={() => api.put('/notifications/read-all').then(loadNotifs)}
              >
                <LuCheckCheck size={14} /> Mark all read
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifs.data.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-500">You're all caught up</div>}
              {notifs.data.map((n) => (
                <button key={n.id} onClick={() => openNotif(n)} className={`block w-full border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${n.is_read ? '' : 'bg-brand-50/50'}`}>
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink">{n.title}</div>
                      {n.message && <div className="line-clamp-2 text-xs text-slate-500">{n.message}</div>}
                      <div className="mt-0.5 text-[11px] text-slate-400">{fmtDateTime(n.created_at)}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Link to="/notifications" onClick={() => setShowNotifs(false)} className="block border-t border-line py-2.5 text-center text-xs font-medium text-brand">
              View all
            </Link>
          </div>
        )}
      </div>

      <div className="hidden h-8 w-px bg-line sm:block" />

      {/* Profile */}
      <div ref={profileRef} className="relative">
        <button className="flex items-center gap-2.5" onClick={() => setShowProfile((s) => !s)}>
          {user?.photo ? (
            <img src={fileUrl(user.photo)} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">{initials(user?.full_name).slice(0, 1)}</span>
          )}
          <span className="hidden text-sm font-semibold text-ink sm:block">{firstName}</span>
        </button>
        {showProfile && (
          <div className="absolute right-0 mt-2 w-52 rounded-lg border border-line bg-white py-1 shadow-lg">
            <div className="border-b border-line px-4 py-2.5">
              <div className="truncate text-sm font-semibold">{user?.full_name}</div>
              <div className="truncate text-xs text-slate-500">{user?.email}</div>
            </div>
            <Link to="/profile" onClick={() => setShowProfile(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-50">
              <LuUser size={15} /> My Profile
            </Link>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-slate-50"
            >
              <LuLogOut size={15} /> Log Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
