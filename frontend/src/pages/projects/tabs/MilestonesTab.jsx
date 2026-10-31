import CrudPage from '../../../components/common/CrudPage';
import Badge from '../../../components/common/Badge';
import { fmtDate } from '../../../utils/format';
import { MILESTONE_FIELDS } from '../taskFields';

export default function MilestonesTab({ data, reload }) {
  const pid = data.project.id;
  return (
    <CrudPage
      title="Milestones & Dependencies"
      endpoint="/milestones"
      module="tasks"
      addLabel="Add Milestone"
      exportName={`milestones_${data.project.project_code}`}
      initialFilters={{ project_id: pid }}
      defaults={{ project_id: pid, milestone_type: 'Internal', status: 'Pending' }}
      fields={MILESTONE_FIELDS}
      toPayload={(v) => ({ ...Object.fromEntries(MILESTONE_FIELDS.map((f) => [f.name, v[f.name]])), project_id: pid })}
      afterSave={reload}
      showSerial={false}
      columns={[
        { key: 'title', label: 'Milestone', render: (r) => <span className="font-medium text-ink">{r.title}</span> },
        { key: 'milestone_type', label: 'Type' },
        { key: 'planned_date', label: 'Planned', render: (r) => <span className={Number(r.is_overdue) ? 'font-medium text-red-600' : ''}>{fmtDate(r.planned_date)}</span> },
        { key: 'actual_date', label: 'Actual', render: (r) => fmtDate(r.actual_date) },
        { key: 'delay_days', label: 'Variance', render: (r) => (r.planned_date ? (Number(r.delay_days) > 0 ? <span className="text-red-600">+{r.delay_days}d</span> : <span className="text-green-700">{r.delay_days}d</span>) : '—') },
        { key: 'owner_name', label: 'Owner' },
        { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
      ]}
    />
  );
}
