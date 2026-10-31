import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LuSearch, LuCalendarDays, LuMapPin, LuTriangleAlert } from 'react-icons/lu';
import useFetch from '../../hooks/useFetch';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';
import ProgressBar from '../../components/common/ProgressBar';
import EmptyState from '../../components/common/EmptyState';
import { fmtDate } from '../../utils/format';
import { HealthDot } from '../projects/Projects';

const daysTo = (d) => (d ? Math.ceil((new Date(String(d).slice(0, 10)) - new Date(new Date().toDateString())) / 86400000) : null);

export default function ExecutionTracker() {
  const [search, setSearch] = useState('');
  const { data, loading } = useFetch('/execution-items/summary', { search });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px]">Live & upcoming projects – operational readiness</div>
        <div className="relative">
          <LuSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input className="input !w-56 !py-1.5 pl-8 text-[13px]" placeholder="Search project…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      {loading && !data ? (
        <Loader />
      ) : !data || data.length === 0 ? (
        <div className="card"><EmptyState text="No active projects" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => {
            const d = daysTo(p.event_start);
            return (
              <Link key={p.id} to={`/execution/${p.id}`} className="card block p-5 hover:border-brand/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-slate-400">{p.project_code}</div>
                    <div className="truncate font-medium text-ink">{p.name}</div>
                    <div className="truncate text-xs text-slate-500">{p.company_name}</div>
                  </div>
                  <Badge>{p.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1"><LuCalendarDays size={13} /> {fmtDate(p.event_start)}</span>
                  {p.location && <span className="inline-flex items-center gap-1"><LuMapPin size={13} /> {p.location}</span>}
                  <span className="inline-flex items-center gap-1"><HealthDot h={p.health} /> {p.health}</span>
                </div>
                {d !== null && (
                  <div className={`mt-2 text-xs font-medium ${d < 0 ? 'text-slate-400' : d <= 7 ? 'text-red-600' : 'text-ink'}`}>
                    {d > 0 ? `${d} day(s) to event` : d === 0 ? 'Event day today' : 'Event done'}
                  </div>
                )}
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-500">Readiness</span>
                    <span className="font-medium">{p.readiness}% ({p.ready_items || 0}/{p.total_items})</span>
                  </div>
                  <ProgressBar value={p.readiness} color={p.readiness >= 80 ? 'bg-green-500' : p.readiness >= 50 ? 'bg-yellow-500' : 'bg-brand'} />
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11px]">
                  {[
                    ['Issues', p.issue_items],
                    ['Overdue', p.overdue_items],
                    ['Vendor pending', p.pending_vendor],
                    ['Approvals', p.pending_approvals],
                  ].map(([l, v]) => (
                    <div key={l} className={`rounded-md py-1.5 ${Number(v) > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-500'}`}>
                      <div className="text-sm font-semibold">{Number(v) || 0}</div>
                      {l}
                    </div>
                  ))}
                </div>
                {p.event_day_status && (
                  <div className="mt-3 flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
                    <LuTriangleAlert size={12} /> {p.event_day_status}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
