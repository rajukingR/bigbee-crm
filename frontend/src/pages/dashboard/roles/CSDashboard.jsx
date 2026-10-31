import { Link } from 'react-router-dom';
import { LuFolderKanban, LuHandshake, LuShieldCheck, LuSiren } from 'react-icons/lu';
import StatCard from '../../../components/common/StatCard';
import Badge from '../../../components/common/Badge';
import ProgressBar from '../../../components/common/ProgressBar';
import { Panel, ListRows, QuickActions, NotificationsPanel } from '../../../components/dashboard/Widgets';
import { inr, num, fmtDate, fmtDateTime, isOverdue } from '../../../utils/format';

const ACTIONS = [
  { title: 'Create Proposal', sub: 'Concept & costing for client', to: '/proposals/new', module: 'proposals', action: 'create' },
  { title: 'My Projects', sub: 'Briefs, approvals, communication', to: '/projects', module: 'projects' },
  { title: 'Raise Escalation', sub: 'Risk, complaint or delay', to: '/feedback/escalations', module: 'escalations', action: 'create' },
  { title: 'Client Feedback', sub: 'Post-event satisfaction', to: '/feedback', module: 'feedback' },
];

const daysTo = (d) => Math.ceil((new Date(String(d).slice(0, 10)) - new Date(new Date().toDateString())) / 86400000);

/** Client Servicing: handovers, upcoming events, client approvals, proposals. */
export default function CSDashboard({ d }) {
  const k = d.kpis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Projects" value={num(k.active_projects)} icon={LuFolderKanban} sub={k.satisfaction ? `Client rating ${k.satisfaction}/5` : 'No feedback yet'} />
        <StatCard label="Handovers to Accept" value={num(k.handover_pending)} icon={LuHandshake} sub="From BD after win" />
        <StatCard label="Client Approvals Pending" value={num(k.client_approvals)} icon={LuShieldCheck} sub="Designs, agenda, branding…" />
        <StatCard label="Open Escalations" value={num(k.open_escalations)} icon={LuSiren} sub="Risks, complaints, delays" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Upcoming Events (45 days)" to="/projects">
          {d.events.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">No upcoming events</div>
          ) : (
            <div className="space-y-3">
              {d.events.map((e) => (
                <Link key={e.id} to={`/projects/${e.id}`} className="block rounded-md border border-line p-3 hover:border-brand/40">
                  <div className="flex justify-between text-[13px] font-medium text-ink">
                    <span className="truncate">{e.project_code} · {e.name}</span>
                    <span className={daysTo(e.event_start) <= 7 ? 'text-red-600' : 'text-slate-500'}>{daysTo(e.event_start)}d</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{fmtDate(e.event_start)}</span>
                    <ProgressBar value={e.progress} className="flex-1" />
                    <span>{e.progress}%</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Handovers" to="/projects">
          <ListRows
            empty="No pending handovers"
            rows={d.handovers.map((h) => ({ key: h.id, title: `${h.project_code} · ${h.name}`, sub: `From ${h.from_name || 'BD'}${h.submitted_at ? ' · ' + fmtDateTime(h.submitted_at) : ''}`, right: <Badge>{h.status}</Badge>, to: `/projects/${h.id}` }))}
          />
        </Panel>
        <NotificationsPanel />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Client Approvals Pending">
          <ListRows
            empty="Nothing waiting on the client"
            rows={d.approvals.map((m) => ({ key: m.id, title: m.title, sub: m.project_code, right: fmtDate(m.planned_date), rightClass: Number(m.is_overdue) ? 'font-medium text-red-600' : 'text-slate-500', to: `/projects/${m.project_id}` }))}
          />
        </Panel>
        <Panel title="Proposals in Progress" to="/proposals">
          <ListRows
            empty="No open proposals"
            rows={d.proposals.map((p) => ({ key: p.id, title: `${p.proposal_code} v${p.version} · ${p.title}`, sub: `${p.company_name || ''} · ${inr(p.total_amount)}`, right: <Badge>{p.status}</Badge>, to: `/proposals/${p.id}` }))}
          />
        </Panel>
        <QuickActions actions={ACTIONS} />
      </div>
      <Panel title="My Tasks" to="/tasks">
        <ListRows rows={d.tasks.map((t) => ({ key: t.id, title: t.title, sub: `${t.project_code || 'General'} · ${t.status}`, right: fmtDateTime(t.due_date), rightClass: isOverdue(t.due_date) ? 'font-medium text-red-600' : 'text-slate-500', to: t.project_id ? `/projects/${t.project_id}` : '/tasks' }))} empty="No open tasks" />
      </Panel>
    </div>
  );
}
