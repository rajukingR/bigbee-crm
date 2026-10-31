import { Link, useNavigate } from 'react-router-dom';
import { LuPlus, LuArrowUpRight, LuBell, LuCheckCheck } from 'react-icons/lu';
import api from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import ProgressBar from '../common/ProgressBar';
import { fmtDateTime } from '../../utils/format';

/** White card with title + optional "View all" link. */
export function Panel({ title, to, linkText = 'View all', children, className = '', right }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="card-title">{title}</h3>
        {right}
        {to && (
          <Link to={to} className="rounded bg-brand px-3 py-1 text-[12px] font-medium text-white">
            {linkText}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

/** Rows of { key, title, sub, right, rightClass, to }. */
export function ListRows({ rows, empty = 'Nothing here' }) {
  const navigate = useNavigate();
  if (!rows.length) return <div className="py-6 text-center text-sm text-slate-400">{empty}</div>;
  return (
    <div className="divide-y divide-line">
      {rows.map((r) => (
        <button key={r.key} onClick={() => r.to && navigate(r.to)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-slate-50">
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-medium text-ink">{r.title}</span>
            {r.sub && <span className="block truncate text-xs text-slate-500">{r.sub}</span>}
          </span>
          {r.right !== undefined && <span className={`shrink-0 text-right text-xs ${r.rightClass || 'text-slate-500'}`}>{r.right}</span>}
        </button>
      ))}
    </div>
  );
}

/** Horizontal bar list – data: [{ label, value, color? }] */
export function Bars({ data, format = (v) => v, color = 'bg-brand' }) {
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0));
  if (!data.length) return <div className="py-6 text-center text-sm text-slate-400">No data yet</div>;
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex justify-between text-[12px]">
            <span className="text-ink">{d.label}</span>
            <span className="font-medium text-ink">{format(d.value)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-2 rounded-full ${d.color ? '' : color}`} style={{ width: `${((Number(d.value) || 0) / max) * 100}%`, background: d.color || undefined }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Target style progress row like the reference "BD Target" card. */
export function ProgressRow({ label, value, pct, color }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div>
      <div className="flex justify-between text-[12px] font-medium text-ink">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <ProgressBar value={p} color={color} className="mt-1" />
      <div className="mt-1.5 text-[11px] text-slate-500">{p.toFixed(1).replace(/\.0$/, '')}%</div>
    </div>
  );
}

/** Simple table – cols: [[label, (row) => node, align?]] */
export function MiniTable({ cols, rows, empty = 'No records', rowKey = 'id' }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead className="border-b border-line">
          <tr>{cols.map(([l, , a]) => <th key={l} className={`table-head ${a === 'right' ? 'text-right' : ''}`}>{l}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={cols.length} className="py-6 text-center text-sm text-slate-400">{empty}</td></tr>}
          {rows.map((r, i) => (
            <tr key={r[rowKey] ?? i} className="border-b border-line last:border-0">
              {cols.map(([l, fn, a]) => <td key={l} className={`table-cell ${a === 'right' ? 'text-right' : ''}`}>{fn(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Quick actions card (reference design). actions: [{ title, sub, to, module, action, icon? }] */
export function QuickActions({ actions }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const list = actions.filter((a) => !a.module || can(a.module, a.action || 'view')).slice(0, 4);
  return (
    <div className="card p-5">
      <h3 className="card-title mb-5">Quick Actions</h3>
      <div className="space-y-5">
        {list.map((a) => {
          const Icon = a.icon || (a.action === 'create' ? LuPlus : LuArrowUpRight);
          return (
            <button key={a.title} onClick={() => navigate(a.to)} className="flex w-full items-center gap-3 px-3 text-left">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand text-white">
                <Icon size={15} />
              </span>
              <span>
                <span className="block text-[14px] font-medium text-ink">{a.title}</span>
                <span className="block text-[12px] text-slate-500">{a.sub}</span>
              </span>
            </button>
          );
        })}
        {list.length === 0 && <div className="text-sm text-slate-400">No quick actions for your role</div>}
      </div>
    </div>
  );
}

/** The logged-in user's own latest notifications (messages). */
export function NotificationsPanel({ limit = 6 }) {
  const navigate = useNavigate();
  const { data, reload } = useFetch('/notifications', { limit });
  const rows = (data && data.data) || [];
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="card-title flex items-center gap-2">
          <LuBell size={17} /> My Notifications
          {data && data.unread > 0 && <span className="rounded-full bg-red-600 px-2 text-[11px] font-semibold text-white">{data.unread}</span>}
        </h3>
        <div className="flex items-center gap-3">
          {data && data.unread > 0 && (
            <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand" onClick={() => api.put('/notifications/read-all').then(reload)}>
              <LuCheckCheck size={13} /> Mark read
            </button>
          )}
          <Link to="/notifications" className="text-[12px] text-brand">View all</Link>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-400">You're all caught up</div>
      ) : (
        <div className="divide-y divide-line">
          {rows.map((n) => (
            <button
              key={n.id}
              onClick={async () => {
                if (!n.is_read) await api.put(`/notifications/${n.id}/read`).catch(() => {});
                if (n.link) navigate(n.link);
                else reload();
              }}
              className="flex w-full items-start gap-2.5 py-2.5 text-left hover:bg-slate-50"
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-slate-200' : 'bg-brand'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{n.title}</span>
                {n.message && <span className="block truncate text-xs text-slate-500">{n.message}</span>}
              </span>
              <span className="shrink-0 text-[11px] text-slate-400">{fmtDateTime(n.created_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
