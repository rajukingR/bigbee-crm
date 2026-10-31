import { Link } from 'react-router-dom';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import { fmtDateTime } from '../../utils/format';
import { SEVERITIES, ESCALATION_TYPES, toOptions } from '../../utils/constants';

export default function Escalations() {
  const fields = [
    { name: 'project_id', label: 'Project', type: 'select', remote: { endpoint: '/projects', label: (r) => `${r.project_code} – ${r.name}` } },
    { name: 'escalation_type', label: 'Type', type: 'select', options: toOptions(ESCALATION_TYPES), allowEmpty: false },
    { name: 'title', label: 'Title', required: true, col: 'full' },
    { name: 'severity', label: 'Severity', type: 'select', options: toOptions(SEVERITIES), allowEmpty: false },
    { name: 'escalated_to', label: 'Escalate to', type: 'select', lookup: 'employees', labelKey: 'full_name', help: 'Defaults to your reporting manager' },
    { name: 'status', label: 'Status', type: 'select', options: toOptions(['Open', 'In Progress', 'Resolved', 'Closed']), allowEmpty: false },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'resolution', label: 'Resolution', type: 'textarea' },
  ];
  return (
    <CrudPage
      title="Escalations – risks, complaints, delays & pending approvals"
      endpoint="/escalations"
      module="escalations"
      addLabel="Raise Escalation"
      exportName="escalations"
      modalSize="lg"
      initialFilters={{ status: 'Open,In Progress' }}
      filters={[
        { name: 'status', label: 'All Status', options: [{ value: 'Open,In Progress', label: 'Open & In Progress' }, ...toOptions(['Open', 'In Progress', 'Resolved', 'Closed'])] },
        { name: 'severity', label: 'All Severity', options: toOptions(SEVERITIES) },
        { name: 'escalation_type', label: 'All Types', options: toOptions(ESCALATION_TYPES) },
      ]}
      columns={[
        { key: 'title', label: 'Escalation', render: (r) => <div><div className="font-medium text-ink">{r.title}</div><div className="text-xs text-slate-500">{r.escalation_type}</div></div> },
        { key: 'project_code', label: 'Project', render: (r) => (r.project_id ? <Link className="link" to={`/projects/${r.project_id}`} onClick={(e) => e.stopPropagation()}>{r.project_code}</Link> : '—'), exportValue: (r) => r.project_code },
        { key: 'severity', label: 'Severity', render: (r) => <Badge>{r.severity}</Badge> },
        { key: 'raised_by_name', label: 'Raised by' },
        { key: 'escalated_to_name', label: 'Escalated to' },
        { key: 'created_at', label: 'Raised on', render: (r) => fmtDateTime(r.created_at) },
        { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
      ]}
      defaults={{ escalation_type: 'Risk', severity: 'Medium', status: 'Open' }}
      fields={fields}
      toPayload={(v) => Object.fromEntries(fields.map((f) => [f.name, v[f.name]]))}
    />
  );
}
