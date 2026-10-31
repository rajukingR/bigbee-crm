import { useState } from 'react';
import toast from 'react-hot-toast';
import { LuArrowRightLeft } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { FormRenderer } from '../../components/common/FormFields';
import api, { fileUrl, showError } from '../../api/axios';
import { useLookups } from '../../context/LookupContext';
import { initials } from '../../utils/format';

export default function EmployeeMaster() {
  const { reload: reloadLookups } = useLookups();
  const [reassign, setReassign] = useState(null);
  const [rv, setRv] = useState({});
  const [key, setKey] = useState(0);

  const doReassign = async () => {
    try {
      const { data } = await api.post(`/employees/${reassign.id}/reassign`, rv);
      toast.success(`Moved ${data.leads} leads, ${data.opportunities} opportunities, ${data.tasks} tasks`);
      setReassign(null);
      setKey((k) => k + 1);
    } catch (e) {
      showError(e);
    }
  };

  return (
    <>
      <CrudPage
        variant="master"
        title="Employees Table"
        endpoint="/employees"
        module="employees"
        addLabel="Add Employee"
        exportName="employees"
        multipart
        reloadKey={key}
        modalSize="lg"
        filters={[
          { name: 'role_id', label: 'All Roles', lookup: 'roles' },
          { name: 'active_status', label: 'All Status', options: [{ value: 1, label: 'Active' }, { value: 0, label: 'Inactive' }] },
        ]}
        columns={[
          { key: 'employee_code', label: 'Employee Id' },
          {
            key: 'full_name',
            label: 'Full Name',
            render: (r) => (
              <span className="inline-flex items-center gap-2">
                {r.photo ? (
                  <img src={fileUrl(r.photo)} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand">{initials(r.full_name)}</span>
                )}
                {r.full_name}
              </span>
            ),
          },
          { key: 'email', label: 'Email' },
          { key: 'role_name', label: 'Role Name', render: (r) => r.role_name || '—' },
          { key: 'manager_name', label: 'Reports To', render: (r) => r.manager_name || '—' },
          {
            key: 'active_status',
            label: 'Active Status',
            render: (r) => <Badge>{Number(r.active_status) ? 'Active' : 'Inactive'}</Badge>,
            exportValue: (r) => (Number(r.active_status) ? 'Active' : 'Inactive'),
          },
        ]}
        defaults={{ active_status: 1 }}
        toForm={(r) => ({ ...r, password: '', photo: null })}
        toPayload={(v) => {
          const out = { ...v };
          ['role_name', 'department_name', 'manager_name', 'last_login', 'created_at', 'deactivated_at', 'is_super_admin', 'open_work', 'team', 'id'].forEach((k) => delete out[k]);
          if (!(out.photo instanceof File)) delete out.photo;
          if (!out.password) delete out.password;
          return out;
        }}
        validate={(v, id) => (!id && !v.password ? { password: 'Password is required' } : {})}
        fields={[
          { name: 'full_name', label: 'Full Name', required: true },
          { name: 'employee_code', label: 'Employee Id', placeholder: 'Auto-generated if empty' },
          { name: 'email', label: 'Email (login)', type: 'email', required: true },
          { name: 'phone', label: 'Phone' },
          { name: 'password', label: 'Password', type: 'password', help: 'Min 6 characters. Leave blank to keep current password when editing.' },
          { name: 'designation', label: 'Designation' },
          {
            name: 'role_id',
            label: 'Role',
            type: 'select',
            lookup: 'roles',
            required: true,
          },
          { name: 'department_id', label: 'Department', type: 'select', lookup: 'departments', help: 'Defaults to the role department' },
          { name: 'reports_to', label: 'Reports To (Upward Reporting)', type: 'select', lookup: 'employees', labelKey: (r) => `${r.full_name}${r.role_name ? ' – ' + r.role_name : ''}` },
          { name: 'date_of_joining', label: 'Date of Joining', type: 'date' },
          { name: 'city', label: 'City' },
          { name: 'active_status', label: 'Status', type: 'select', allowEmpty: false, options: [{ value: 1, label: 'Active' }, { value: 0, label: 'Inactive' }] },
          { name: 'photo', label: 'Profile Photo', type: 'file', accept: 'image/*' },
        ]}
        formTitle={(f) => (f.id ? 'Edit Employee' : 'Add Employee')}
        canDeleteRow={(r) => !Number(r.is_super_admin)}
        confirmMessage={() => 'Employees with history cannot be deleted – deactivate them instead. Continue?'}
        afterSave={reloadLookups}
        rowActions={(r) =>
          !Number(r.active_status) && (
            <button
              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand"
              title="Reassign open work"
              onClick={() => {
                setRv({ reason: 'Employee deactivated' });
                setReassign(r);
              }}
            >
              <LuArrowRightLeft size={15} />
            </button>
          )
        }
      />
      <Modal
        open={!!reassign}
        onClose={() => setReassign(null)}
        title={`Reassign open work of ${reassign ? reassign.full_name : ''}`}
        footer={
          <>
            <button className="btn-outline" onClick={() => setReassign(null)}>Cancel</button>
            <button className="btn-primary" onClick={doReassign} disabled={!rv.to_employee_id}>Reassign</button>
          </>
        }
      >
        <p className="mb-4 text-sm text-slate-600">
          Open leads, opportunities, tasks, owned companies and direct reports will move to the selected employee. History stays with the original owner.
        </p>
        <FormRenderer
          values={rv}
          onChange={(n, v) => setRv((s) => ({ ...s, [n]: v }))}
          fields={[
            { name: 'to_employee_id', label: 'Reassign to', type: 'select', lookup: 'employees', required: true, labelKey: (e) => `${e.full_name} – ${e.role_name || ''}`, filter: (e) => reassign && e.id !== reassign.id },
            { name: 'reason', label: 'Reason', col: 'full' },
          ]}
        />
      </Modal>
    </>
  );
}
