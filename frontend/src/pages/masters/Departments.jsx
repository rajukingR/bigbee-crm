import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import { useLookups } from '../../context/LookupContext';

export default function Departments() {
  const { reload } = useLookups();
  return (
    <CrudPage
      variant="master"
      title="Departments Table"
      endpoint="/departments"
      module="departments"
      addLabel="Add Department"
      exportName="departments"
      columns={[
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Department Name' },
        { key: 'head_name', label: 'Head', render: (r) => r.head_name || '—' },
        { key: 'employee_count', label: 'Employees' },
        { key: 'status', label: 'Active Status', render: (r) => <Badge>{Number(r.status) ? 'Active' : 'Inactive'}</Badge> },
      ]}
      defaults={{ status: 1 }}
      fields={[
        { name: 'name', label: 'Department Name', required: true },
        { name: 'code', label: 'Code', required: true, help: 'Short code e.g. BD, CS, OPS' },
        { name: 'head_id', label: 'Department Head', type: 'select', lookup: 'employees', labelKey: 'full_name' },
        { name: 'status', label: 'Status', type: 'select', allowEmpty: false, options: [{ value: 1, label: 'Active' }, { value: 0, label: 'Inactive' }] },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      toPayload={(v) => ({ name: v.name, code: v.code, head_id: v.head_id, status: v.status, description: v.description })}
      afterSave={reload}
    />
  );
}
