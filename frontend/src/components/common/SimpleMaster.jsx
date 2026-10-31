import CrudPage from './CrudPage';
import Badge from './Badge';
import { useLookups } from '../../context/LookupContext';

/**
 * Dropdown master screen (Lead Type, Lead Source, Services …) in the
 * Employee-Master table style. Extra columns / fields per master.
 */
export default function SimpleMaster({ type, label, extraColumns = [], extraFields = [], filters = [] }) {
  const { reload } = useLookups();
  return (
    <CrudPage
      variant="master"
      title={`${label} Table`}
      endpoint={`/masters/${type}`}
      module="masters"
      addLabel={`Add ${label}`}
      exportName={label.toLowerCase().replace(/\s+/g, '_')}
      filters={filters}
      columns={[
        { key: 'name', label: `${label} Name` },
        ...extraColumns,
        { key: 'description', label: 'Description', render: (r) => r.description || '—' },
        { key: 'sort_order', label: 'Order' },
        {
          key: 'status',
          label: 'Active Status',
          render: (r) => <Badge>{Number(r.status) ? 'Active' : 'Inactive'}</Badge>,
          exportValue: (r) => (Number(r.status) ? 'Active' : 'Inactive'),
        },
      ]}
      defaults={{ status: 1, sort_order: 0 }}
      fields={[
        { name: 'name', label: `${label} Name`, required: true },
        ...extraFields,
        { name: 'sort_order', label: 'Display Order', type: 'number' },
        { name: 'status', label: 'Status', type: 'select', allowEmpty: false, options: [{ value: 1, label: 'Active' }, { value: 0, label: 'Inactive' }] },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      formTitle={(f) => `${f.id ? 'Edit' : 'Add'} ${label}`}
      afterSave={reload}
    />
  );
}
