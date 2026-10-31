import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { LuTarget, LuTrendingUp, LuUsers, LuTriangleAlert, LuDownload } from 'react-icons/lu';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useLookups } from '../../context/LookupContext';
import StatCard from '../../components/common/StatCard';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';
import ProgressBar from '../../components/common/ProgressBar';
import { Select } from '../../components/common/FormFields';
import { lakhs, num, pct, fmtDateTime, isOverdue } from '../../utils/format';
import { exportCsv } from '../../utils/exportCsv';

const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`;
const today = () => new Date().toISOString().slice(0, 10);

export default function ManagerDashboard() {
  const { user, can } = useAuth();
  const { lookups } = useLookups();
  const [f, setF] = useState({ from: monthStart(), to: today(), department_id: '', manager_id: '' });
  const { data, loading } = useFetch('/dashboard/manager', f);
  const companyWide = user.is_super_admin || user.data_scope === 'all';

  const COLS = [
    { key: 'full_name', label: 'Employee' },
    { key: 'role_name', label: 'Role' },
    { key: 'target', label: 'Target' },
    { key: 'won_value', label: 'Won' },
    { key: 'achievement_pct', label: 'Achievement %' },
    { key: 'pipeline_weighted', label: 'Weighted Pipeline' },
    { key: 'leads', label: 'Leads' },
    { key: 'qualified_leads', label: 'Qualified' },
    { key: 'calls', label: 'Calls' },
    { key: 'meetings', label: 'Meetings' },
    { key: 'proposals_sent', label: 'Proposals' },
    { key: 'win_rate', label: 'Win Rate %' },
    { key: 'overdue_followups', label: 'Overdue F/U' },
    { key: 'open_tasks', label: 'Open Tasks' },
    { key: 'overdue_tasks', label: 'Overdue Tasks' },
  ];

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-2 p-4">
        <span className="mr-auto text-sm font-medium text-ink">Team performance</span>
        {companyWide && (
          <>
            <Select className="!w-48 !py-1.5 text-[13px]" placeholder="All departments" value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value, manager_id: '' })} options={(lookups.departments || []).map((d) => ({ value: d.id, label: d.name }))} />
            <Select className="!w-52 !py-1.5 text-[13px]" placeholder="Any manager's team" value={f.manager_id} onChange={(e) => setF({ ...f, manager_id: e.target.value })} options={(lookups.employees || []).map((e) => ({ value: e.id, label: e.full_name }))} />
          </>
        )}
        <input type="date" className="input !w-auto !py-1.5 text-[13px]" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        <span className="text-xs text-slate-400">to</span>
        <input type="date" className="input !w-auto !py-1.5 text-[13px]" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
      </div>

      {loading && !data ? (
        <Loader />
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Team Won Business" value={lakhs(data.totals.won_value)} icon={LuTarget} sub={data.totals.target ? `Target ${lakhs(data.totals.target)} · ${pct((data.totals.won_value / data.totals.target) * 100)}` : 'No target set'} />
            <StatCard label="Weighted Pipeline" value={lakhs(data.totals.pipeline_weighted)} icon={LuTrendingUp} sub={`Unweighted ${lakhs(data.totals.pipeline_unweighted)}`} />
            <StatCard label="Team Members" value={num(data.members.length)} icon={LuUsers} sub={`${num(data.totals.meetings)} meetings · ${num(data.totals.calls)} calls`} />
            <StatCard label="Overdue Follow-ups" value={num(data.totals.overdue_followups)} icon={LuTriangleAlert} sub={`${num(data.totals.overdue_tasks)} overdue tasks`} />
          </div>

          <div className="card">
            <div className="flex items-center justify-between px-5 pt-5">
              <h3 className="card-title">Team Scorecard</h3>
              {can('reports', 'export') && (
                <button className="btn-outline btn-sm" onClick={() => exportCsv('team_scorecard', COLS, data.members, { module: 'manager_dashboard' })}>
                  <LuDownload size={14} /> Export
                </button>
              )}
            </div>
            <div className="overflow-x-auto p-2">
              <table className="min-w-full">
                <thead className="border-b border-line">
                  <tr>
                    {['Employee', 'Target', 'Won', 'Achievement', 'Wtd. Pipeline', 'Leads / Qual.', 'Calls', 'Meetings', 'Proposals', 'Win %', 'Overdue F/U', 'Tasks (overdue)'].map((h) => (
                      <th key={h} className="table-head">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m) => (
                    <tr key={m.id} className="border-b border-line">
                      <td className="table-cell">
                        <div className="font-medium text-ink">{m.full_name}</div>
                        <div className="text-xs text-slate-500">{m.role_name}</div>
                      </td>
                      <td className="table-cell">{m.target ? lakhs(m.target) : '—'}</td>
                      <td className="table-cell font-medium">{lakhs(m.won_value)}</td>
                      <td className="table-cell min-w-[120px]">
                        {m.achievement_pct === null ? '—' : (
                          <div className="flex items-center gap-2">
                            <ProgressBar value={m.achievement_pct} color={m.achievement_pct >= 100 ? 'bg-green-500' : m.achievement_pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'} />
                            <span className="text-xs">{pct(m.achievement_pct)}</span>
                          </div>
                        )}
                      </td>
                      <td className="table-cell">{lakhs(m.pipeline_weighted)}</td>
                      <td className="table-cell">{m.leads} / {m.qualified_leads}</td>
                      <td className="table-cell">{m.calls}</td>
                      <td className="table-cell">{m.meetings}</td>
                      <td className="table-cell">{m.proposals_sent}</td>
                      <td className="table-cell">{pct(m.win_rate)}</td>
                      <td className={`table-cell ${m.overdue_followups ? 'font-medium text-red-600' : ''}`}>{m.overdue_followups}</td>
                      <td className="table-cell">
                        {m.open_tasks} {m.overdue_tasks ? <span className="text-red-600">({m.overdue_tasks})</span> : ''}
                      </td>
                    </tr>
                  ))}
                  {data.members.length === 0 && (
                    <tr><td colSpan={12} className="py-8 text-center text-sm text-slate-400">No team members found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="card p-5">
              <h3 className="card-title mb-4">Team Sales Funnel</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.funnel} layout="vertical" margin={{ left: 30, right: 20 }}>
                    <CartesianGrid stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => lakhs(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip formatter={(v, n, p) => [`${lakhs(v)} (${p.payload.count})`, 'Value']} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {data.funnel.map((s) => (
                        <Cell key={s.id} fill={s.color || '#ff4400'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="card-title">Team Follow-ups (today & overdue)</h3>
                <Link to="/follow-ups" className="text-[13px] text-brand">Open board</Link>
              </div>
              <div className="max-h-[300px] divide-y divide-line overflow-y-auto">
                {data.followups.length === 0 && <div className="py-6 text-center text-sm text-slate-400">Nothing pending 🎉</div>}
                {data.followups.map((x) => (
                  <Link
                    key={`${x.type}-${x.id}`}
                    to={x.type === 'lead' ? `/leads/${x.id}` : x.type === 'opportunity' ? `/opportunities/${x.id}` : '/tasks'}
                    className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-ink">
                        <span className="mr-1.5 text-[10px] font-semibold uppercase text-brand">{x.type}</span>
                        {x.code} · {x.name}
                      </div>
                      <div className="truncate text-xs text-slate-500">{x.owner_name} · {x.next_action || '—'}</div>
                    </div>
                    <span className={`shrink-0 text-xs ${isOverdue(x.due) ? 'text-red-600' : 'text-slate-500'}`}>{fmtDateTime(x.due)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}
      {data && data.members.some((m) => m.overdue_tasks > 0) && (
        <div className="text-xs text-slate-500">
          <Badge>Overdue</Badge> items are escalated automatically to the reporting manager after the configured number of days.
        </div>
      )}
    </div>
  );
}
