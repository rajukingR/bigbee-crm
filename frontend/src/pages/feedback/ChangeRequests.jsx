import { Link } from 'react-router-dom';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import { inr, fmtDate } from '../../utils/format';
import { toOptions } from '../../utils/constants';

export default function ChangeRequests() {
  const fields = [
    { name: 'project_id', label: 'Project', type: 'select', required: true, remote: { endpoint: '/projects', label: (r) => `${r.project_code} – ${r.name}` }, col: 'full' },
    { name: 'title', label: 'Change / Additional Request', required: true, col: 'full' },
    { name: 'revenue_impact', label: 'Revenue Impact (₹, billable)', type: 'number' },
    { name: 'cost_impact', label: 'Cost Impact (₹)', type: 'number' },
    { name: 'time_impact_days', label: 'Time Impact (days)', type: 'number' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];
  return (
    <CrudPage
      title="Scope Change Requests"
      endpoint="/change-requests"
      module="escalations"
      addLabel="Raise Change Request"
      exportName="change_requests"
      filters={[
        { name: 'status', label: 'All Status', options: toOptions(['Requested', 'Approved', 'Rejected']) },
        { name: 'project_id', label: 'All Projects', remote: { endpoint: '/projects', label: (r) => r.project_code } },
      ]}
      columns={[
        { key: 'title', label: 'Request', render: (r) => <span className="font-medium text-ink">{r.title}</span> },
        { key: 'project_code', label: 'Project', render: (r) => <Link className="link" to={`/projects/${r.project_id}`} onClick={(e) => e.stopPropagation()}>{r.project_code}</Link>, exportValue: (r) => r.project_code },
        { key: 'revenue_impact', label: 'Revenue Impact', render: (r) => inr(r.revenue_impact) },
        { key: 'cost_impact', label: 'Cost Impact', render: (r) => inr(r.cost_impact) },
        { key: 'time_impact_days', label: 'Days' },
        { key: 'requested_by_name', label: 'Raised by' },
        { key: 'created_at', label: 'Date', render: (r) => fmtDate(r.created_at) },
        { key: 'status', label: 'Approval', render: (r) => <Badge>{r.status}</Badge> },
      ]}
      fields={fields}
      toPayload={(v) => Object.fromEntries(fields.map((f) => [f.name, v[f.name]]))}
      canEditRow={(r) => r.status === 'Requested'}
      canDeleteRow={(r) => r.status === 'Requested'}
    />
  );
}
