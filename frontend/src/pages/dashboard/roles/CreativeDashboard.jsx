import { LuPalette, LuCalendarDays, LuTriangleAlert, LuCircleCheck } from 'react-icons/lu';
import StatCard from '../../../components/common/StatCard';
import Badge from '../../../components/common/Badge';
import { Panel, ListRows, MiniTable, QuickActions, NotificationsPanel } from '../../../components/dashboard/Widgets';
import { num, fmtDate, fmtDateTime } from '../../../utils/format';

const ACTIONS = [
  { title: 'My Tasks', sub: 'Briefs, revisions & deadlines', to: '/tasks?view=my', module: 'tasks' },
  { title: 'Overdue Work', sub: 'Items past deadline', to: '/tasks?view=overdue', module: 'tasks' },
  { title: 'Projects', sub: 'Event details & documents', to: '/projects', module: 'projects' },
  { title: 'Proposals', sub: 'Decks needing creatives', to: '/proposals', module: 'proposals' },
];

/** Creative: briefs assigned, deadlines, revisions, delivery rate. */
export default function CreativeDashboard({ d }) {
  const k = d.kpis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open Briefs / Tasks" value={num(k.open_briefs)} icon={LuPalette} sub="Assigned and in progress" />
        <StatCard label="Due This Week" value={num(k.due_week)} icon={LuCalendarDays} sub="Next 7 days" />
        <StatCard label="Overdue" value={num(k.overdue)} icon={LuTriangleAlert} sub="Past deadline" />
        <StatCard label="Delivered This Month" value={num(k.delivered_month)} icon={LuCircleCheck} sub={k.on_time_pct === null ? '—' : `${k.on_time_pct}% on time`} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Briefs & Deliverables" to="/tasks" className="xl:col-span-2">
          <MiniTable
            rows={d.tasks}
            empty="No open briefs"
            cols={[
              ['Brief', (r) => <div><div className="font-medium text-ink">{r.title}</div><div className="text-xs text-slate-500">{r.project_code ? `${r.project_code} · ${r.project_name}` : 'General'}</div></div>],
              ['Owner', (r) => r.owner_name],
              ['Priority', (r) => <Badge>{r.priority}</Badge>],
              ['Revisions', (r) => r.revisions, 'right'],
              ['Due', (r) => <span className={Number(r.is_overdue) ? 'font-medium text-red-600' : ''}>{fmtDateTime(r.due_date)}</span>],
              ['Status', (r) => <Badge>{r.status}</Badge>],
            ]}
          />
        </Panel>
        <NotificationsPanel />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Projects I'm Working On" to="/projects">
          <ListRows rows={d.projects.map((p) => ({ key: p.id, title: `${p.project_code} · ${p.name}`, sub: p.status, right: fmtDate(p.event_start), to: `/projects/${p.id}` }))} empty="No active projects" />
        </Panel>
        <QuickActions actions={ACTIONS} />
      </div>
    </div>
  );
}
