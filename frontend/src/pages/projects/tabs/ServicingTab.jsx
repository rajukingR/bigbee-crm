import CrudPage from '../../../components/common/CrudPage';
import Badge from '../../../components/common/Badge';
import { inr, fmtDateTime } from '../../../utils/format';
import { SEVERITIES, ESCALATION_TYPES, toOptions } from '../../../utils/constants';

/** Client Servicing: communication log, change requests and escalations. */
export default function ServicingTab({ data, reload }) {
  const pid = data.project.id;
  const commFields = [
    { name: 'log_type', label: 'Type', type: 'select', options: toOptions(['Meeting', 'Call', 'Email', 'WhatsApp', 'Approval', 'Other']), allowEmpty: false },
    { name: 'log_date', label: 'Date & Time', type: 'datetime' },
    { name: 'subject', label: 'Subject', required: true, col: 'full' },
    { name: 'notes', label: 'Notes (brief, approvals, guest count, agenda, branding…)', type: 'textarea' },
    { name: 'commitments', label: 'Commitments made', type: 'textarea' },
  ];
  const crFields = [
    { name: 'title', label: 'Change / Additional Request', required: true, col: 'full' },
    { name: 'revenue_impact', label: 'Revenue Impact (₹, billable to client)', type: 'number' },
    { name: 'cost_impact', label: 'Cost Impact (₹)', type: 'number' },
    { name: 'time_impact_days', label: 'Time Impact (days)', type: 'number' },
    { name: 'description', label: 'Description', type: 'textarea' },
  ];
  const escFields = [
    { name: 'title', label: 'Title', required: true, col: 'full' },
    { name: 'escalation_type', label: 'Type', type: 'select', options: toOptions(ESCALATION_TYPES), allowEmpty: false },
    { name: 'severity', label: 'Severity', type: 'select', options: toOptions(SEVERITIES), allowEmpty: false },
    { name: 'escalated_to', label: 'Escalate to', type: 'select', lookup: 'employees', labelKey: 'full_name', help: 'Defaults to your reporting manager' },
    { name: 'status', label: 'Status', type: 'select', options: toOptions(['Open', 'In Progress', 'Resolved', 'Closed']), allowEmpty: false },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'resolution', label: 'Resolution', type: 'textarea' },
  ];
  const pick = (fields, v) => ({ ...Object.fromEntries(fields.map((f) => [f.name, v[f.name]])), project_id: pid });

  return (
    <div className="space-y-6">
      <CrudPage
        title="Communication Log"
        endpoint="/communication-logs"
        module="projects"
        addLabel="Add Entry"
        initialFilters={{ project_id: pid }}
        defaults={{ project_id: pid, log_type: 'Meeting' }}
        fields={commFields}
        toPayload={(v) => pick(commFields, v)}
        showSerial={false}
        columns={[
          { key: 'log_date', label: 'Date', render: (r) => fmtDateTime(r.log_date) },
          { key: 'log_type', label: 'Type', render: (r) => <Badge>{r.log_type}</Badge> },
          { key: 'subject', label: 'Subject', render: (r) => <div><div className="font-medium text-ink">{r.subject}</div><div className="line-clamp-2 text-xs text-slate-500">{r.notes}</div></div> },
          { key: 'commitments', label: 'Commitments', render: (r) => <span className="text-xs">{r.commitments || '—'}</span> },
          { key: 'logged_by_name', label: 'By' },
        ]}
      />
      <CrudPage
        title="Change Requests"
        endpoint="/change-requests"
        module="escalations"
        addLabel="Raise Change Request"
        initialFilters={{ project_id: pid }}
        defaults={{ project_id: pid }}
        fields={crFields}
        toPayload={(v) => pick(crFields, v)}
        afterSave={reload}
        showSerial={false}
        canEditRow={(r) => r.status === 'Requested'}
        canDeleteRow={(r) => r.status === 'Requested'}
        columns={[
          { key: 'title', label: 'Request', render: (r) => <span className="font-medium text-ink">{r.title}</span> },
          { key: 'revenue_impact', label: 'Revenue Impact', render: (r) => inr(r.revenue_impact) },
          { key: 'cost_impact', label: 'Cost Impact', render: (r) => inr(r.cost_impact) },
          { key: 'time_impact_days', label: 'Time (days)' },
          { key: 'status', label: 'Approval', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'requested_by_name', label: 'Raised by' },
        ]}
      />
      <CrudPage
        title="Escalations, Risks & Complaints"
        endpoint="/escalations"
        module="escalations"
        addLabel="Escalate"
        initialFilters={{ project_id: pid }}
        defaults={{ project_id: pid, escalation_type: 'Risk', severity: 'Medium', status: 'Open' }}
        fields={escFields}
        toPayload={(v) => pick(escFields, v)}
        afterSave={reload}
        showSerial={false}
        columns={[
          { key: 'title', label: 'Escalation', render: (r) => <div><div className="font-medium text-ink">{r.title}</div><div className="text-xs text-slate-500">{r.escalation_type}</div></div> },
          { key: 'severity', label: 'Severity', render: (r) => <Badge>{r.severity}</Badge> },
          { key: 'escalated_to_name', label: 'Escalated to' },
          { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          { key: 'created_at', label: 'Raised', render: (r) => fmtDateTime(r.created_at) },
        ]}
      />
    </div>
  );
}
