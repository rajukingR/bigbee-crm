import { Link, useNavigate } from 'react-router-dom';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import ProgressBar from '../../components/common/ProgressBar';
import { useAuth } from '../../context/AuthContext';
import { inr, fmtDate } from '../../utils/format';
import { PROJECT_STATUSES, HEALTH, toOptions } from '../../utils/constants';

const emp = (label, name) => ({ name, label, type: 'select', lookup: 'employees', labelKey: (e) => `${e.full_name}${e.role_name ? ' – ' + e.role_name : ''}` });

export const PROJECT_FIELDS = (canFin) => [
  { name: 'name', label: 'Project Name', required: true, col: 'full' },
  { name: 'company_id', label: 'Client Company', type: 'select', remote: { endpoint: '/companies', label: (r) => r.name }, onChange: (v) => ({ ...v, contact_id: '' }) },
  { name: 'contact_id', label: 'Client Contact', type: 'select', remote: { endpoint: '/contacts', label: (r) => r.name, params: (v) => ({ company_id: v.company_id }), enabledIf: (v) => !!v.company_id } },
  { name: 'service_id', label: 'Service Line', type: 'select', lookup: 'services' },
  { name: 'event_type_id', label: 'Event Type', type: 'select', lookup: 'lead-event-types' },
  { name: 'event_start', label: 'Event Start', type: 'date' },
  { name: 'event_end', label: 'Event End', type: 'date' },
  { name: 'location', label: 'Venue / Location' },
  { name: 'city', label: 'City' },
  { name: 'confirmed_value', label: 'Confirmed Order Value (₹)', type: 'number' },
  { name: 'estimated_cost', label: 'Estimated Direct Cost (₹)', type: 'number', hidden: () => !canFin },
  { name: 'approved_budget', label: 'Approved Budget (₹)', type: 'number', hidden: () => !canFin },
  { name: 'tax_pct', label: 'GST %', type: 'number' },
  { name: 'payment_terms', label: 'Payment Terms', col: 'full', hidden: () => !canFin },
  emp('BD Owner', 'bd_owner_id'),
  emp('Client Servicing Owner', 'cs_owner_id'),
  emp('Operations Owner', 'ops_owner_id'),
  emp('Finance Owner', 'finance_owner_id'),
  emp('Project Manager', 'manager_id'),
  { name: 'status', label: 'Status', type: 'select', options: toOptions(PROJECT_STATUSES), allowEmpty: false },
  { name: 'health', label: 'Health', type: 'select', options: toOptions(HEALTH), allowEmpty: false },
  { name: 'event_day_status', label: 'Event-day Status', placeholder: 'e.g. Setup complete, show running' },
  { name: 'scope', label: 'Approved Scope', type: 'textarea' },
];

export const HealthDot = ({ h }) => <span className={`inline-block h-2.5 w-2.5 rounded-full ${h === 'Red' ? 'bg-red-500' : h === 'Amber' ? 'bg-amber-400' : 'bg-green-500'}`} title={h} />;

export default function Projects() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const fields = PROJECT_FIELDS(can('project_financials', 'edit'));
  return (
    <CrudPage
      title="Projects"
      endpoint="/projects"
      module="projects"
      addLabel="New Project"
      exportName="projects"
      modalSize="lg"
      onRowClick={(r) => navigate(`/projects/${r.id}`)}
      filters={[
        { name: 'status', label: 'All Status', options: toOptions(PROJECT_STATUSES) },
        { name: 'health', label: 'All Health', options: toOptions(HEALTH) },
        { name: 'event_type_id', label: 'All Event Types', lookup: 'lead-event-types' },
        { name: 'manager_id', label: 'All Managers', lookup: 'employees', labelKey: 'full_name' },
      ]}
      columns={[
        { key: 'project_code', label: 'Project', render: (r) => <Link className="link font-medium" to={`/projects/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.project_code}</Link>, exportValue: (r) => r.project_code },
        { key: 'name', label: 'Name / Client', render: (r) => <div><div className="font-medium text-ink">{r.name}</div><div className="text-xs text-slate-500">{r.company_name}</div></div> },
        { key: 'event_start', label: 'Event Date', render: (r) => fmtDate(r.event_start) },
        { key: 'confirmed_value', label: 'Confirmed Value', render: (r) => inr(Number(r.confirmed_value) + Number(r.change_order_value || 0)) },
        { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
        { key: 'health', label: 'Health', render: (r) => <HealthDot h={r.health} /> },
        { key: 'progress', label: 'Progress', render: (r) => <div className="flex min-w-[100px] items-center gap-2"><ProgressBar value={r.progress} /><span className="text-xs">{r.progress}%</span></div> },
        { key: 'handover_status', label: 'Handover', render: (r) => <Badge>{r.handover_status}</Badge> },
        { key: 'task_overdue', label: 'Overdue', render: (r) => (Number(r.task_overdue) + Number(r.milestone_overdue) ? <span className="font-medium text-red-600">{Number(r.task_overdue)} tasks · {Number(r.milestone_overdue)} ms</span> : <span className="text-slate-400">—</span>) },
        { key: 'manager_name', label: 'Manager' },
      ]}
      defaults={{ status: 'Planning', health: 'Green', tax_pct: 18 }}
      fields={fields}
      toPayload={(v) => Object.fromEntries(fields.map((f) => [f.name, v[f.name]]))}
    />
  );
}
