import useFetch from '../../hooks/useFetch';
import Loader from '../../components/common/Loader';
import { fileUrl } from '../../api/axios';
import { initials } from '../../utils/format';

function Node({ n }) {
  return (
    <li className="relative pl-6 before:absolute before:left-0 before:top-0 before:h-full before:border-l before:border-slate-200 after:absolute after:left-0 after:top-6 after:w-5 after:border-t after:border-slate-200 last:before:h-6">
      <div className="mb-3 inline-flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 shadow-card">
        {n.photo ? (
          <img src={fileUrl(n.photo)} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">{initials(n.full_name)}</span>
        )}
        <div>
          <div className="text-sm font-medium text-ink">{n.full_name}</div>
          <div className="text-xs text-slate-500">{n.role_name || n.designation || '—'}{n.department_name ? ` · ${n.department_name}` : ''}</div>
        </div>
        {n.children.length > 0 && <span className="rounded-full bg-slate-100 px-2 text-[11px] text-slate-500">{n.children.length}</span>}
      </div>
      {n.children.length > 0 && (
        <ul>
          {n.children.map((c) => <Node key={c.id} n={c} />)}
        </ul>
      )}
    </li>
  );
}

/** Upward-reporting structure built from each employee's "Reports To". */
export default function OrgChart() {
  const { data, loading } = useFetch('/employees/org-chart');
  if (loading && !data) return <Loader />;
  return (
    <div className="card overflow-x-auto p-6">
      <p className="mb-5 text-sm text-slate-500">Built from “Reports To” in Employee Master. Managers see their own and their team’s records based on this hierarchy.</p>
      {(data || []).length === 0 ? (
        <div className="text-sm text-slate-400">No employees yet</div>
      ) : (
        <ul className="-ml-6">
          {data.map((n) => <Node key={n.id} n={n} />)}
        </ul>
      )}
    </div>
  );
}
