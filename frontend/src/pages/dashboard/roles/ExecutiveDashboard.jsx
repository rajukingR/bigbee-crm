import { Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { LuReceipt, LuUsers, LuCircleDollarSign, LuBadgeCheck, LuTriangleAlert } from 'react-icons/lu';
import StatCard from '../../../components/common/StatCard';
import Badge from '../../../components/common/Badge';
import ProgressBar from '../../../components/common/ProgressBar';
import { QuickActions, NotificationsPanel } from '../../../components/dashboard/Widgets';
import { inr, lakhs, num } from '../../../utils/format';

const PIE_COLORS = ['#f97316', '#f87171', '#34d399'];

const ADMIN_ACTIONS = [
  { title: 'Add Employee', sub: 'Add new employee to the team', to: '/masters/employees', module: 'employees', action: 'create' },
  { title: 'Create Quotation', sub: 'Create new quotation for client', to: '/proposals/new', module: 'proposals', action: 'create' },
  { title: 'Reporting Summary', sub: 'Shortcut to Daily/Weekly/Monthly', to: '/reports', module: 'reports' },
  { title: 'Review KRA', sub: "See all employees KRA's for current month", to: '/targets', module: 'targets' },
];

/** Admin / MD: company-wide view (matches the reference dashboard). */
function BdTarget({ t }) {
  const target = Number(t.target) || 0;
  const achievedPct = target ? (t.achieved / target) * 100 : 0;
  const remainingPct = target ? (t.remaining / target) * 100 : 0;
  const incentivePct = target ? (t.incentive / target) * 100 : 0;
  const Row = ({ label, value, pct, color }) => (
    <div>
      <div className="flex justify-between text-[12px] font-medium text-ink">
        <span>{label}</span>
        <span>{lakhs(value).replace('₹', '')}</span>
      </div>
      <ProgressBar value={pct} color={color} className="mt-1" />
      <div className="mt-1.5 text-[11px] text-slate-500">{pct.toFixed(1).replace(/\.0$/, '')}%</div>
    </div>
  );
  return (
    <div className="card p-5">
      <h3 className="card-title mb-5">BD Target</h3>
      <div className="mb-5 flex items-end justify-between">
        <span className="text-[13px] font-medium text-ink">This Year ({t.year})</span>
        <span className="text-[22px] font-semibold text-ink">{target ? `₹${(target / 1e5).toFixed(0)} Lakhs` : 'Not set'}</span>
      </div>
      <div className="space-y-4">
        <Row label="Achieved" value={t.achieved} pct={achievedPct} color="bg-green-500" />
        <Row label="Remaining" value={t.remaining} pct={remainingPct} color="bg-yellow-500" />
        <Row label="Incentive Earned" value={t.incentive} pct={incentivePct} color="bg-red-600" />
      </div>
    </div>
  );
}

export default function ExecutiveDashboard({ d, months, setMonths, month, setMonth }) {
  const navigate = useNavigate();
  const k = d.kpis;
  const pie = [
    { name: 'Income', value: d.distribution.income },
    { name: 'Expense', value: d.distribution.expense },
    { name: 'Margin Value', value: d.distribution.margin },
  ];
  const s = d.snapshot;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Revenue (This Month)" value={lakhs(k.revenue)} icon={LuReceipt} change={k.revenue_change} />
        <StatCard label="Total Vendor Cost" value={lakhs(k.vendor_cost)} icon={LuUsers} change={k.vendor_cost_change} />
        <StatCard label="Total Margin Value" value={lakhs(k.margin)} icon={LuCircleDollarSign} change={k.margin_change} />
        <StatCard label="Invoices Paid" value={lakhs(k.invoices_paid)} icon={LuBadgeCheck} change={k.invoices_paid_change} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="card-title">Total Revenue</h3>
            <span className="text-[12px] text-brand">{lakhs(d.trend_total)}</span>
          </div>
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink">Last {months} Months</span>
            <select className="rounded-md border border-line px-2.5 py-1.5 text-[12px]" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              <option value={6}>Last 6 Months</option>
              <option value={12}>Last 12 Months</option>
            </select>
          </div>
          <div className="mt-4 h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.trend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tickFormatter={(v) => (v >= 1e5 ? `${(v / 1e5).toFixed(0)}L` : v)} />
                <Tooltip formatter={(v, n) => [inr(v), n === 'revenue' ? 'Revenue' : 'Expense']} />
                <Line type="linear" dataKey="revenue" stroke="#ff4400" strokeWidth={2} dot={false} />
                <Line type="linear" dataKey="expense" stroke="#64748b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="card-title">Revenue Distribution</h3>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-md border border-line px-2 py-1.5 text-[12px]" />
          </div>
          <div className="relative mx-auto mt-4 h-[230px] max-w-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie.filter((p) => p.value > 0).length ? pie : [{ name: 'No data', value: 1 }]} dataKey="value" innerRadius={70} outerRadius={100} paddingAngle={2} stroke="none">
                  {(pie.filter((p) => p.value > 0).length ? pie : [{}]).map((_, i) => (
                    <Cell key={i} fill={pie.filter((p) => p.value > 0).length ? PIE_COLORS[i] : '#f1f5f9'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => inr(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[17px] font-semibold text-ink">{lakhs(d.distribution.income)}</div>
          </div>
          <div className="mt-4 flex flex-col items-center gap-2">
            {pie.map((p, i) => (
              <div key={p.name} className="flex w-32 items-center gap-2 text-[12px] text-ink">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <BdTarget t={d.bd_target} />
        <QuickActions actions={ADMIN_ACTIONS} />
        <NotificationsPanel />
      </div>

      <div className="card p-5">
          <h3 className="card-title mb-5">Business Snapshot</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ['Weighted Pipeline', lakhs(s.pipeline_weighted), '/opportunities'],
              ['Unweighted Pipeline', lakhs(s.pipeline_unweighted), '/opportunities'],
              ['Forecast (Year)', lakhs(s.forecast), '/reports'],
              ['Confirmed (Month)', lakhs(s.confirmed_month), '/projects'],
              ['Receivables', lakhs(s.receivable_outstanding), '/finance/receivables'],
              ['Overdue Collections', lakhs(s.receivable_overdue), '/finance/receivables'],
              ['Active Projects', num(s.active_projects), '/projects'],
              ['Overdue Tasks', num(s.overdue_tasks), '/tasks?view=overdue'],
            ].map(([l, v, to]) => (
              <Link key={l} to={to} className="rounded-md border border-line px-3 py-2.5 hover:border-brand/40">
                <div className="text-[11px] text-slate-500">{l}</div>
                <div className="text-[15px] font-semibold text-ink">{v}</div>
              </Link>
            ))}
          </div>
          {d.risks.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-red-600">
                <LuTriangleAlert size={13} /> Major risks
              </div>
              {d.risks.slice(0, 3).map((r) => (
                <Link key={r.id} to={r.project_id ? `/projects/${r.project_id}` : '/feedback/escalations'} className="flex items-center justify-between py-1 text-[12px] hover:text-brand">
                  <span className="truncate">{r.project_code ? `${r.project_code} · ` : ''}{r.title}</span>
                  <Badge>{r.severity}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="card-title">Top Projects This Month</h3>
          <button className="rounded bg-brand px-3 py-1 text-[12px] font-medium text-white" onClick={() => navigate('/finance/profitability')}>
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-line">
              <tr>
                {['Project ID', 'Project Name', 'Owner', 'Manager', 'Vendor Cost', 'Est. Margin', 'Margin Value', 'Status'].map((h, i) => (
                  <th key={h} className={`table-head ${i >= 4 && i < 7 ? 'text-right' : ''} ${i === 7 ? 'text-center' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.top_projects.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-slate-400">
                    No projects this month
                  </td>
                </tr>
              )}
              {d.top_projects.map((p) => (
                <tr key={p.id} className="border-b border-line">
                  <td className="table-cell font-medium text-ink">{p.project_code}</td>
                  <td className="table-cell">{p.name}</td>
                  <td className="table-cell">{p.bd_owner_name || '—'}</td>
                  <td className="table-cell">{p.manager_name || '—'}</td>
                  <td className="table-cell text-right">{num(p.actual_cost)}</td>
                  <td className="table-cell text-right">{num(p.estimated_gross_profit)}</td>
                  <td className="table-cell text-right">{inr(p.actual_gross_profit)}</td>
                  <td className="table-cell text-center">
                    <Link to={`/projects/${p.id}`} className="text-[13px] text-brand">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

