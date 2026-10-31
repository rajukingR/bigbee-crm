import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuNotebookPen, LuCheck, LuPhone } from 'react-icons/lu';
import useFetch from '../../hooks/useFetch';
import api, { showError } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useLookups } from '../../context/LookupContext';
import Tabs from '../../components/common/Tabs';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { Select } from '../../components/common/FormFields';
import LogActivityModal from '../../components/common/LogActivityModal';
import { fmtDateTime, isOverdue } from '../../utils/format';

const linkFor = (x) => (x.type === 'lead' ? `/leads/${x.id}` : x.type === 'opportunity' ? `/opportunities/${x.id}` : '/tasks');

export default function FollowUps() {
  const { can, user } = useAuth();
  const { lookups } = useLookups();
  const [range, setRange] = useState('today');
  const [owner, setOwner] = useState('');
  const { data, loading, reload } = useFetch('/activities/follow-ups', { range, owner_id: owner || undefined });
  const [log, setLog] = useState(null);

  const completeTask = async (x) => {
    try {
      await api.put(`/tasks/${x.id}`, { status: 'Completed' });
      toast.success('Task completed');
      reload();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3">
        <Tabs
          active={range}
          onChange={setRange}
          tabs={[
            { key: 'today', label: 'Today' },
            { key: 'overdue', label: 'Overdue' },
            { key: 'upcoming', label: 'Next 7 days' },
            { key: 'all', label: 'All scheduled' },
          ]}
        />
        {user.data_scope !== 'own' && (
          <Select className="!w-52 !py-1.5 text-[13px]" placeholder="Everyone I can see" value={owner} onChange={(e) => setOwner(e.target.value)} options={(lookups.employees || []).map((e) => ({ value: e.id, label: e.full_name }))} />
        )}
      </div>
      <div className="p-5">
        {loading && !data ? (
          <Loader />
        ) : !data || data.length === 0 ? (
          <EmptyState text="No follow-ups in this view" />
        ) : (
          <div className="divide-y divide-line">
            {data.map((x) => (
              <div key={`${x.type}-${x.id}`} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-24 shrink-0">
                  <span className="chip bg-brand-50 text-brand">{x.type}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={linkFor(x)} className="block truncate text-sm font-medium text-ink hover:text-brand">
                    {x.code} · {x.name}
                  </Link>
                  <div className="truncate text-xs text-slate-500">
                    {x.next_action || 'No next action'} · {x.owner_name}
                  </div>
                </div>
                <Badge>{x.priority}</Badge>
                <span className={`w-40 text-right text-xs ${isOverdue(x.due) ? 'font-medium text-red-600' : 'text-slate-500'}`}>{fmtDateTime(x.due)}</span>
                <div className="flex w-24 justify-end gap-1">
                  {x.phone && (
                    <a href={`tel:${x.phone}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title={`Call ${x.phone}`}>
                      <LuPhone size={15} />
                    </a>
                  )}
                  {x.type !== 'task' && can('activities', 'create') && (
                    <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Log activity" onClick={() => setLog(x)}>
                      <LuNotebookPen size={15} />
                    </button>
                  )}
                  {x.type === 'task' && can('tasks', 'edit') && (
                    <button className="rounded p-1.5 text-slate-500 hover:bg-green-50 hover:text-green-600" title="Mark complete" onClick={() => completeTask(x)}>
                      <LuCheck size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <LogActivityModal open={!!log} onClose={() => setLog(null)} relatedType={log && log.type} relatedId={log && log.id} onSaved={reload} />
    </div>
  );
}
