import { LuUsers, LuUserPlus, LuUserCog, LuShieldCheck } from 'react-icons/lu';
import StatCard from '../../../components/common/StatCard';
import { Panel, ListRows, Bars, QuickActions, NotificationsPanel } from '../../../components/dashboard/Widgets';
import { num, fmtDate } from '../../../utils/format';

const ACTIONS = [
  { title: 'Add Employee', sub: 'Login, role & reporting manager', to: '/masters/employees', module: 'employees', action: 'create' },
  { title: 'Organisation Chart', sub: 'Upward reporting structure', to: '/admin/org-chart', module: 'employees' },
  { title: 'Roles', sub: 'Roles & data visibility', to: '/masters/roles', module: 'roles' },
  { title: 'Departments', sub: 'Department heads', to: '/masters/departments', module: 'departments' },
];

/** HR & Admin: headcount, joiners, reporting gaps, deactivated users with open work. */
export default function HRDashboard({ d }) {
  const k = d.kpis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active Employees" value={num(k.active)} icon={LuUsers} sub={`${k.inactive} deactivated`} />
        <StatCard label="Joined This Month" value={num(k.joined_month)} icon={LuUserPlus} sub="By date of joining" />
        <StatCard label="Without Reporting Manager" value={num(d.no_manager.length)} icon={LuUserCog} sub="Set 'Reports To' for team visibility" />
        <StatCard label="Roles Configured" value={num(k.roles)} icon={LuShieldCheck} sub={k.inactive_with_open_work ? `${k.inactive_with_open_work} inactive user(s) still own open work` : 'No orphaned work'} />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Headcount by Department" to="/masters/departments">
          <Bars data={d.by_department.map((x) => ({ label: x.label, value: Number(x.value) }))} />
        </Panel>
        <Panel title="Recent Joiners" to="/masters/employees">
          <ListRows rows={d.joiners.map((e) => ({ key: e.id, title: `${e.full_name} (${e.employee_code})`, sub: `${e.role_name || '—'} · ${e.department_name || '—'}`, right: fmtDate(e.date_of_joining), to: '/masters/employees' }))} empty="No employees yet" />
        </Panel>
        <NotificationsPanel />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Missing Reporting Manager" to="/masters/employees">
          <ListRows rows={d.no_manager.map((e) => ({ key: e.id, title: e.full_name, sub: e.role_name || '—', right: 'Set manager', rightClass: 'text-brand', to: '/masters/employees' }))} empty="Everyone has a reporting manager" />
        </Panel>
        <QuickActions actions={ACTIONS} />
      </div>
    </div>
  );
}
