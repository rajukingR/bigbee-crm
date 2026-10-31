import { Link } from 'react-router-dom';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import { DECISION_ROLES, toOptions } from '../../utils/constants';

export const CONTACT_FIELDS = [
  { name: 'name', label: 'Contact Name', required: true },
  { name: 'company_id', label: 'Company', type: 'select', remote: { endpoint: '/companies', label: (r) => r.name } },
  { name: 'designation', label: 'Designation' },
  { name: 'department', label: 'Department', placeholder: 'HR / Admin, Marketing, Procurement…' },
  { name: 'phone', label: 'Phone' },
  { name: 'alt_phone', label: 'Alternate Phone' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'location', label: 'Location' },
  { name: 'decision_role', label: 'Decision-making Role', type: 'select', options: toOptions(DECISION_ROLES), allowEmpty: false },
  { name: 'is_primary', label: 'Primary contact', type: 'checkbox', checkboxLabel: 'Primary contact for the company' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];

export default function Contacts() {
  return (
    <CrudPage
      title="Contacts"
      endpoint="/contacts"
      module="contacts"
      addLabel="Add Contact"
      exportName="contacts"
      filters={[
        { name: 'company_id', label: 'All Companies', remote: { endpoint: '/companies', label: (r) => r.name } },
        { name: 'decision_role', label: 'All Roles', options: toOptions(DECISION_ROLES) },
      ]}
      columns={[
        { key: 'name', label: 'Name', render: (r) => <span className="font-medium text-ink">{r.name}{Number(r.is_primary) ? ' ★' : ''}</span> },
        { key: 'company_name', label: 'Company', render: (r) => (r.company_id ? <Link className="link" to={`/companies/${r.company_id}`} onClick={(e) => e.stopPropagation()}>{r.company_name}</Link> : '—'), exportValue: (r) => r.company_name },
        { key: 'designation', label: 'Designation' },
        { key: 'department', label: 'Department' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'decision_role', label: 'Role', render: (r) => <Badge>{r.decision_role}</Badge> },
      ]}
      defaults={{ decision_role: 'Other', is_primary: 0 }}
      fields={CONTACT_FIELDS}
      toPayload={(v) => Object.fromEntries(CONTACT_FIELDS.map((f) => [f.name, v[f.name]]))}
    />
  );
}
