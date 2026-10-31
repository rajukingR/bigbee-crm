import { useState } from 'react';
import toast from 'react-hot-toast';
import { LuSparkles, LuList, LuChartGantt, LuMessageCircle } from 'react-icons/lu';
import api, { showError } from '../../../api/axios';
import { useAuth } from '../../../context/AuthContext';
import CrudPage from '../../../components/common/CrudPage';
import Badge from '../../../components/common/Badge';
import useFetch from '../../../hooks/useFetch';
import { fmtDate, fmtDateTime } from '../../../utils/format';
import { TASK_FIELDS, TASK_KEYS } from '../taskFields';
import { TaskStatusSelect } from '../Tasks';
import TaskComments from '../TaskComments';

const STATUS_BAR = {
  Completed: 'bg-green-500',
  'In Progress': 'bg-blue-500',
  Blocked: 'bg-red-500',
  'Waiting for Client': 'bg-amber-400',
  'Waiting for Vendor': 'bg-amber-400',
  Cancelled: 'bg-slate-300',
  'Not Started': 'bg-slate-400',
};

/** Simple Gantt-style timeline of project tasks. */
function Timeline({ projectId }) {
  const { data } = useFetch('/tasks', { project_id: projectId, all: 1 });
  const rows = (data && data.data) || [];
  const dated = rows.filter((t) => t.due_date);
  if (!dated.length) return <div className="py-8 text-center text-sm text-slate-400">Add due dates to tasks to see the timeline</div>;
  const start = (t) => new Date(String(t.start_date || t.created_at).slice(0, 10)).getTime();
  const end = (t) => new Date(String(t.due_date).slice(0, 10)).getTime();
  const min = Math.min(...dated.map(start));
  const max = Math.max(...dated.map(end)) + 86400000;
  const span = max - min || 1;
  const today = Date.now();
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="mb-2 flex justify-between pl-[240px] text-[11px] text-slate-400">
          <span>{fmtDate(new Date(min).toISOString())}</span>
          <span>{fmtDate(new Date(max).toISOString())}</span>
        </div>
        <div className="relative">
          {today > min && today < max && <div className="absolute bottom-0 top-0 z-10 w-px bg-brand" style={{ left: `calc(240px + (100% - 240px) * ${(today - min) / span})` }} title="Today" />}
          {dated
            .sort((a, b) => start(a) - start(b))
            .map((t) => {
              const s = start(t);
              const e = Math.max(end(t), s);
              return (
                <div key={t.id} className="flex items-center border-b border-slate-50 py-1.5">
                  <div className="w-[240px] shrink-0 truncate pr-3 text-xs text-ink" title={t.title}>
                    {t.title}
                    <div className="text-[10px] text-slate-400">{t.owner_name}</div>
                  </div>
                  <div className="relative h-5 flex-1 rounded bg-slate-50">
                    <div
                      className={`absolute h-5 rounded ${STATUS_BAR[t.status] || 'bg-slate-400'} ${Number(t.is_overdue) ? 'ring-2 ring-red-400' : ''}`}
                      style={{ left: `${((s - min) / span) * 100}%`, width: `${Math.max(((e - s + 86400000) / span) * 100, 1.5)}%` }}
                      title={`${t.status} · due ${fmtDateTime(t.due_date)}`}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

export default function TasksTab({ data, reload }) {
  const { can } = useAuth();
  const pid = data.project.id;
  const [view, setView] = useState('list');
  const [key, setKey] = useState(0);
  const [comments, setComments] = useState(null);

  const applyTemplate = async () => {
    try {
      const { data: r } = await api.post(`/projects/${pid}/apply-template`, {});
      toast.success(r.message);
      setKey((k) => k + 1);
      reload();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-md border border-line bg-white p-0.5">
          <button onClick={() => setView('list')} className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${view === 'list' ? 'bg-brand text-white' : 'text-slate-600'}`}>
            <LuList size={14} /> List
          </button>
          <button onClick={() => setView('timeline')} className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${view === 'timeline' ? 'bg-brand text-white' : 'text-slate-600'}`}>
            <LuChartGantt size={14} /> Timeline
          </button>
        </div>
        {can('tasks', 'create') && (
          <button className="btn-outline btn-sm" onClick={applyTemplate} title="Create standard tasks & milestones for this event type">
            <LuSparkles size={14} /> Apply {data.project.event_type_name || 'default'} template
          </button>
        )}
      </div>
      {view === 'timeline' ? (
        <Timeline projectId={pid} key={key} />
      ) : (
        <CrudPage
          title="Project Tasks"
          endpoint="/tasks"
          module="tasks"
          addLabel="Add Task"
          exportName={`tasks_${data.project.project_code}`}
          modalSize="lg"
          reloadKey={key}
          initialFilters={{ project_id: pid }}
          defaults={{ project_id: pid, priority: 'Medium', status: 'Not Started' }}
          fields={TASK_FIELDS(false).map((f) => (f.hidden && ['milestone_id', 'depends_on'].includes(f.name) ? { ...f, hidden: () => false } : f))}
          toPayload={(v) => ({ ...Object.fromEntries(TASK_KEYS.filter((k) => v[k] !== undefined).map((k) => [k, v[k]])), project_id: pid })}
          afterSave={reload}
          columns={[
            { key: 'title', label: 'Task', render: (r) => <div><div className="font-medium text-ink">{r.title}</div>{r.milestone_title && <div className="text-xs text-slate-400">{r.milestone_title}</div>}</div> },
            { key: 'owner_name', label: 'Owner', render: (r) => <div>{r.owner_name}<div className="text-xs text-slate-500">{r.department_name}</div></div> },
            { key: 'priority', label: 'Priority', render: (r) => <Badge>{r.priority}</Badge> },
            { key: 'due_date', label: 'Due', render: (r) => <span className={Number(r.is_overdue) ? 'font-medium text-red-600' : ''}>{fmtDateTime(r.due_date)}</span> },
            { key: 'status', label: 'Status', render: (r, i, ctx) => <TaskStatusSelect task={r} onChanged={() => { ctx.reload(); reload(); }} /> },
          ]}
          rowActions={(r) => (
            <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Comments & files" onClick={() => setComments(r)}>
              <LuMessageCircle size={15} />
            </button>
          )}
        />
      )}
      <TaskComments task={comments} onClose={() => setComments(null)} />
    </div>
  );
}
