import { useNavigate } from 'react-router-dom';
import { LuShieldCheck } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import { useLookups } from '../../context/LookupContext';
import { DATA_SCOPES } from '../../utils/constants';

export default function Roles() {
  const navigate = useNavigate();
  const { reload } = useLookups();
  return (
    <CrudPage
      variant="master"
      title="Roles Table"
      endpoint="/roles"
      module="roles"
      addLabel="Add Role"
      exportName="roles"
      filters={[{ name: 'department_id', label: 'All Departments', lookup: 'departments' }]}
      columns={[
        { key: 'name', label: 'Role Name' },
        { key: 'department_name', label: 'Department', render: (r) => r.department_name || '—' },
        { key: 'level', label: 'Level' },
        { key: 'data_scope', label: 'Data Visibility', render: (r) => (DATA_SCOPES.find((d) => d.value === r.data_scope) || {}).label },
        { key: 'employee_count', label: 'Employees' },
        { key: 'status', label: 'Active Status', render: (r) => <Badge>{Number(r.status) ? 'Active' : 'Inactive'}</Badge> },
      ]}
      defaults={{ status: 1, level: 4, data_scope: 'own' }}
      fields={[
        { name: 'name', label: 'Role Name', required: true },
        { name: 'department_id', label: 'Department', type: 'select', lookup: 'departments' },
        { name: 'level', label: 'Hierarchy Level', type: 'number', help: '1 = MD, 2 = Head, 3 = Manager, 4 = Executive' },
        { name: 'data_scope', label: 'Data Visibility', type: 'select', options: DATA_SCOPES, allowEmpty: false },
        { name: 'copy_from_role_id', label: 'Copy permissions from', type: 'select', lookup: 'roles', hidden: (v) => !!v.id, help: 'Optional: start with another role’s permissions' },
        { name: 'status', label: 'Status', type: 'select', allowEmpty: false, options: [{ value: 1, label: 'Active' }, { value: 0, label: 'Inactive' }] },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      toPayload={(v) => ({ name: v.name, department_id: v.department_id, level: v.level, data_scope: v.data_scope, status: v.status, description: v.description, copy_from_role_id: v.copy_from_role_id })}
      canDeleteRow={(r) => !Number(r.is_system)}
      afterSave={reload}
      rowActions={(r) => (
        <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Permissions" onClick={() => navigate(`/masters/permissions?role=${r.id}`)}>
          <LuShieldCheck size={15} />
        </button>
      )}
    />
  );
}
