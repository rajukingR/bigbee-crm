import { useNavigate } from 'react-router-dom';
import { LuCheckCheck } from 'react-icons/lu';
import api from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import Loader from '../../components/common/Loader';
import EmptyState from '../../components/common/EmptyState';
import { fmtDateTime } from '../../utils/format';

export default function Notifications() {
  const navigate = useNavigate();
  const { data, loading, reload } = useFetch('/notifications', { limit: 100 });
  if (loading && !data) return <Loader />;
  const rows = (data && data.data) || [];
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <span className="text-[15px]">Notifications ({data ? data.unread : 0} unread)</span>
        <button className="btn-outline btn-sm" onClick={() => api.put('/notifications/read-all').then(reload)}><LuCheckCheck size={14} /> Mark all read</button>
      </div>
      {rows.length === 0 ? (
        <EmptyState text="No notifications" />
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
              className={`flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-slate-50 ${n.is_read ? '' : 'bg-brand-50/40'}`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-brand'}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{n.title}</span>
                {n.message && <span className="block text-sm text-slate-600">{n.message}</span>}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{fmtDateTime(n.created_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
