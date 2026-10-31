import { Link } from 'react-router-dom';
import { LuClipboardCheck, LuGauge, LuTriangleAlert, LuTruck, LuCalendarDays, LuMapPin } from 'react-icons/lu';
import StatCard from '../../../components/common/StatCard';
import Badge from '../../../components/common/Badge';
import ProgressBar from '../../../components/common/ProgressBar';
import { Panel, ListRows, QuickActions, NotificationsPanel } from '../../../components/dashboard/Widgets';
import { num, fmtDate, fmtDateTime, isOverdue } from '../../../utils/format';

const ACTIONS = [
  { title: 'Execution Tracker', sub: 'Checklists & readiness', to: '/execution', module: 'execution' },
  { title: 'Vendor Quotations', sub: 'Compare & select vendors', to: '/vendors/quotations', module: 'quotations' },
  { title: 'Raise Purchase Order', sub: 'Within approval limits', to: '/vendors/purchase-orders', module: 'purchase_orders', action: 'create' },
  { title: 'Log Expense', sub: 'Site / travel expenses', to: '/finance/expenses', module: 'expenses', action: 'create' },
];

const daysTo = (d) => (d ? Math.ceil((new Date(String(d).slice(0, 10)) - new Date(new Date().toDateString())) / 86400000) : null);

/** Operations & Production: event readiness, overdue checklist items, vendor deliveries. */
export default function OperationsDashboard({ d }) {
  const k = d.kpis;
  const n = d.next_event;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Live & Upcoming Projects" value={num(k.live_projects)} icon={LuClipboardCheck} sub={`${k.open_tasks} open tasks · ${k.overdue_tasks} overdue`} />
        <StatCard label="Average Readiness" value={`${k.avg_readiness}%`} icon={LuGauge} sub="Checklist items ready / done" />
        <StatCard label="Overdue / Issue Items" value={num(k.overdue_items)} icon={LuTriangleAlert} sub={`${k.incidents_30d} incidents in 30 days`} />
        <StatCard label="Pending Vendor Deliveries" value={num(k.pending_deliveries)} icon={LuTruck} sub="Approved / issued POs" />
      </div>

      {n && (
        <Link to={`/execution/${n.id}`} className="card flex flex-wrap items-center gap-5 border-l-4 border-l-brand p-5 hover:border-brand/40">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium uppercase tracking-wide text-brand">Next event · {daysTo(n.event_start) === 0 ? 'today' : `in ${daysTo(n.event_start)} day(s)`}</div>
            <div className="mt-1 text-lg font-semibold text-ink">{n.project_code} · {n.name}</div>
            <div className="mt-1 flex gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><LuCalendarDays size={13} /> {fmtDate(n.event_start)}</span>
              {n.location && <span className="inline-flex items-center gap-1"><LuMapPin size={13} /> {n.location}</span>}
            </div>
          </div>
          <div className="w-64">
            <div className="mb-1 flex justify-between text-xs"><span>Readiness</span><span className="font-semibold">{n.readiness}%</span></div>
            <ProgressBar value={n.readiness} color={n.readiness >= 80 ? 'bg-green-500' : n.readiness >= 50 ? 'bg-yellow-500' : 'bg-brand'} height="h-2" />
            {Number(n.issues) > 0 && <div className="mt-1 text-xs text-red-600">{n.issues} issue(s) flagged</div>}
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Project Readiness" to="/execution">
          {d.events.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">No live projects</div>
          ) : (
            <div className="space-y-3">
              {d.events.map((e) => (
                <Link key={e.id} to={`/execution/${e.id}`} className="block">
                  <div className="flex justify-between text-[12.5px]">
                    <span className="truncate font-medium text-ink">{e.project_code} · {e.name}</span>
                    <span className="text-slate-500">{fmtDate(e.event_start)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <ProgressBar value={e.readiness} color={e.readiness >= 80 ? 'bg-green-500' : e.readiness >= 50 ? 'bg-yellow-500' : 'bg-brand'} />
                    <span className="w-9 text-right text-xs">{e.readiness}%</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Overdue & Issue Items" to="/execution">
          <ListRows
            empty="All checklist items on track"
            rows={d.overdue_items.map((x) => ({ key: x.id, title: x.item, sub: `${x.project_code} · ${x.category} · ${x.owner_name || 'Unassigned'}`, right: x.status === 'Issue' ? <Badge>Issue</Badge> : fmtDateTime(x.due_date), rightClass: 'text-red-600', to: `/execution/${x.project_id}` }))}
          />
        </Panel>
        <NotificationsPanel />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Vendor Deliveries" to="/vendors/purchase-orders">
          <ListRows
            empty="No pending deliveries"
            rows={d.deliveries.map((p) => ({ key: p.id, title: `${p.po_code} · ${p.vendor_name}`, sub: `${p.project_code || '—'} · ${p.delivery_status}`, right: fmtDate(p.delivery_date), rightClass: Number(p.is_overdue) ? 'font-medium text-red-600' : 'text-slate-500', to: '/vendors/purchase-orders' }))}
          />
        </Panel>
        <Panel title="My Tasks" to="/tasks">
          <ListRows rows={d.tasks.map((t) => ({ key: t.id, title: t.title, sub: `${t.project_code || 'General'} · ${t.status}`, right: fmtDateTime(t.due_date), rightClass: isOverdue(t.due_date) ? 'font-medium text-red-600' : 'text-slate-500', to: t.project_id ? `/projects/${t.project_id}` : '/tasks' }))} empty="No open tasks" />
        </Panel>
        <QuickActions actions={ACTIONS} />
      </div>
    </div>
  );
}
