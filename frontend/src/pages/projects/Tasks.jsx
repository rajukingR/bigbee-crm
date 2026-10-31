import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuMessageCircle } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import TaskComments from './TaskComments';
import api, { showError } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { fmtDateTime } from '../../utils/format';
import { PRIORITIES, TASK_STATUSES, toOptions } from '../../utils/constants';
import { TASK_FIELDS, TASK_KEYS } from './taskFields';

export function TaskStatusSelect({ task, onChanged }) {
  const { can } = useAuth();
  if (!can('tasks', 'edit')) return <Badge>{task.status}</Badge>;
  return (
    <select
      onClick={(e) => e.stopPropagation()}
      value={task.status}
      onChange={async (e) => {
        try {
          await api.put(`/tasks/${task.id}`, { status: e.target.value });
          toast.success('Status updated');
          onChanged();
        } catch (err) {
          showError(err);
        }
      }}
      className="rounded-md border border-line bg-white px-2 py-1 text-xs"
    >
      {TASK_STATUSES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
}

const VIEWS = [
  { key: 'my', label: 'My tasks' },
  { key: 'team', label: "My team's tasks" },
  { key: 'open', label: 'All open' },
  { key: 'overdue', label: 'Overdue' },
  { key: '', label: 'All' },
];

export default function Tasks() {
  const [params] = useSearchParams();
  const [comments, setComments] = useState(null);
  return (
    <>
      <CrudPage
        title="Tasks"
        endpoint="/tasks"
        module="tasks"
        addLabel="Add Task"
        exportName="tasks"
        modalSize="lg"
        initialFilters={{ view: params.get('view') || 'my' }}
        topContent={(list) => (
          <div className="flex flex-wrap gap-2">
            {VIEWS.map((v) => (
              <button
                key={v.label}
                onClick={() => list.setFilter('view', v.key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${(list.filters.view || '') === v.key ? 'border-brand bg-brand text-white' : 'border-line bg-white text-slate-600'}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
        filters={[
          { name: 'status', label: 'All Status', options: toOptions(TASK_STATUSES) },
          { name: 'priority', label: 'All Priority', options: toOptions(PRIORITIES) },
          { name: 'department_id', label: 'All Departments', lookup: 'departments' },
          { name: 'project_id', label: 'All Projects', remote: { endpoint: '/projects', label: (r) => r.project_code } },
        ]}
        columns={[
          { key: 'title', label: 'Task', render: (r) => <div><div className="font-medium text-ink">{r.title}{Number(r.escalated) ? <span className="chip ml-2 bg-red-50 text-red-600">escalated</span> : null}</div>{r.depends_on_title && <div className="text-xs text-slate-400">after: {r.depends_on_title}</div>}</div> },
          { key: 'project_code', label: 'Project', render: (r) => (r.project_id ? <Link className="link" to={`/projects/${r.project_id}`} onClick={(e) => e.stopPropagation()}>{r.project_code}</Link> : '—'), exportValue: (r) => r.project_code },
          { key: 'owner_name', label: 'Owner', render: (r) => <div>{r.owner_name}<div className="text-xs text-slate-500">{r.department_name}</div></div>, exportValue: (r) => r.owner_name },
          { key: 'priority', label: 'Priority', render: (r) => <Badge>{r.priority}</Badge> },
          { key: 'due_date', label: 'Due', render: (r) => <span className={Number(r.is_overdue) ? 'font-medium text-red-600' : ''}>{fmtDateTime(r.due_date)}</span>, exportValue: (r) => r.due_date },
          { key: 'status', label: 'Status', render: (r, i, ctx) => <TaskStatusSelect task={r} onChanged={ctx.reload} />, exportValue: (r) => r.status },
        ]}
        defaults={{ priority: 'Medium', status: 'Not Started' }}
        fields={TASK_FIELDS(true)}
        toPayload={(v) => Object.fromEntries(TASK_KEYS.filter((k) => v[k] !== undefined).map((k) => [k, v[k]]))}
        rowActions={(r) => (
            <button className="relative rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Comments" onClick={() => setComments(r)}>
              <LuMessageCircle size={15} />
              {Number(r.comment_count) > 0 && <span className="absolute -right-0.5 -top-0.5 text-[9px] font-semibold text-brand">{r.comment_count}</span>}
            </button>
        )}
      />
      <TaskComments task={comments} onClose={() => setComments(null)} />
    </>
  );
}
